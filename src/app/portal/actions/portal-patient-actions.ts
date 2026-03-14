"use server";

import { db } from "@/lib/db";
import { requirePortalSession } from "@/lib/portal-session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sanitizeString } from "@/lib/sanitize";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { alertProviderNewPatientMessage } from "@/lib/alert-rules";

// ─── Unified vital submission ─────────────────────────────────────────────

export type VitalType =
  | "bp" | "weight" | "glucose" | "heart_rate"
  | "temperature" | "fetal_movement" | "oxygen_saturation" | "urine_protein";

const bpSchema = z.object({ type: z.literal("bp"), patientId: z.string().min(1), systolic: z.coerce.number().int().min(50).max(300), diastolic: z.coerce.number().int().min(30).max(200), recordedAt: z.string().optional() });
const weightSchema = z.object({ type: z.literal("weight"), patientId: z.string().min(1), value: z.coerce.number().positive().max(1000), unit: z.enum(["lbs", "kg"]), recordedAt: z.string().optional() });
const glucoseSchema = z.object({ type: z.literal("glucose"), patientId: z.string().min(1), value: z.coerce.number().positive().max(700), context: z.enum(["fasting", "post_meal_1h", "post_meal_2h", "bedtime", "random"]).optional(), recordedAt: z.string().optional() });
const heartRateSchema = z.object({ type: z.literal("heart_rate"), patientId: z.string().min(1), value: z.coerce.number().int().min(20).max(300), recordedAt: z.string().optional() });
const temperatureSchema = z.object({ type: z.literal("temperature"), patientId: z.string().min(1), value: z.coerce.number().min(85).max(115), unit: z.enum(["F", "C"]), recordedAt: z.string().optional() });
const fetalSchema = z.object({ type: z.literal("fetal_movement"), patientId: z.string().min(1), count: z.coerce.number().int().min(0).max(200), period_hours: z.coerce.number().min(0.5).max(4), recordedAt: z.string().optional() });
const spO2Schema = z.object({ type: z.literal("oxygen_saturation"), patientId: z.string().min(1), value: z.coerce.number().min(50).max(100), recordedAt: z.string().optional() });
const urineSchema = z.object({ type: z.literal("urine_protein"), patientId: z.string().min(1), result: z.enum(["negative", "trace", "1+", "2+", "3+", "4+"]), recordedAt: z.string().optional() });

const vitalInputSchema = z.discriminatedUnion("type", [bpSchema, weightSchema, glucoseSchema, heartRateSchema, temperatureSchema, fetalSchema, spO2Schema, urineSchema]);

async function checkWeightChange(patientId: string, newValue: number, newUnit: string): Promise<string | null> {
  const last = await db.vital.findFirst({ where: { patientId, type: "weight" }, orderBy: { recordedAt: "desc" } });
  if (!last) return null;
  const prev = last.value as { value: number; unit: string };
  const daysDiff = (Date.now() - new Date(last.recordedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff > 14) return null;
  const toLbs = (v: number, u: string) => u === "kg" ? v * 2.205 : v;
  const diff = Math.abs(toLbs(newValue, newUnit) - toLbs(prev.value, prev.unit));
  if (diff > 30) return `Weight differs ${diff.toFixed(0)} lbs from last reading (${prev.value} ${prev.unit}). Please double-check.`;
  return null;
}

export async function portalSubmitVital(input: unknown): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requirePortalSession();
    const parsed = vitalInputSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input: " + parsed.error.issues[0]?.message };

    const data = parsed.data;
    await verifyPatientOwnership(data.patientId, session.patientId);

    if (data.type === "weight") {
      const err = await checkWeightChange(data.patientId, data.value, data.unit);
      if (err) return { success: false, error: err };
    }

    const at = data.recordedAt ? new Date(data.recordedAt) : new Date();
    let value: Record<string, unknown>;
    let title: string;

    switch (data.type) {
      case "bp":
        value = { systolic: data.systolic, diastolic: data.diastolic };
        title = `Blood pressure: ${data.systolic}/${data.diastolic} mmHg`; break;
      case "weight":
        value = { value: data.value, unit: data.unit };
        title = `Weight: ${data.value} ${data.unit}`; break;
      case "glucose":
        value = { value: data.value, ...(data.context ? { context: data.context } : {}) };
        title = `Blood glucose: ${data.value} mg/dL${data.context ? ` (${data.context.replace(/_/g, " ")})` : ""}`; break;
      case "heart_rate":
        value = { value: data.value };
        title = `Heart rate: ${data.value} bpm`; break;
      case "temperature":
        value = { value: data.value, unit: data.unit };
        title = `Temperature: ${data.value}°${data.unit}`; break;
      case "fetal_movement":
        value = { count: data.count, period_hours: data.period_hours };
        title = `Fetal kicks: ${data.count} in ${data.period_hours}h`; break;
      case "oxygen_saturation":
        value = { value: data.value };
        title = `Oxygen saturation: ${data.value}%`; break;
      case "urine_protein":
        value = { result: data.result };
        title = `Urine protein: ${data.result}`; break;
    }

    await db.vital.create({ data: { patientId: data.patientId, type: data.type, value: value as Parameters<typeof db.vital.create>[0]["data"]["value"], recordedAt: at, source: "patient_reported" } });
    await db.timelineEvent.create({ data: { patientId: data.patientId, eventType: "vital_recorded", title, metadata: { type: data.type, source: "portal" } } });
    logAudit({ actorId: session.userId, actorType: "patient", action: "portal.vital.submit", resource: "Vital", metadata: { patientId: data.patientId, type: data.type } });

    revalidatePath("/portal/vitals");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to save reading" };
  }
}

