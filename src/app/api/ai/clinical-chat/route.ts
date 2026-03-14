import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateStream, toSSEResponse } from "@/lib/ai";
import { z } from "zod";
import { differenceInDays, differenceInYears, format } from "date-fns";
import { requirePermission, PERMISSIONS, isAdmin } from "@/lib/rbac";
import type { RiskFactorResult } from "@/lib/risk-engine";

export const runtime = "nodejs";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const RequestSchema = z.object({
  patientId: z.string().min(1),
  messages: z.array(MessageSchema).max(20),
  question: z.string().min(1).max(1000),
});

const SYSTEM_PROMPT = `You are an AI clinical decision support assistant embedded in a maternal health platform.
You have access to the patient's current clinical data (provided below).
Answer questions about this specific patient using the provided data.
Be concise and clinically precise. Reference specific data points.
Do NOT diagnose. Frame observations as "consider evaluating" or "data suggests".
If asked something outside the provided data, say you don't have that information.`;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requirePermission(session, PERMISSIONS.PATIENT_READ);
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 });
  }

  const { patientId, messages, question } = parsed.data;

  // Verify provider access
  const admin = isAdmin(session);
  const ownerWhere = admin
    ? { id: patientId, deletedAt: null }
    : {
        id: patientId,
        deletedAt: null,
        OR: [
          { providerId: session.user.id },
          { patientAccesses: { some: { providerId: session.user.id } } },
        ],
      };

  const patient = await db.patient.findFirst({
    where: ownerWhere,
    include: {
      vitals: {
        orderBy: { recordedAt: "desc" },
        take: 20,
      },
      screenings: {
        orderBy: { administeredAt: "desc" },
        take: 3,
      },
      carePlans: {
        where: { status: "active" },
        include: {
          tasks: {
            where: { status: { in: ["PENDING", "OVERDUE"] } },
            orderBy: { dueDate: "asc" },
            take: 5,
          },
        },
        take: 3,
      },
      timelineEvents: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!patient) {
    return Response.json({ error: "Patient not found" }, { status: 404 });
  }

  // Build compact clinical context (< 2000 chars)
  const age = differenceInYears(new Date(), new Date(patient.dateOfBirth));
  const riskFactors = (patient.riskFactors as unknown as RiskFactorResult[]) ?? [];
  const medHistory = (patient.medicalHistory as unknown as {
    preexistingConditions?: string[];
    previousPreterm?: boolean;
    bmi?: number;
  }) ?? {};
  const sdoh = (patient.socialDeterminants as unknown as Record<string, boolean>) ?? {};

  // Group vitals by type, last 4 per type
  const vitalsByType = new Map<string, typeof patient.vitals>();
  for (const v of patient.vitals) {
    const existing = vitalsByType.get(v.type) ?? [];
    if (existing.length < 4) {
      existing.push(v);
      vitalsByType.set(v.type, existing);
    }
  }

  const formatVital = (type: string, vitals: typeof patient.vitals): string => {
    if (vitals.length === 0) return "";
    const entries = vitals.map((v) => {
      const daysAgo = differenceInDays(new Date(), v.recordedAt);
      const val = v.value as Record<string, number | string>;
      if (type === "bp") return `${val.systolic}/${val.diastolic} (${daysAgo}d ago)`;
      return `${val.value}${val.unit ? ` ${val.unit}` : ""} (${daysAgo}d ago)`;
    });
    return `${type.toUpperCase()}: ${entries.join(", ")}`;
  };

  const vitalsLines = Array.from(vitalsByType.entries())
    .map(([type, vitals]) => formatVital(type, vitals))
    .filter(Boolean)
    .join("\n");

  const screeningLines = patient.screenings
    .map((s) => {
      const when = format(new Date(s.administeredAt), "MMM d");
      return `${s.type.toUpperCase()}: score=${s.score ?? "N/A"} result=${s.riskResult ?? "N/A"} (${when})`;
    })
    .join("\n");

  const taskLines = patient.carePlans
    .flatMap((cp) => cp.tasks)
    .map((t) => `- ${t.title} [${t.status}] due ${format(new Date(t.dueDate), "MMM d")}`)
    .join("\n");

  const recentEvents = patient.timelineEvents
    .map((e) => `${format(new Date(e.createdAt), "MMM d")}: ${e.title}`)
    .join("; ");

  const sdohFlags = Object.entries(sdoh)
    .filter(([, v]) => v === true)
    .map(([k]) => k)
    .join(", ");

  const topFactors = riskFactors
    .slice(0, 5)
    .map((f) => `${f.label}:${f.score}/${f.maxScore}`)
    .join(", ");

  const clinicalContext = `
PATIENT: ${patient.firstName} ${patient.lastName}, Age ${age}, ${patient.status}
GA: ${patient.gestationalAgeWeeks ? `${patient.gestationalAgeWeeks}w` : "N/A"} | EDD: ${patient.dueDate ? format(new Date(patient.dueDate), "MMM d, yyyy") : "N/A"}
Risk: ${patient.riskScore}/100 (${patient.riskLevel}) | Factors: ${topFactors || "none"}
History: BMI=${medHistory.bmi ?? "?"}, Conditions=${(medHistory.preexistingConditions ?? []).join(", ") || "none"}, PrevPreterm=${medHistory.previousPreterm ? "yes" : "no"}
SDOH: ${sdohFlags || "none"}
Last contact: ${patient.lastContactAt ? `${differenceInDays(new Date(), new Date(patient.lastContactAt))}d ago` : "never"}

VITALS (recent):
${vitalsLines || "None recorded"}

SCREENINGS:
${screeningLines || "None recorded"}

ACTIVE CARE TASKS:
${taskLines || "None pending"}

RECENT TIMELINE:
${recentEvents || "No recent events"}
`.trim();

  const fullSystemPrompt = `${SYSTEM_PROMPT}\n\nCLINICAL DATA:\n${clinicalContext}`;

  // Build message array for chat context
  const conversationHistory = messages.map((m) => `${m.role === "user" ? "Provider" : "Assistant"}: ${m.content}`).join("\n");
  const userMessage = conversationHistory
    ? `Previous conversation:\n${conversationHistory}\n\nNew question: ${question}`
    : question;

  const stream = generateStream({
    system: fullSystemPrompt,
    userMessage,
    maxTokens: 400,
  });

  if (!stream) {
    return Response.json({ error: "AI service unavailable" }, { status: 503 });
  }

  return toSSEResponse(stream);
}
