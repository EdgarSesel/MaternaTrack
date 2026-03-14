"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TaskStatus } from "@/generated/prisma/client";
import {
  requirePermission,
  PERMISSIONS,
  isAdmin,
  type AuthSession,
} from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";
import { createNotification } from "@/lib/notifications";

const completeTaskSchema = z.object({
  taskId: z.string().min(1),
  patientId: z.string().min(1),
});

const snoozeTaskSchema = z.object({
  taskId: z.string().min(1),
  patientId: z.string().min(1),
  snoozeUntil: z.string().datetime(),
  snoozeReason: z.string().max(200).optional(),
});

const sendMessageSchema = z.object({
  patientId: z.string().min(1),
  content: z.string().min(1).max(2000),
});

const saveAiSummarySchema = z.object({
  patientId: z.string().min(1),
  summary: z.string().min(1).max(5000),
});

async function getSessionOrThrow(): Promise<AuthSession> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session as AuthSession;
}

async function verifyPatientOwnership(
  patientId: string,
  session: AuthSession
): Promise<void> {
  const where = isAdmin(session)
    ? { id: patientId, deletedAt: null }
    : {
        id: patientId,
        deletedAt: null,
        OR: [
          { providerId: session.user.id },
          { patientAccesses: { some: { providerId: session.user.id } } },
        ],
      };
  const patient = await db.patient.findFirst({ where, select: { id: true } });
  if (!patient) throw new Error("Patient not found");
}