// ─── Messages ─────────────────────────────────────────────────────────────

const sendMessageSchema = z.object({
  patientId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

const bpVitalSchema = z.object({
  patientId: z.string().min(1),
  systolic: z.coerce.number().int().min(50).max(300),
  diastolic: z.coerce.number().int().min(30).max(200),
  recordedAt: z.string().datetime().optional(),
});

const weightVitalSchema = z.object({
  patientId: z.string().min(1),
  value: z.coerce.number().positive().max(1000),
  unit: z.enum(["lbs", "kg"]),
  recordedAt: z.string().datetime().optional(),
});

const glucoseVitalSchema = z.object({
  patientId: z.string().min(1),
  value: z.coerce.number().positive().max(1000),
  recordedAt: z.string().datetime().optional(),
});

async function verifyPatientOwnership(patientId: string, sessionPatientId: string) {
  if (patientId !== sessionPatientId) throw new Error("Forbidden");
}

export async function portalSendMessage(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requirePortalSession();

    const parsed = sendMessageSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { patientId, content: rawContent } = parsed.data;
    await verifyPatientOwnership(patientId, session.patientId);
    const content = sanitizeString(rawContent);

    await db.message.create({
      data: {
        patientId,
        senderType: "PATIENT",
        senderId: session.userId,
        content,
        messageType: "text",
      },
    });

    await db.patient.update({
      where: { id: patientId },
      data: { lastContactAt: new Date(), lastContactChannel: "portal_message" },
    });

    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "message_sent",
        title: "Patient sent a message via portal",
        metadata: { channel: "portal" },
      },
    });

    logAudit({
      actorId: session.userId,
      actorType: "patient",
      action: "portal.message.send",
      resource: "Message",
      metadata: { patientId },
    });

    // Notify the provider about the patient's message
    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: { providerId: true, firstName: true, lastName: true },
    });
    if (patient) {
      const provider = await db.provider.findUnique({
        where: { id: patient.providerId },
        select: { email: true, name: true },
      });

      alertProviderNewPatientMessage({
        patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
        providerId: patient.providerId,
        providerEmail: provider?.email ?? "",
        providerName: provider?.name ?? "Provider",
        messagePreview: content,
      });
    }

    revalidatePath("/portal/messages");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "Forbidden") return { success: false, error: "Forbidden" };
    return { success: false, error: "Failed to send message" };
  }
}

export async function portalSubmitBloodPressure(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requirePortalSession();

    const parsed = bpVitalSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { patientId, systolic, diastolic, recordedAt } = parsed.data;
    await verifyPatientOwnership(patientId, session.patientId);

    const at = recordedAt ? new Date(recordedAt) : new Date();
    await db.vital.create({
      data: {
        patientId,
        type: "bp",
        value: { systolic, diastolic },
        recordedAt: at,
        source: "patient_reported",
      },
    });

    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "vital_recorded",
        title: `Blood pressure logged: ${systolic}/${diastolic} mmHg`,
        metadata: { type: "bp", systolic, diastolic, source: "portal" },
      },
    });

    logAudit({
      actorId: session.userId,
      actorType: "patient",
      action: "portal.vital.submit",
      resource: "Vital",
      metadata: { patientId, type: "bp" },
    });

    revalidatePath("/portal/vitals");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to save reading" };
  }
}

export async function portalSubmitWeight(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requirePortalSession();

    const parsed = weightVitalSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { patientId, value, unit, recordedAt } = parsed.data;
    await verifyPatientOwnership(patientId, session.patientId);

    const at = recordedAt ? new Date(recordedAt) : new Date();
    await db.vital.create({
      data: {
        patientId,
        type: "weight",
        value: { value, unit },
        recordedAt: at,
        source: "patient_reported",
      },
    });

    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "vital_recorded",
        title: `Weight logged: ${value} ${unit}`,
        metadata: { type: "weight", value, unit, source: "portal" },
      },
    });

    revalidatePath("/portal/vitals");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to save reading" };
  }
}

export async function portalSubmitGlucose(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requirePortalSession();

    const parsed = glucoseVitalSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { patientId, value, recordedAt } = parsed.data;
    await verifyPatientOwnership(patientId, session.patientId);

    const at = recordedAt ? new Date(recordedAt) : new Date();
    await db.vital.create({
      data: {
        patientId,
        type: "glucose",
        value: { value },
        recordedAt: at,
        source: "patient_reported",
      },
    });

    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "vital_recorded",
        title: `Glucose logged: ${value} mg/dL`,
        metadata: { type: "glucose", value, source: "portal" },
      },
    });

    revalidatePath("/portal/vitals");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to save reading" };
  }
}
