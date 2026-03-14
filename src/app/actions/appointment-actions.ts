"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, PERMISSIONS, isAdmin } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import type { AuthSession } from "@/lib/rbac";

const APPOINTMENT_TYPES = [
  "initial_intake",
  "routine_prenatal",
  "follow_up",
  "urgent",
  "postpartum",
] as const;

const APPOINTMENT_STATUSES = [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
] as const;

const RECURRENCE_RULES = ["weekly", "biweekly", "monthly"] as const;

const createSchema = z.object({
  patientId: z.string().min(1),
  type: z.enum(APPOINTMENT_TYPES),
  scheduledAt: z.string().datetime(),
  duration: z.coerce.number().int().min(15).max(180).default(30),
  notes: z.string().max(1000).optional(),
  recurrenceRule: z.enum(RECURRENCE_RULES).optional(),
  recurrenceCount: z.coerce.number().int().min(2).max(52).optional(),
});

const cancelSeriesSchema = z.object({
  seriesId: z.string().min(1),
  patientId: z.string().min(1),
});

const updateStatusSchema = z.object({
  appointmentId: z.string().min(1),
  patientId: z.string().min(1),
  status: z.enum(APPOINTMENT_STATUSES),
  notes: z.string().max(1000).optional(),
});

const rescheduleSchema = z.object({
  appointmentId: z.string().min(1),
  patientId: z.string().min(1),
  scheduledAt: z.string().datetime(),
  duration: z.coerce.number().int().min(15).max(180).default(30),
  notes: z.string().max(1000).optional(),
});

async function getSessionOrThrow(): Promise<AuthSession> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session as AuthSession;
}

async function verifyPatientAccess(patientId: string, session: AuthSession) {
  const where = isAdmin(session)
    ? { id: patientId, deletedAt: null }
    : { id: patientId, providerId: session.user.id, deletedAt: null };
  const patient = await db.patient.findFirst({ where, select: { id: true } });
  if (!patient) throw new Error("Patient not found");
}

export async function createAppointment(
  input: unknown,
): Promise<{ success: boolean; error?: string; appointmentId?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.APPOINTMENT_CREATE);

    const parsed = createSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { patientId, type, scheduledAt, duration, notes, recurrenceRule, recurrenceCount } = parsed.data;
    await verifyPatientAccess(patientId, session);

    const firstDate = new Date(scheduledAt);

    // Build list of dates to schedule
    const dates: Date[] = [firstDate];
    if (recurrenceRule && recurrenceCount && recurrenceCount > 1) {
      const intervalDays = recurrenceRule === "weekly" ? 7 : recurrenceRule === "biweekly" ? 14 : 30;
      for (let i = 1; i < recurrenceCount; i++) {
        const d = new Date(firstDate);
        d.setDate(d.getDate() + i * intervalDays);
        dates.push(d);
      }
    }

    const seriesId = recurrenceRule ? `series-${Date.now()}-${Math.random().toString(36).slice(2)}` : undefined;
    const recurrenceEnd = seriesId ? dates[dates.length - 1] : undefined;

    const appointments = await db.$transaction(
      dates.map((date) =>
        db.appointment.create({
          data: {
            patientId,
            providerId: session.user.id,
            type,
            scheduledAt: date,
            duration,
            notes: notes ?? null,
            status: "scheduled",
            seriesId: seriesId ?? null,
            recurrenceRule: seriesId ? recurrenceRule : null,
            recurrenceEnd: recurrenceEnd ?? null,
          },
        })
      )
    );

    const appointment = appointments[0];

    const seriesNote = seriesId ? ` (${dates.length}-appointment ${recurrenceRule} series)` : "";
    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "appointment_scheduled",
        title: `${type.replace(/_/g, " ")} appointment scheduled${seriesNote}`,
        description: `Scheduled for ${firstDate.toLocaleDateString()}`,
        metadata: { appointmentId: appointment.id, type, scheduledAt, seriesId, count: dates.length },
      },
    });

    logAudit({
      actorId: session.user.id,
      action: "appointment.create",
      resource: "Appointment",
      resourceId: appointment.id,
      metadata: { patientId, type, scheduledAt, recurrenceRule, count: dates.length },
    });

    // Notify the patient's portal user if one exists
    const patient = await db.patient.findUnique({
      where: { id: patientId },
      select: {
        firstName: true,
        lastName: true,
        portalUser: { select: { id: true } },
      },
    });
    if (patient?.portalUser) {
      const dateStr = new Date(scheduledAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      createNotification({
        recipientId: patient.portalUser.id,
        recipientType: "patient",
        type: "appointment_scheduled",
        title: "Appointment scheduled",
        body: `A ${type.replace(/_/g, " ")} appointment has been scheduled for ${dateStr}.`,
        patientId,
        resourceId: appointment.id,
      });
    }

    revalidatePath(`/dashboard/patients/${patientId}`);
    revalidatePath("/dashboard/appointments");
    revalidatePath("/dashboard");
    return { success: true, appointmentId: appointment.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to schedule appointment" };
  }
}

