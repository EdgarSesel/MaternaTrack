"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAdmin, requirePermission, PERMISSIONS, type AuthSession } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { sanitizeString } from "@/lib/sanitize";

async function getSessionOrThrow(): Promise<AuthSession> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session as AuthSession;
}

async function verifyPatientAccess(patientId: string, session: AuthSession) {
  const where = isAdmin(session)
    ? { id: patientId, deletedAt: null }
    : { id: patientId, providerId: session.user.id, deletedAt: null };
  const patient = await db.patient.findFirst({
    where,
    select: { id: true, firstName: true, lastName: true, status: true },
  });
  if (!patient) throw new Error("Patient not found");
  return patient;
}

const recordBirthSchema = z.object({
  patientId: z.string().min(1),
  firstName: z.string().max(100).optional(),
  dateOfBirth: z.string().datetime().optional(),
  birthWeightGrams: z.number().int().min(200).max(8000).optional(),
  gestationalAgeAtBirth: z.number().int().min(20).max(44).optional(),
  apgarScore1Min: z.number().int().min(0).max(10).optional(),
  apgarScore5Min: z.number().int().min(0).max(10).optional(),
  deliveryType: z.enum(["vaginal", "cesarean", "vbac"]).optional(),
  nicuAdmission: z.boolean().default(false),
  nicuDays: z.number().int().min(0).max(365).optional(),
  feedingType: z.enum(["breast", "formula", "mixed"]).optional(),
  notes: z.string().max(2000).optional(),
});

export async function recordBirth(
  input: unknown
): Promise<{ success: boolean; babyId?: string; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.PATIENT_WRITE);

    const parsed = recordBirthSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { patientId, ...data } = parsed.data;
    const patient = await verifyPatientAccess(patientId, session);

    const baby = await db.baby.create({
      data: {
        patientId,
        firstName: data.firstName ? sanitizeString(data.firstName) : null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        birthWeightGrams: data.birthWeightGrams ?? null,
        gestationalAgeAtBirth: data.gestationalAgeAtBirth ?? null,
        apgarScore1Min: data.apgarScore1Min ?? null,
        apgarScore5Min: data.apgarScore5Min ?? null,
        deliveryType: data.deliveryType ?? null,
        nicuAdmission: data.nicuAdmission,
        nicuDays: data.nicuDays ?? null,
        feedingType: data.feedingType ?? null,
        notes: data.notes ? sanitizeString(data.notes) : null,
      },
    });

    // Auto-update patient status to POSTPARTUM if not already
    if (patient.status !== "POSTPARTUM") {
      await db.patient.update({
        where: { id: patientId },
        data: { status: "POSTPARTUM" },
      });
    }

    // Create timeline event
    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "care_plan_update",
        title: "Birth recorded",
        description: data.nicuAdmission
          ? `Baby admitted to NICU. Delivery: ${data.deliveryType ?? "unspecified"}.`
          : `Baby born. Delivery: ${data.deliveryType ?? "unspecified"}.`,
        metadata: {
          babyId: baby.id,
          birthWeightGrams: data.birthWeightGrams,
          gestationalAgeAtBirth: data.gestationalAgeAtBirth,
          nicuAdmission: data.nicuAdmission,
        } as Parameters<typeof db.timelineEvent.create>[0]["data"]["metadata"],
      },
    });

    // Notify if NICU admission
    if (data.nicuAdmission) {
      await createNotification({
        recipientId: session.user.id,
        recipientType: "provider",
        type: "risk_escalation",
        title: "NICU Admission",
        body: `${patient.firstName} ${patient.lastName}'s baby has been admitted to the NICU. Consider scheduling follow-up.`,
        patientId,
        resourceId: baby.id,
      });
    }

    logAudit({
      actorId: session.user.id,
      action: "baby.record_birth",
      resource: "Baby",
      resourceId: baby.id,
      metadata: { patientId },
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true, babyId: baby.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to record birth" };
  }
}

const neonatalVitalSchema = z.object({
  babyId: z.string().min(1),
  patientId: z.string().min(1),
  type: z.enum(["weight", "length", "head_circumference", "bilirubin", "temperature"]),
  value: z.number().positive(),
  unit: z.string().max(20),
  recordedAt: z.string().datetime(),
});

export async function recordNeonatalVital(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.PATIENT_WRITE);

    const parsed = neonatalVitalSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { babyId, patientId, type, value, unit, recordedAt } = parsed.data;

    await verifyPatientAccess(patientId, session);

    await db.neonatalVital.create({
      data: {
        babyId,
        type,
        value: { value, unit } as Parameters<typeof db.neonatalVital.create>[0]["data"]["value"],
        recordedAt: new Date(recordedAt),
      },
    });

    logAudit({
      actorId: session.user.id,
      action: "baby.record_vital",
      resource: "NeonatalVital",
      metadata: { babyId, patientId, type },
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to record vital" };
  }
}

const updateBabySchema = z.object({
  babyId: z.string().min(1),
  patientId: z.string().min(1),
  nicuDays: z.number().int().min(0).max(365).optional(),
  dischargedAt: z.string().datetime().optional(),
  feedingType: z.enum(["breast", "formula", "mixed"]).optional(),
  notes: z.string().max(2000).optional(),
});

export async function updateBabyStatus(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.PATIENT_WRITE);

    const parsed = updateBabySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { babyId, patientId, nicuDays, dischargedAt, feedingType, notes } = parsed.data;

    await verifyPatientAccess(patientId, session);

    await db.baby.update({
      where: { id: babyId },
      data: {
        nicuDays: nicuDays ?? undefined,
        dischargedAt: dischargedAt ? new Date(dischargedAt) : undefined,
        feedingType: feedingType ?? undefined,
        notes: notes ? sanitizeString(notes) : undefined,
      },
    });

    logAudit({
      actorId: session.user.id,
      action: "baby.update",
      resource: "Baby",
      resourceId: babyId,
      metadata: { patientId },
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update" };
  }
}
