/**
 * POST /api/ai/daily-worklist
 *
 * Streaming AI endpoint that analyzes the provider's patient panel and returns
 * a prioritized daily action list with clinical reasoning.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateStream, toSSEResponse } from "@/lib/ai";
import { requirePermission, PERMISSIONS, isAdmin, getProviderScope } from "@/lib/rbac";
import { differenceInDays, differenceInWeeks } from "date-fns";
import { RiskLevel, TaskStatus } from "@/generated/prisma/client";

const SYSTEM_PROMPT = `You are a clinical AI assistant for maternal healthcare providers.
Your job is to create a concise, prioritized daily action list based on patient panel data.

CRITICAL RULES:
- ONLY reference patients explicitly listed in the provided data. Never invent, assume, or add patients not in the data.
- If no patients or no actionable items are present, say so clearly rather than fabricating tasks.

Format your response as a numbered list of up to 8 specific actions. Each action should:
1. Start with urgency: "🔴 URGENT:", "🟡 TODAY:", or "🟢 THIS WEEK:"
2. Name the patient (first name only for brevity)
3. State the specific action needed
4. Give a one-sentence clinical rationale citing relevant data

Be direct and clinical. Use only data points provided. Reference ACOG/USPSTF guidelines when relevant.
Do not diagnose — frame as observations requiring provider evaluation.
End with a 1-sentence panel health summary.`;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  requirePermission(session, PERMISSIONS.PATIENT_READ);

  const scope = getProviderScope(session);
  const patientWhere = scope
    ? {
        deletedAt: null,
        OR: [
          { providerId: scope },
          { patientAccesses: { some: { providerId: scope } } },
        ],
      }
    : { deletedAt: null };

  // Fetch panel summary for AI context
  const totalPatients = await db.patient.count({ where: patientWhere });

  if (totalPatients === 0) {
    return new Response(
      `data: "No patients in your panel yet. Add or link patients to get a daily action list."\n\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const [highRiskPatients, overdueTasks, missingScreenings, recentVitalsFlags] = await Promise.all([
    db.patient.findMany({
      where: {
        AND: [
          patientWhere,
          { riskLevel: { in: [RiskLevel.HIGH, RiskLevel.VERY_HIGH] } },
        ],
      },
      select: {
        firstName: true,
        lastName: true,
        riskScore: true,
        riskLevel: true,
        gestationalAgeWeeks: true,
        status: true,
        lastContactAt: true,
        riskFactors: true,
        careTasks: {
          where: { deletedAt: null, status: TaskStatus.OVERDUE },
          select: { title: true, dueDate: true },
          take: 3,
          orderBy: { dueDate: "asc" },
        },
        screenings: {
          orderBy: { administeredAt: "desc" },
          take: 1,
          select: { type: true, score: true, riskResult: true, administeredAt: true },
        },
      },
      orderBy: { riskScore: "desc" },
      take: 15,
    }),

    db.careTask.count({
      where: {
        deletedAt: null,
        status: TaskStatus.OVERDUE,
        patient: { AND: [patientWhere] },
      },
    }),

    db.patient.findMany({
      where: {
        AND: [
          patientWhere,
          {
            status: { in: ["PREGNANT", "POSTPARTUM"] },
            screenings: {
              none: {
                type: { in: ["phq9", "epds"] },
                administeredAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
              },
            },
          },
        ],
      },
      select: { firstName: true, gestationalAgeWeeks: true, status: true },
      take: 5,
    }),

    // Patients with no contact in 14+ days
    db.patient.findMany({
      where: {
        AND: [
          patientWhere,
          {
            status: { in: ["PREGNANT", "POSTPARTUM"] },
            riskLevel: { in: [RiskLevel.HIGH, RiskLevel.VERY_HIGH] },
            OR: [
              { lastContactAt: { lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
              { lastContactAt: null },
            ],
          },
        ],
      },
      select: { firstName: true, riskScore: true, lastContactAt: true },
      take: 5,
    }),
  ]);

  // Build concise panel summary for AI
  const panelLines: string[] = [
    `Panel Overview (${totalPatients} total patients):`,
    `- ${overdueTasks} overdue tasks across panel`,
    `- ${missingScreenings.length} patients missing depression screening (PHQ-9/EPDS >90 days)`,
    `- ${recentVitalsFlags.length} high-risk patients with no contact in 14+ days`,
    ``,
    `High/Very-High Risk Patients (${highRiskPatients.length}):`,
  ];

  for (const p of highRiskPatients) {
    const daysSinceContact = p.lastContactAt
      ? differenceInDays(new Date(), new Date(p.lastContactAt))
      : null;
    const gaStr = p.gestationalAgeWeeks ? `${p.gestationalAgeWeeks}w GA` : p.status;
    const overdueStr =
      p.careTasks.length > 0
        ? `, ${p.careTasks.length} overdue tasks (${p.careTasks[0].title})`
        : "";
    const contactStr =
      daysSinceContact !== null ? `, last contact ${daysSinceContact}d ago` : ", never contacted";
    const screenStr =
      p.screenings[0]
        ? `, last screen: ${p.screenings[0].type} score ${p.screenings[0].score ?? "N/A"} (${p.screenings[0].riskResult ?? "?"}) ${differenceInWeeks(new Date(), new Date(p.screenings[0].administeredAt))}w ago`
        : ", no screening on record";

    panelLines.push(
      `- ${p.firstName} ${p.lastName}: risk ${p.riskScore} (${p.riskLevel}), ${gaStr}${overdueStr}${contactStr}${screenStr}`,
    );
  }

  if (missingScreenings.length > 0) {
    panelLines.push(`\nMissing depression screen: ${missingScreenings.map((p) => `${p.firstName} (${p.gestationalAgeWeeks ?? p.status}w)`).join(", ")}`);
  }

  if (recentVitalsFlags.length > 0) {
    panelLines.push(`\nNo contact, high risk: ${recentVitalsFlags.map((p) => `${p.firstName} (risk ${p.riskScore}, ${p.lastContactAt ? differenceInDays(new Date(), new Date(p.lastContactAt)) + "d ago" : "never"})`).join(", ")}`);
  }

  const userMessage = panelLines.join("\n");

  const stream = generateStream({
    system: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 700,
  });

  if (!stream) {
    return new Response(JSON.stringify({ error: "AI unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  return toSSEResponse(stream);
}
