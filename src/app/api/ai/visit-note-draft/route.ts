/**
 * POST /api/ai/visit-note-draft
 *
 * Generates a SOAP visit note draft from patient clinical context.
 * Returns streaming SSE.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateStream, toSSEResponse } from "@/lib/ai";
import { z } from "zod";
import { differenceInYears, differenceInWeeks, format } from "date-fns";
import { requirePermission, PERMISSIONS, isAdmin } from "@/lib/rbac";

const RequestSchema = z.object({
  patientId: z.string().min(1),
  visitContext: z.string().max(500).optional(), // e.g. "routine prenatal 28 weeks"
  section: z.enum(["all", "subjective", "objective", "assessment", "plan"]).default("all"),
});

const SYSTEM_PROMPT = `You are a clinical documentation assistant for a maternal care provider.

Generate a SOAP visit note based on the patient's clinical data. Write in clinical shorthand appropriate for a nurse or midwife's documentation. Be concise, factual, and clinically relevant.

Format your response as JSON with exactly these fields:
{
  "subjective": "...",   // What the patient reports (symptoms, concerns, complaints)
  "objective": "...",    // Measurable findings: vitals, gestational age, exam findings
  "assessment": "...",   // Clinical interpretation of the data
  "plan": "..."          // Next steps, follow-ups, orders, referrals
}

Rules:
- Each section 1-3 sentences
- Subjective: start from patient's perspective ("Patient reports...")
- Objective: include actual numbers from the data (BP, weight, GA)
- Assessment: clinical reasoning ("Consistent with...", "Suggestive of...")
- Plan: specific and actionable ("Schedule...", "Order...", "Counsel on...")
- Do not diagnose — frame as observations for the provider to confirm
- Do not include PHI (name, DOB, identifiers) in the note text`;

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

  const { patientId, visitContext, section } = parsed.data;

  const ownerWhere = isAdmin(session)
    ? { id: patientId, deletedAt: null }
    : { id: patientId, providerId: session.user.id, deletedAt: null };

  const patient = await db.patient.findFirst({
    where: ownerWhere,
    include: {
      vitals: { orderBy: { recordedAt: "desc" }, take: 5 },
      screenings: { orderBy: { administeredAt: "desc" }, take: 3 },
      careTasks: {
        where: { deletedAt: null, status: { in: ["PENDING", "OVERDUE"] } },
        orderBy: { dueDate: "asc" },
        take: 5,
      },
    },
  });

  if (!patient) {
    return Response.json({ error: "Patient not found" }, { status: 404 });
  }

  const age = differenceInYears(new Date(), new Date(patient.dateOfBirth));
  const ga = patient.gestationalAgeWeeks
    ? `${patient.gestationalAgeWeeks} weeks GA`
    : "gestational age not recorded";

  const recentBp = patient.vitals.filter((v) => v.type === "bp").slice(0, 2);
  const recentWeight = patient.vitals.find((v) => v.type === "weight");
  const recentGlucose = patient.vitals.find((v) => v.type === "glucose");

  const bpText = recentBp
    .map((v) => {
      const val = v.value as { systolic?: number; diastolic?: number };
      return `${val.systolic}/${val.diastolic} mmHg (${format(new Date(v.recordedAt), "MMM d")})`;
    })
    .join(", ");

  const weightText = recentWeight
    ? (() => {
        const val = recentWeight.value as { value?: number; unit?: string };
        return `${val.value} ${val.unit ?? "lbs"}`;
      })()
    : "not recorded";

  const glucoseText = recentGlucose
    ? (() => {
        const val = recentGlucose.value as { value?: number };
        return `${val.value} mg/dL`;
      })()
    : null;

  const latestScreening = patient.screenings[0];
  const pendingTasks = patient.careTasks.filter((t) => t.status === "PENDING" || t.status === "OVERDUE");

  const clinicalSummary = `
Patient: ${age}-year-old ${patient.status.toLowerCase()} patient, ${ga}
Status: ${patient.riskLevel.replace("_", " ")} risk (score ${patient.riskScore}/100)
${visitContext ? `Visit context: ${visitContext}` : ""}

Recent Vitals:
- Blood pressure: ${bpText || "not recorded"}
- Weight: ${weightText}
${glucoseText ? `- Fasting glucose: ${glucoseText}` : ""}

${
  latestScreening
    ? `Latest Screening: ${latestScreening.type.toUpperCase()} on ${format(new Date(latestScreening.administeredAt), "MMM d")} — ${latestScreening.riskResult ?? "result not recorded"}${latestScreening.score !== null ? ` (score ${latestScreening.score})` : ""}`
    : "No recent screenings"
}

Pending Tasks (${pendingTasks.length}):
${pendingTasks.slice(0, 3).map((t) => `- ${t.title} (${t.status.toLowerCase()})`).join("\n") || "None"}

${section !== "all" ? `\nGenerate only the "${section}" section of the SOAP note.` : ""}
`.trim();

  const stream = generateStream({
    system: SYSTEM_PROMPT,
    userMessage: clinicalSummary,
    maxTokens: 800,
  });

  if (!stream) {
    return new Response(JSON.stringify({ error: "AI unavailable" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  return toSSEResponse(stream);
}
