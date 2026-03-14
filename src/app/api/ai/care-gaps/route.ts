import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateStream, toSSEResponse } from "@/lib/ai";
import { z } from "zod";
import { differenceInDays, format, isPast } from "date-fns";
import { requirePermission, PERMISSIONS, isAdmin } from "@/lib/rbac";

const RequestSchema = z.object({
  patientId: z.string().min(1),
});

const SYSTEM_PROMPT = `You are a care quality analyst for a maternal health program.

Review this patient's care plan progress and identify gaps. For each gap found, provide:
1. What is missing or overdue
2. Why it matters (cite relevant guideline: ACOG, USPSTF, or SMFM when applicable)
3. Suggested action with urgency level (routine / soon / urgent)

Format each gap as a short paragraph. List 2-4 gaps maximum. Be specific and actionable.
If no significant gaps exist, say so briefly.
Keep the total response under 200 words.`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session, PERMISSIONS.AI_CARE_GAPS);
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { patientId } = parsed.data;

  const ownerWhere = isAdmin(session)
    ? { id: patientId, deletedAt: null }
    : { id: patientId, providerId: session.user.id, deletedAt: null };
  const patient = await db.patient.findFirst({
    where: ownerWhere,
    include: {
      carePlans: {
        where: { status: "active" },
        include: { tasks: { orderBy: { dueDate: "asc" } } },
      },
      careTasks: { orderBy: [{ status: "asc" }, { dueDate: "asc" }] },
      screenings: { orderBy: { administeredAt: "desc" }, take: 10 },
      timelineEvents: { orderBy: { createdAt: "desc" }, take: 15 },
    },
  });

  if (!patient) {
    return Response.json({ error: "Patient not found" }, { status: 404 });
  }

  const overdueTasks = patient.careTasks.filter(
    (t) =>
      t.status === "OVERDUE" ||
      (t.status === "PENDING" && isPast(new Date(t.dueDate))),
  );

  const upcomingTasks = patient.careTasks.filter(
    (t) => t.status === "PENDING" && !isPast(new Date(t.dueDate)),
  );

  const completedTasks = patient.careTasks.filter((t) => t.status === "COMPLETED");
  const totalTasks = patient.careTasks.length;
  const completionRate =
    totalTasks > 0
      ? Math.round((completedTasks.length / totalTasks) * 100)
      : 0;

  const recentScreeningTypes = new Set(
    patient.screenings
      .filter(
        (s) =>
          differenceInDays(new Date(), new Date(s.administeredAt)) <= 90,
      )
      .map((s) => s.type),
  );

  const missingScreenings: string[] = [];
  if (!recentScreeningTypes.has("phq9") && !recentScreeningTypes.has("epds")) {
    missingScreenings.push("PHQ-9 / EPDS depression screening (last 90 days)");
  }
  if (patient.status === "PREGNANT" && !recentScreeningTypes.has("gdm_screen")) {
    missingScreenings.push("GDM screening");
  }
  if (!recentScreeningTypes.has("sdoh")) {
    missingScreenings.push("SDOH (Social Determinants) screening");
  }

  const taskSummary = overdueTasks
    .slice(0, 8)
    .map(
      (t) =>
        `- [OVERDUE] ${t.title} — due ${format(new Date(t.dueDate), "MMM d, yyyy")} (priority: ${t.priority})`,
    )
    .join("\n");

  const upcomingTaskSummary = upcomingTasks
    .slice(0, 5)
    .map(
      (t) =>
        `- [UPCOMING] ${t.title} — due ${format(new Date(t.dueDate), "MMM d, yyyy")}`,
    )
    .join("\n");

  const recentActivity = patient.timelineEvents
    .slice(0, 10)
    .map(
      (e) =>
        `- ${e.eventType.replace(/_/g, " ")} — ${e.title} (${format(new Date(e.createdAt), "MMM d")})`,
    )
    .join("\n");

  const planSummary = patient.carePlans
    .map((p) => `${p.protocolType} (activated ${format(new Date(p.activatedAt), "MMM d, yyyy")})`)
    .join(", ");

  const userMessage = `
PATIENT: ${patient.firstName} ${patient.lastName}
Status: ${patient.status}${patient.gestationalAgeWeeks ? ` — ${patient.gestationalAgeWeeks}w GA` : ""}

ACTIVE CARE PLANS:
${planSummary || "None"}

TASK COMPLETION:
- Overall: ${completionRate}% (${completedTasks.length}/${totalTasks} tasks)
- Overdue tasks: ${overdueTasks.length}
${taskSummary || "  None"}

UPCOMING TASKS:
${upcomingTaskSummary || "  None"}

MISSING SCREENINGS (last 90 days):
${missingScreenings.length > 0 ? missingScreenings.map((s) => `- ${s}`).join("\n") : "  None identified"}

RECENT ACTIVITY (last 30 days):
${recentActivity || "  No recent activity"}

Last contact: ${
    patient.lastContactAt
      ? `${differenceInDays(new Date(), new Date(patient.lastContactAt))} days ago`
      : "Never"
  }
`.trim();

  const stream = generateStream({ system: SYSTEM_PROMPT, userMessage, maxTokens: 400 });
  if (!stream) {
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }

  return toSSEResponse(stream);
}
