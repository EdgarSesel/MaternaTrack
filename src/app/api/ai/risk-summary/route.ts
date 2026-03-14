import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateStream, toSSEResponse } from "@/lib/ai";
import { z } from "zod";
import { differenceInYears, differenceInDays, format } from "date-fns";
import type { RiskFactorResult } from "@/lib/risk-engine";
import { requirePermission, PERMISSIONS, isAdmin } from "@/lib/rbac";

const RequestSchema = z.object({
  patientId: z.string().min(1),
});

const SYSTEM_PROMPT = `You are a clinical decision support assistant for maternal care providers.

Given the following patient data, provide a concise clinical summary (3-5 sentences) covering:
1. Current risk status and primary concerns
2. Recent trends (improving, stable, or worsening)
3. Top 1-2 recommended actions for the care team

Be specific and reference actual data points. Use clinical language appropriate for a nurse or midwife.
Do not diagnose. Frame everything as observations and suggestions for the provider to evaluate.
Keep the response under 150 words.`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session, PERMISSIONS.AI_RISK_SUMMARY);
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { patientId } = parsed.data;

  // Verify patient belongs to this provider (admin sees all)
  const ownerWhere = isAdmin(session)
    ? { id: patientId, deletedAt: null }
    : { id: patientId, providerId: session.user.id, deletedAt: null };
  const patient = await db.patient.findFirst({
    where: ownerWhere,
    include: {
      vitals: { orderBy: { recordedAt: "desc" }, take: 12 },
      screenings: { orderBy: { administeredAt: "desc" }, take: 5 },
      careTasks: { where: { status: { in: ["PENDING", "OVERDUE"] } } },
    },
  });

  if (!patient) {
    return Response.json({ error: "Patient not found" }, { status: 404 });
  }

  // Build clinical summary
  const age = differenceInYears(new Date(), new Date(patient.dateOfBirth));
  const riskFactors = (patient.riskFactors as unknown as RiskFactorResult[]) ?? [];
  const medHistory = (patient.medicalHistory as unknown as {
    preexistingConditions?: string[];
    previousPreterm?: boolean;
    bmi?: number;
  }) ?? {};
  const sdoh = (patient.socialDeterminants as unknown as Record<string, boolean>) ?? {};

  const recentBp = patient.vitals
    .filter((v) => v.type === "bp")
    .slice(0, 4)
    .map((v) => {
      const val = v.value as unknown as { systolic: number; diastolic: number };
      return `${val.systolic}/${val.diastolic} (${differenceInDays(new Date(), v.recordedAt)}d ago)`;
    });

  const recentWeight = patient.vitals
    .filter((v) => v.type === "weight")
    .slice(0, 2)
    .map((v) => {
      const val = v.value as unknown as { value: number; unit: string };
      return `${val.value} ${val.unit ?? "lbs"} (${differenceInDays(new Date(), v.recordedAt)}d ago)`;
    });

  const recentGlucose = patient.vitals
    .filter((v) => v.type === "glucose")
    .slice(0, 3)
    .map((v) => {
      const val = v.value as unknown as { value: number };
      return `${val.value} mg/dL (${differenceInDays(new Date(), v.recordedAt)}d ago)`;
    });

  const screeningSummary = patient.screenings.slice(0, 3).map((s) => {
    const when = format(new Date(s.administeredAt), "MMM d");
    return `${s.type.toUpperCase()}: ${s.score !== null ? `score ${s.score}` : ""} ${s.riskResult ?? ""} (${when})`;
  });

  const sdohFlags = Object.entries(sdoh)
    .filter(([, v]) => v === true)
    .map(([k]) => k.replace(/([A-Z])/g, " $1").trim());

  const topFactors = riskFactors
    .slice(0, 5)
    .map((f) => `${f.label}: ${f.score}/${f.maxScore} pts (${f.trend})`);

  const overdueTasks = patient.careTasks.filter((t) => t.status === "OVERDUE").length;
  const pendingTasks = patient.careTasks.filter((t) => t.status === "PENDING").length;

  const userMessage = `
PATIENT CLINICAL SUMMARY

Demographics:
- Name: ${patient.firstName} ${patient.lastName}, Age ${age}
- Status: ${patient.status}${patient.gestationalAgeWeeks ? `, ${patient.gestationalAgeWeeks}w gestational age` : ""}${patient.dueDate ? `, EDD ${format(new Date(patient.dueDate), "MMM d, yyyy")}` : ""}
- Insurance: ${patient.insuranceType ?? "Unknown"}

Risk Assessment:
- Risk Score: ${patient.riskScore}/100 (${patient.riskLevel.replace("_", " ")})
- Top Risk Factors: ${topFactors.length > 0 ? topFactors.join("; ") : "None significant"}

Medical History:
- Pre-existing conditions: ${(medHistory.preexistingConditions ?? []).join(", ") || "None"}
- Previous preterm birth: ${medHistory.previousPreterm ? "Yes" : "No"}
- BMI: ${medHistory.bmi ?? "Not recorded"}

Recent Vitals:
${recentBp.length > 0 ? `- Blood Pressure: ${recentBp.join(", ")}` : "- Blood Pressure: No recent readings"}
${recentWeight.length > 0 ? `- Weight: ${recentWeight.join(", ")}` : ""}
${recentGlucose.length > 0 ? `- Fasting Glucose: ${recentGlucose.join(", ")}` : ""}

Screenings:
${screeningSummary.length > 0 ? screeningSummary.join("\n") : "No recent screenings"}

Social Determinants:
${sdohFlags.length > 0 ? sdohFlags.join(", ") : "None flagged"}

Engagement:
- Last contact: ${patient.lastContactAt ? `${differenceInDays(new Date(), new Date(patient.lastContactAt))} days ago` : "Never"}
- Care tasks: ${overdueTasks} overdue, ${pendingTasks} pending
`.trim();

  const stream = generateStream({ system: SYSTEM_PROMPT, userMessage, maxTokens: 250 });
  if (!stream) {
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }

  return toSSEResponse(stream);
}