export async function rescheduleAppointment(
  input: unknown,
): Promise<{ success: boolean; error?: string; conflict?: boolean }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.APPOINTMENT_UPDATE);

    const parsed = rescheduleSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { appointmentId, patientId, scheduledAt, duration, notes } = parsed.data;
    await verifyPatientAccess(patientId, session);

    const newStart = new Date(scheduledAt);
    const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);

    // Conflict detection: check provider's other scheduled appointments
    const conflicts = await db.appointment.findMany({
      where: {
        providerId: session.user.id,
        status: "scheduled",
        id: { not: appointmentId }, // exclude the one being rescheduled
        AND: [
          { scheduledAt: { lt: newEnd } },
          {
            scheduledAt: {
              gt: new Date(newStart.getTime() - 180 * 60 * 1000), // up to 3hr before
            },
          },
        ],
      },
      select: { scheduledAt: true, duration: true, patient: { select: { firstName: true, lastName: true } } },
    });

    // Filter to actual overlaps (scheduledAt + duration > newStart)
    const overlapping = conflicts.filter((c) => {
      const cEnd = new Date(new Date(c.scheduledAt).getTime() + c.duration * 60 * 1000);
      return cEnd > newStart;
    });

    if (overlapping.length > 0) {
      const conflict = overlapping[0];
      const conflictTime = new Date(conflict.scheduledAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
      return {
        success: false,
        conflict: true,
        error: `Time conflict with ${conflict.patient.firstName} ${conflict.patient.lastName} at ${conflictTime}.`,
      };
    }

    const apptWhere = isAdmin(session)
      ? { id: appointmentId, patientId }
      : { id: appointmentId, patientId, providerId: session.user.id };

    await db.appointment.update({
      where: apptWhere,
      data: {
        scheduledAt: newStart,
        duration,
        status: "scheduled",
        ...(notes !== undefined ? { notes } : {}),
      },
    });

    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "appointment_scheduled",
        title: "Appointment rescheduled",
        description: `Moved to ${newStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
        metadata: { appointmentId, scheduledAt },
      },
    });

    logAudit({
      actorId: session.user.id,
      action: "appointment.reschedule",
      resource: "Appointment",
      resourceId: appointmentId,
      metadata: { patientId, scheduledAt },
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    revalidatePath("/dashboard/appointments");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to reschedule appointment" };
  }
}

export async function updateAppointmentStatus(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.APPOINTMENT_UPDATE);

    const parsed = updateStatusSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { appointmentId, patientId, status, notes } = parsed.data;
    await verifyPatientAccess(patientId, session);

    const apptWhere = isAdmin(session)
      ? { id: appointmentId, patientId }
      : { id: appointmentId, patientId, providerId: session.user.id };

    await db.appointment.update({
      where: apptWhere,
      data: { status, ...(notes !== undefined ? { notes } : {}) },
    });

    const statusLabel = status === "completed"
      ? "Appointment completed"
      : status === "cancelled"
      ? "Appointment cancelled"
      : "Patient no-show";

    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "appointment_scheduled",
        title: statusLabel,
        metadata: { appointmentId, status },
      },
    });

    logAudit({
      actorId: session.user.id,
      action: `appointment.${status}`,
      resource: "Appointment",
      resourceId: appointmentId,
      metadata: { patientId, status },
    });

    // Auto-create follow-up task and notification when patient no-shows
    if (status === "no_show") {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);
      void (async () => {
        try {
          const task = await db.careTask.create({
            data: {
              patientId,
              title: "Follow up on missed appointment",
              description: "Patient did not attend their scheduled appointment. Reach out to reschedule and check in.",
              dueDate,
              priority: "high",
              status: "PENDING",
            },
          });
          createNotification({
            recipientId: session.user.id,
            recipientType: "provider",
            type: "no_show_followup",
            title: "Patient no-show — follow-up needed",
            body: "A follow-up task has been created. Please contact the patient to reschedule.",
            patientId,
            resourceId: task.id,
          });
        } catch {
          // Fire-and-forget: never surface errors
        }
      })();
    }

    revalidatePath(`/dashboard/patients/${patientId}`);
    revalidatePath("/dashboard/appointments");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to update appointment" };
  }
}

export async function cancelSeries(
  input: unknown,
): Promise<{ success: boolean; error?: string; cancelled?: number }> {
  try {
    const session = await getSessionOrThrow();
    requirePermission(session, PERMISSIONS.APPOINTMENT_UPDATE);

    const parsed = cancelSeriesSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { seriesId, patientId } = parsed.data;
    await verifyPatientAccess(patientId, session);

    const result = await db.appointment.updateMany({
      where: {
        seriesId,
        patientId,
        status: "scheduled",
        scheduledAt: { gte: new Date() }, // only cancel future ones
      },
      data: { status: "cancelled" },
    });

    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "appointment_scheduled",
        title: `Recurring series cancelled`,
        description: `${result.count} upcoming appointment${result.count !== 1 ? "s" : ""} cancelled.`,
        metadata: { seriesId, cancelled: result.count },
      },
    });

    logAudit({
      actorId: session.user.id,
      action: "appointment.cancel_series",
      resource: "Appointment",
      metadata: { patientId, seriesId, cancelled: result.count },
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    revalidatePath("/dashboard/appointments");
    return { success: true, cancelled: result.count };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to cancel series" };
  }
}
