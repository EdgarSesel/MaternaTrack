import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateStream, toSSEResponse } from "@/lib/ai";
import { RiskLevel, TaskStatus } from "@/generated/prisma/client";
import { subDays } from "date-fns";
import { requirePermission, PERMISSIONS, getProviderScope } from "@/lib/rbac";

const SYSTEM_PROMPT = `You are a clinical panel advisor for a maternal health nursing team.

Review this provider's patient panel summary and provide a concise panel intelligence report (4-5 sentences) covering:
1. Overall panel health and most urgent risk patterns
2. Care gaps or engagement concerns that need immediate attention
3. One systemic recommendation to improve care quality across the panel

Be specific, reference actual numbers, and use clinical language appropriate for nurses and midwives.
Do not mention individual patients by name. Keep the response under 160 words.`;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session, PERMISSIONS.AI_PANEL_SUMMARY);
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const providerScope = getProviderScope(session);
  const providerFilter = providerScope ? { providerId: providerScope } : {};
  const patientWhere = { ...providerFilter, deletedAt: null };
  const now = new Date();

  const [totalPatients, byRisk, overdueTasks, notContacted, allTasks, missingScreen, activeProtocols] =
    await Promise.all([
      db.patient.count({ where: patientWhere }),
      db.patient.groupBy({ by: ["riskLevel"], where: patientWhere, _count: true }),
      db.careTask.count({
        where: { deletedAt: null, patient: patientWhere, status: TaskStatus.OVERDUE },
      }),
      db.patient.count({
        where: {
          ...patientWhere,
          OR: [
            { lastContactAt: { lt: subDays(now, 14) } },
            { lastContactAt: null },
          ],
        },
      }),
      db.careTask.findMany({
        where: { deletedAt: null, patient: patientWhere },
        select: { status: true },
      }),
      db.patient.count({
        where: {
          ...patientWhere,
          screenings: {
            none: {
              type: { in: ["phq9", "epds"] },
              administeredAt: { gte: subDays(now, 90) },
            },
          },
        },
      }),
      db.carePlan.groupBy({
        by: ["protocolType"],
        where: { deletedAt: null, patient: patientWhere, status: "active" },
        _count: true,
      }),
    ]);

  const riskMap: Record<string, number> = {};
  for (const r of byRisk) riskMap[r.riskLevel] = r._count;

  const completedTasks = allTasks.filter((t) => t.status === "COMPLETED").length;
  const taskCompletionRate =
    allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0;

  const highRisk = (riskMap[RiskLevel.HIGH] ?? 0) + (riskMap[RiskLevel.VERY_HIGH] ?? 0);

  const userMessage = `
PANEL SUMMARY

Total Patients: ${totalPatients}
Risk Distribution:
  - Low: ${riskMap[RiskLevel.LOW] ?? 0}
  - Moderate: ${riskMap[RiskLevel.MODERATE] ?? 0}
  - High: ${riskMap[RiskLevel.HIGH] ?? 0}
  - Very High: ${riskMap[RiskLevel.VERY_HIGH] ?? 0}
  - High + Very High combined: ${highRisk} (${totalPatients > 0 ? Math.round((highRisk / totalPatients) * 100) : 0}% of panel)

Care Quality:
  - Total care tasks: ${allTasks.length}
  - Task completion rate: ${taskCompletionRate}%
  - Overdue tasks: ${overdueTasks}

Engagement:
  - Patients not contacted in 14+ days: ${notContacted}
  - Patients missing depression screening (PHQ-9/EPDS in 90 days): ${missingScreen}

Active Protocols: ${activeProtocols.map((p) => `${p.protocolType.replace(/_/g, " ")} (${p._count} patients)`).join(", ") || "None"}
`.trim();

  const stream = generateStream({ system: SYSTEM_PROMPT, userMessage, maxTokens: 300 });
  if (!stream) {
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }

  return toSSEResponse(stream);
}
