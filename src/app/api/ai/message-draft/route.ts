import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateStream, toSSEResponse } from "@/lib/ai";
import { z } from "zod";
import { differenceInDays, differenceInWeeks } from "date-fns";
import { isPast } from "date-fns";
import { requirePermission, PERMISSIONS, isAdmin } from "@/lib/rbac";

const RequestSchema = z.object({
  patientId: z.string().min(1),
  context: z.string().max(500).optional(),
});

const SYSTEM_PROMPT = `You are helping a nurse care partner draft a message to a pregnant or postpartum patient.

Draft a warm, supportive outreach message that:
- Addresses the patient by first name only
- Is written at a 6th-grade reading level
- Keeps it to 2-3 sentences maximum
- Includes a clear, gentle ask or next step
- Does NOT include medical jargon or technical terms
- Does NOT start with "I hope this message finds you well" or similar clichés
- Feels human and caring, not robotic or formal
- Does NOT include subject lines, greetings like "Dear", or sign-offs

Output ONLY the message body text, nothing else.`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session, PERMISSIONS.AI_MESSAGE_DRAFT);
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { patientId, context } = parsed.data;

  const ownerWhere = isAdmin(session)
    ? { id: patientId, deletedAt: null }
    : { id: patientId, providerId: session.user.id, deletedAt: null };
  const patient = await db.patient.findFirst({
    where: ownerWhere,
    include: {
      vitals: { orderBy: { recordedAt: "desc" }, take: 4 },
      screenings: { orderBy: { administeredAt: "desc" }, take: 3 },
      careTasks: {
        where: { status: { in: ["PENDING", "OVERDUE"] } },
        orderBy: { dueDate: "asc" },
        take: 3,
      },
    },
  });

  if (!patient) {
    return Response.json({ error: "Patient not found" }, { status: 404 });
  }

  // Infer outreach context from patient data if not provided
  const daysSinceContact = patient.lastContactAt
    ? differenceInDays(new Date(), new Date(patient.lastContactAt))
    : null;

  const overdueTasks = patient.careTasks.filter(
    (t) =>
      t.status === "OVERDUE" ||
      (t.status === "PENDING" && isPast(new Date(t.dueDate))),
  );

  const latestBp = patient.vitals.find((v) => v.type === "bp");
  const bpVal = latestBp
    ? (latestBp.value as unknown as { systolic: number; diastolic: number })
    : null;
  const bpElevated = bpVal
    ? bpVal.systolic >= 130 || bpVal.diastolic >= 85
    : false;

  const latestPhq9 = patient.screenings.find(
    (s) => s.type === "phq9" || s.type === "epds",
  );

  // Build inferred context if none provided
  let inferredContext = context ?? "";
  if (!inferredContext) {
    if (bpElevated && bpVal) {
      inferredContext = `Patient's most recent blood pressure reading was ${bpVal.systolic}/${bpVal.diastolic} mmHg, which is elevated. Following up to check how they are feeling.`;
    } else if (overdueTasks.length > 0) {
      inferredContext = `Patient has ${overdueTasks.length} overdue care task(s) including "${overdueTasks[0].title}". Following up to offer support.`;
    } else if (daysSinceContact !== null && daysSinceContact > 7) {
      inferredContext = `Patient hasn't been contacted in ${daysSinceContact} days. Routine check-in.`;
    } else if (latestPhq9 && latestPhq9.score !== null && latestPhq9.score >= 10) {
      inferredContext = `Patient's recent depression screening score was ${latestPhq9.score}, indicating moderate symptoms. Following up with support.`;
    } else {
      inferredContext = "Routine check-in to see how the patient is doing.";
    }
  }

  const gaWeeks = patient.gestationalAgeWeeks;
  const dueInWeeks = patient.dueDate
    ? differenceInWeeks(new Date(patient.dueDate), new Date())
    : null;

  const userMessage = `
Patient Name: ${patient.firstName}
Status: ${patient.status}${gaWeeks ? ` — ${gaWeeks} weeks pregnant` : ""}${dueInWeeks !== null ? ` (${dueInWeeks} weeks until due date)` : ""}

Reason for outreach: ${inferredContext}

Draft a brief, warm message for the nurse to send to this patient.
`.trim();

  const stream = generateStream({ system: SYSTEM_PROMPT, userMessage, maxTokens: 150 });
  if (!stream) {
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }

  return toSSEResponse(stream);
}