export async function completeTask(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.TASK_COMPLETE);

    const parsed = completeTaskSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { taskId, patientId } = parsed.data;
    await verifyPatientOwnership(patientId, session);

    await db.careTask.update({
      where: { id: taskId, patientId },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        completedBy: session.user.id,
      },
    });

    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "task_completed",
        title: "Care task completed",
        metadata: { taskId },
      },
    });

    logAudit({ actorId: session.user.id, action: "task.complete", resource: "CareTask", resourceId: taskId, metadata: { patientId } });

    revalidatePath(`/dashboard/patients/${patientId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to complete task" };
  }
}

export async function snoozeTask(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.TASK_SNOOZE);

    const parsed = snoozeTaskSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { taskId, patientId, snoozeUntil, snoozeReason } = parsed.data;
    await verifyPatientOwnership(patientId, session);

    await db.careTask.update({
      where: { id: taskId, patientId },
      data: {
        status: TaskStatus.SNOOZED,
        snoozeUntil: new Date(snoozeUntil),
        snoozeReason: snoozeReason ?? null,
      },
    });

    logAudit({ actorId: session.user.id, action: "task.snooze", resource: "CareTask", resourceId: taskId, metadata: { patientId, snoozeUntil } });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to snooze task" };
  }
}

export async function markTaskNotApplicable(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.TASK_COMPLETE);

    const parsed = completeTaskSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { taskId, patientId } = parsed.data;
    await verifyPatientOwnership(patientId, session);

    await db.careTask.update({
      where: { id: taskId, patientId },
      data: { status: TaskStatus.NOT_APPLICABLE },
    });

    logAudit({ actorId: session.user.id, action: "task.mark_na", resource: "CareTask", resourceId: taskId, metadata: { patientId } });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to update task" };
  }
}

export async function saveAiSummary(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.AI_RISK_SUMMARY);

    const parsed = saveAiSummarySchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { patientId, summary } = parsed.data;
    await verifyPatientOwnership(patientId, session);

    await db.patient.update({
      where: { id: patientId },
      data: { aiRiskSummary: summary, aiRiskSummaryAt: new Date() },
    });

    logAudit({ actorId: session.user.id, action: "ai.save_summary", resource: "Patient", resourceId: patientId });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to save summary" };
  }
}

export async function sendMessage(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.MESSAGE_SEND);

    const parsed = sendMessageSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { patientId, content: rawContent } = parsed.data;
    const content = sanitizeString(rawContent);
    await verifyPatientOwnership(patientId, session);

    await db.message.create({
      data: {
        patientId,
        senderType: "PROVIDER",
        senderId: session.user.id,
        content,
        messageType: "text",
      },
    });

    await db.patient.update({
      where: { id: patientId },
      data: {
        lastContactAt: new Date(),
        lastContactChannel: "message",
      },
    });

    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "message_sent",
        title: "Message sent to patient",
        metadata: { channel: "in-app" },
      },
    });

    logAudit({ actorId: session.user.id, action: "message.send", resource: "Message", metadata: { patientId } });

    // Notify the patient's portal user if one exists
    const portalUser = await db.patientUser.findUnique({
      where: { patientId },
      select: { id: true },
    });
    if (portalUser) {
      createNotification({
        recipientId: portalUser.id,
        recipientType: "patient",
        type: "new_message",
        title: "New message from your care team",
        body: content.slice(0, 100),
        patientId,
      });
    }

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to send message" };
  }
}

const createPatientSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().min(1),
  status: z.enum(["PRECONCEPTION", "PREGNANT", "POSTPARTUM", "INACTIVE"]).default("PREGNANT"),
  gestationalAgeWeeks: z.coerce.number().int().min(0).max(45).optional().nullable(),
  insuranceType: z.string().max(100).optional(),
  assignToProviderId: z.string().min(1).optional(),
});

export async function createPatient(
  input: unknown
): Promise<{ success: boolean; patientId?: string; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.PATIENT_WRITE);

    const parsed = createPatientSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

    const { firstName, lastName, dateOfBirth, status, gestationalAgeWeeks, insuranceType, assignToProviderId } = parsed.data;

    // Admins can assign to any provider; others always get assigned to themselves
    const providerId = isAdmin(session) && assignToProviderId ? assignToProviderId : session.user.id;

    const patient = await db.patient.create({
      data: {
        providerId,
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        status,
        gestationalAgeWeeks: gestationalAgeWeeks ?? null,
        insuranceType: insuranceType ?? null,
      },
    });

    await db.timelineEvent.create({
      data: {
        patientId: patient.id,
        eventType: "care_plan_update",
        title: "Patient enrolled",
        metadata: { source: "manual", addedBy: session.user.id },
      },
    });

    logAudit({
      actorId: session.user.id,
      action: "patient.create",
      resource: "Patient",
      resourceId: patient.id,
      metadata: { firstName, lastName, status, providerId },
    });

    revalidatePath("/dashboard");
    return { success: true, patientId: patient.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to create patient" };
  }
}

const createAdHocTaskSchema = z.object({
  patientId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  dueDate: z.string().min(1),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

export async function createAdHocTask(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.TASK_COMPLETE);

    const parsed = createAdHocTaskSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

    const { patientId, title, description, dueDate, priority } = parsed.data;
    await verifyPatientOwnership(patientId, session);

    await db.careTask.create({
      data: {
        patientId,
        title,
        description: description ?? null,
        dueDate: new Date(dueDate),
        priority,
        status: "PENDING",
      },
    });

    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "care_plan_update",
        title: `Task added: ${title}`,
        metadata: { source: "manual", addedBy: session.user.id },
      },
    });

    logAudit({
      actorId: session.user.id,
      action: "task.create",
      resource: "CareTask",
      metadata: { patientId, title, priority },
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to create task" };
  }
}

const updatePatientSchema = z.object({
  patientId: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  status: z.enum(["PRECONCEPTION", "PREGNANT", "POSTPARTUM", "INACTIVE"]),
  gestationalAgeWeeks: z.coerce.number().int().min(0).max(45).optional().nullable(),
  insuranceType: z.string().max(100).optional().nullable(),
});

export async function updatePatient(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.PATIENT_WRITE);

    const parsed = updatePatientSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

    const { patientId, firstName, lastName, dateOfBirth, dueDate, status, gestationalAgeWeeks, insuranceType } = parsed.data;
    await verifyPatientOwnership(patientId, session);

    await db.patient.update({
      where: { id: patientId },
      data: {
        firstName,
        lastName,
        dateOfBirth: new Date(dateOfBirth),
        dueDate: dueDate ? new Date(dueDate) : null,
        status,
        gestationalAgeWeeks: gestationalAgeWeeks ?? null,
        insuranceType: insuranceType ?? null,
      },
    });

    logAudit({
      actorId: session.user.id,
      action: "patient.update",
      resource: "Patient",
      resourceId: patientId,
      metadata: { firstName, lastName, status },
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to update patient" };
  }
}

export async function markMessagesRead(
  patientId: string
): Promise<{ success: boolean }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.PATIENT_READ);
    await verifyPatientOwnership(patientId, session);

    await db.message.updateMany({
      where: { patientId, senderType: "PATIENT", readAt: null },
      data: { readAt: new Date() },
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false };
  }
}

const bulkTaskSchema = z.object({
  taskIds: z.array(z.string().min(1)).min(1).max(50),
  patientId: z.string().min(1),
});

export async function bulkCompleteTasks(
  input: unknown
): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.TASK_COMPLETE);

    const parsed = bulkTaskSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { taskIds, patientId } = parsed.data;
    await verifyPatientOwnership(patientId, session);

    const result = await db.careTask.updateMany({
      where: {
        id: { in: taskIds },
        patientId,
        status: { in: ["PENDING", "OVERDUE"] },
      },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
        completedBy: session.user.id,
      },
    });

    if (result.count > 0) {
      await db.timelineEvent.create({
        data: {
          patientId,
          eventType: "task_completed",
          title: `${result.count} task${result.count > 1 ? "s" : ""} completed`,
          description: `Bulk completed by ${session.user.name ?? "provider"}`,
          metadata: { taskIds, count: result.count } as Parameters<typeof db.timelineEvent.create>[0]["data"]["metadata"],
        },
      });
    }

    logAudit({
      actorId: session.user.id,
      action: "task.bulkComplete",
      resource: "CareTask",
      resourceId: patientId,
      metadata: { taskIds, count: result.count },
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true, updatedCount: result.count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to complete tasks" };
  }
}

export async function bulkMarkTasksNotApplicable(
  input: unknown
): Promise<{ success: boolean; error?: string; updatedCount?: number }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.TASK_COMPLETE);

    const parsed = bulkTaskSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { taskIds, patientId } = parsed.data;
    await verifyPatientOwnership(patientId, session);

    const result = await db.careTask.updateMany({
      where: {
        id: { in: taskIds },
        patientId,
        status: { in: ["PENDING", "OVERDUE"] },
      },
      data: { status: TaskStatus.NOT_APPLICABLE },
    });

    logAudit({
      actorId: session.user.id,
      action: "task.bulkMarkNA",
      resource: "CareTask",
      resourceId: patientId,
      metadata: { taskIds, count: result.count },
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true, updatedCount: result.count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to update tasks" };
  }
}

// ── Patient Access / Multi-provider sharing ──────────────────────────────────

export async function searchPatientsForLinking(query: string): Promise<{
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  status: string;
  riskLevel: string;
  providerName: string;
}[]> {
  const session = await getSessionOrThrow();
  requirePermission(session, PERMISSIONS.PATIENT_READ);
  const providerId = session.user.id;

  const patients = await db.patient.findMany({
    where: {
      deletedAt: null,
      // Exclude own patients and already-linked patients
      NOT: [
        { providerId },
        { patientAccesses: { some: { providerId } } },
      ],
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      status: true,
      riskLevel: true,
      provider: { select: { name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 20,
  });

  return patients.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    dateOfBirth: p.dateOfBirth,
    status: p.status,
    riskLevel: p.riskLevel,
    providerName: p.provider.name,
  }));
}

const linkPatientSchema = z.object({
  patientId: z.string().min(1),
  role: z.enum(["secondary", "consulting", "covering"]),
});

export async function linkExistingPatient(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.PATIENT_READ);

    const parsed = linkPatientSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { patientId, role } = parsed.data;
    const providerId = session.user.id;

    // Confirm patient exists
    const patient = await db.patient.findFirst({
      where: { id: patientId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) return { success: false, error: "Patient not found" };

    await db.patientAccess.upsert({
      where: { patientId_providerId: { patientId, providerId } },
      create: { patientId, providerId, role, grantedById: providerId },
      update: { role },
    });

    logAudit({
      actorId: providerId,
      action: "patient.link",
      resource: "Patient",
      resourceId: patientId,
      metadata: { role },
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to link patient" };
  }
}

export async function unlinkPatient(
  patientId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    const providerId = session.user.id;

    await db.patientAccess.deleteMany({
      where: { patientId, providerId },
    });

    logAudit({
      actorId: providerId,
      action: "patient.unlink",
      resource: "Patient",
      resourceId: patientId,
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to unlink patient" };
  }
}
