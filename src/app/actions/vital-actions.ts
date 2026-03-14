"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, PERMISSIONS, isAdmin } from "@/lib/rbac";
import type { AuthSession } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { evaluateVitalTriggers } from "@/lib/protocol-triggers";
import { evaluateCriticalVitalThresholds } from "@/lib/vital-thresholds";

export type VitalType =
  | "bp" | "weight" | "glucose" | "heart_rate"
  | "temperature" | "fetal_movement" | "oxygen_saturation" | "urine_protein";

const bpSchema = z.object({ type: z.literal("bp"), patientId: z.string().min(1), systolic: z.coerce.number().int().min(50).max(300), diastolic: z.coerce.number().int().min(30).max(200) });
const weightSchema = z.object({ type: z.literal("weight"), patientId: z.string().min(1), value: z.coerce.number().positive().max(1000), unit: z.enum(["lbs", "kg"]) });
const glucoseSchema = z.object({ type: z.literal("glucose"), patientId: z.string().min(1), value: z.coerce.number().positive().max(700), context: z.enum(["fasting", "post_meal_1h", "post_meal_2h", "bedtime", "random"]).optional() });
const heartRateSchema = z.object({ type: z.literal("heart_rate"), patientId: z.string().min(1), value: z.coerce.number().int().min(20).max(300) });
const temperatureSchema = z.object({ type: z.literal("temperature"), patientId: z.string().min(1), value: z.coerce.number().min(85).max(115), unit: z.enum(["F", "C"]) });
const fetalSchema = z.object({ type: z.literal("fetal_movement"), patientId: z.string().min(1), count: z.coerce.number().int().min(0).max(200), period_hours: z.coerce.number().min(0.5).max(4) });
const spO2Schema = z.object({ type: z.literal("oxygen_saturation"), patientId: z.string().min(1), value: z.coerce.number().min(50).max(100) });
const urineSchema = z.object({ type: z.literal("urine_protein"), patientId: z.string().min(1), result: z.enum(["negative", "trace", "1+", "2+", "3+", "4+"]) });

const vitalInputSchema = z.discriminatedUnion("type", [bpSchema, weightSchema, glucoseSchema, heartRateSchema, temperatureSchema, fetalSchema, spO2Schema, urineSchema]);

export async function recordVital(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    requirePermission(session as AuthSession, PERMISSIONS.PATIENT_WRITE);

    const parsed = vitalInputSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

    const data = parsed.data;
    const patientId = data.patientId;

    // Verify ownership
    const where = isAdmin(session as AuthSession)
      ? { id: patientId, deletedAt: null }
      : { id: patientId, providerId: session.user.id, deletedAt: null };
    const patient = await db.patient.findFirst({ where, select: { id: true } });
    if (!patient) return { success: false, error: "Patient not found" };

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
        title = `Blood glucose: ${data.value} mg/dL`; break;
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

    await db.vital.create({
      data: {
        patientId,
        type: data.type,
        value: value as Parameters<typeof db.vital.create>[0]["data"]["value"],
        recordedAt: new Date(),
        source: "manual",
      },
    });

    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "vital_recorded",
        title,
        metadata: { type: data.type, source: "provider", recordedBy: session.user.id },
      },
    });

    logAudit({
      actorId: session.user.id,
      action: "vital.record",
      resource: "Vital",
      metadata: { patientId, type: data.type },
    });

    // Fire-and-forget: evaluate protocol auto-activation triggers
    evaluateVitalTriggers({
      patientId,
      providerId: session.user.id,
      vitalType: data.type,
      value,
    });

    // Fire-and-forget: check critical vital thresholds and escalate immediately
    void evaluateCriticalVitalThresholds({
      patientId,
      providerId: session.user.id,
      vitalType: data.type,
      value,
    }).catch(() => {
      // Threshold evaluation must never break vital recording
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to record vital" };
  }
}
