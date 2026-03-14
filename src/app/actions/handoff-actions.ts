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
  const patient = await db.patient.findFirst({ where, select: { id: true, firstName: true, lastName: true } });
  if (!patient) throw new Error("Patient not found");
  return patient;
}

const createHandoffSchema = z.object({
  patientId: z.string().min(1),
  toProviderId: z.string().min(1),
  summary: z.string().min(1).max(2000),
  openConcerns: z.string().max(2000).optional(),
});

export async function createHandoff(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.PATIENT_WRITE);

    const parsed = createHandoffSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { patientId, toProviderId, summary, openConcerns } = parsed.data;

    // Must own patient (or admin)
    const patient = await verifyPatientAccess(patientId, session);

    // Gather pending tasks for context
    const pendingTasks = await db.careTask.findMany({
      where: { patientId, status: { in: ["PENDING", "OVERDUE"] }, deletedAt: null },
      select: { title: true, dueDate: true, priority: true, status: true },
      orderBy: { dueDate: "asc" },
      take: 20,
    });

    const toProvider = await db.provider.findUnique({
      where: { id: toProviderId },
      select: { id: true, name: true },
    });
    if (!toProvider) return { success: false, error: "Target provider not found" };

    const handoff = await db.handoff.create({
      data: {
        patientId,
        fromProviderId: session.user.id,
        toProviderId,
        summary: sanitizeString(summary),
        openConcerns: openConcerns ? sanitizeString(openConcerns) : null,
        pendingTasks: pendingTasks as Parameters<typeof db.handoff.create>[0]["data"]["pendingTasks"],
      },
    });

    // Notify receiving provider
    await createNotification({
      recipientId: toProviderId,
      recipientType: "provider",
      type: "care_gap",
      title: "Patient Handoff",
      body: `${session.user.name} has handed off ${patient.firstName} ${patient.lastName} to you.`,
      patientId,
      resourceId: handoff.id,
    });

    logAudit({
      actorId: session.user.id,
      action: "handoff.create",
      resource: "Handoff",
      resourceId: handoff.id,
      metadata: { patientId, toProviderId },
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create handoff" };
  }
}

export async function acceptHandoff(
  handoffId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();

    const handoff = await db.handoff.findUnique({
      where: { id: handoffId },
      include: { patient: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!handoff) return { success: false, error: "Handoff not found" };
    if (handoff.toProviderId !== session.user.id) return { success: false, error: "Unauthorized" };
    if (handoff.acceptedAt) return { success: false, error: "Already accepted" };

    await db.$transaction([
      // Mark handoff accepted
      db.handoff.update({ where: { id: handoffId }, data: { acceptedAt: new Date() } }),
      // Reassign patient to new provider
      db.patient.update({ where: { id: handoff.patientId }, data: { providerId: session.user.id } }),
    ]);

    logAudit({
      actorId: session.user.id,
      action: "handoff.accept",
      resource: "Handoff",
      resourceId: handoffId,
      metadata: { patientId: handoff.patientId, fromProviderId: handoff.fromProviderId },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/patients/${handoff.patientId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to accept handoff" };
  }
}
