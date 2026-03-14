"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, PERMISSIONS, isAdmin, type AuthSession } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const noteSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional().nullable(),
  subjective: z.string().max(5000).default(""),
  objective: z.string().max(5000).default(""),
  assessment: z.string().max(5000).default(""),
  plan: z.string().max(5000).default(""),
});

const updateNoteSchema = noteSchema.extend({
  noteId: z.string().min(1),
});

const signNoteSchema = z.object({
  noteId: z.string().min(1),
  patientId: z.string().min(1),
});

async function getSessionOrThrow(): Promise<AuthSession> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session as AuthSession;
}

async function verifyPatientOwnership(patientId: string, session: AuthSession): Promise<void> {
  const where = isAdmin(session)
    ? { id: patientId, deletedAt: null }
    : { id: patientId, providerId: session.user.id, deletedAt: null };
  const patient = await db.patient.findFirst({ where, select: { id: true } });
  if (!patient) throw new Error("Patient not found or access denied");
}

export async function createVisitNote(
  input: unknown
): Promise<{ success: boolean; error?: string; noteId?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.PATIENT_WRITE);

    const parsed = noteSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

    const { patientId, appointmentId, subjective, objective, assessment, plan } = parsed.data;
    await verifyPatientOwnership(patientId, session);

    const note = await db.visitNote.create({
      data: {
        patientId,
        providerId: session.user.id,
        appointmentId: appointmentId ?? null,
        subjective,
        objective,
        assessment,
        plan,
      },
    });

    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "care_plan_update",
        title: "Visit note created",
        description: `SOAP note by ${session.user.name ?? "provider"}`,
        metadata: { visitNoteId: note.id } as Parameters<typeof db.timelineEvent.create>[0]["data"]["metadata"],
      },
    });

    logAudit({
      actorId: session.user.id,
      action: "visit_note.create",
      resource: "VisitNote",
      resourceId: note.id,
      metadata: { patientId },
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true, noteId: note.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to create visit note" };
  }
}

export async function updateVisitNote(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.PATIENT_WRITE);

    const parsed = updateNoteSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { noteId, patientId, subjective, objective, assessment, plan } = parsed.data;
    await verifyPatientOwnership(patientId, session);

    // Verify provider owns the note (or is admin)
    const noteWhere = isAdmin(session)
      ? { id: noteId, patientId }
      : { id: noteId, patientId, providerId: session.user.id };

    const existing = await db.visitNote.findFirst({ where: noteWhere, select: { id: true, signedAt: true } });
    if (!existing) return { success: false, error: "Note not found" };
    if (existing.signedAt) return { success: false, error: "Cannot edit a signed note" };

    await db.visitNote.update({
      where: { id: noteId },
      data: { subjective, objective, assessment, plan },
    });

    logAudit({
      actorId: session.user.id,
      action: "visit_note.update",
      resource: "VisitNote",
      resourceId: noteId,
      metadata: { patientId },
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to update visit note" };
  }
}

export async function signVisitNote(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.PATIENT_WRITE);

    const parsed = signNoteSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { noteId, patientId } = parsed.data;
    await verifyPatientOwnership(patientId, session);

    const noteWhere = isAdmin(session)
      ? { id: noteId, patientId }
      : { id: noteId, patientId, providerId: session.user.id };

    const existing = await db.visitNote.findFirst({ where: noteWhere, select: { id: true, signedAt: true } });
    if (!existing) return { success: false, error: "Note not found" };
    if (existing.signedAt) return { success: false, error: "Note already signed" };

    await db.visitNote.update({
      where: { id: noteId },
      data: { signedAt: new Date() },
    });

    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "care_plan_update",
        title: "Visit note signed",
        description: `Signed by ${session.user.name ?? "provider"}`,
        metadata: { visitNoteId: noteId } as Parameters<typeof db.timelineEvent.create>[0]["data"]["metadata"],
      },
    });

    logAudit({
      actorId: session.user.id,
      action: "visit_note.sign",
      resource: "VisitNote",
      resourceId: noteId,
      metadata: { patientId },
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to sign note" };
  }
}

export async function getPatientVisitNotes(patientId: string) {
  const session = await getSessionOrThrow();
  requirePermission(session, PERMISSIONS.PATIENT_READ);
  const where = isAdmin(session)
    ? { patientId }
    : { patientId, providerId: session.user.id };
  return db.visitNote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { provider: { select: { name: true, role: true } } },
  });
}
