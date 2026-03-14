"use server";

import { db } from "@/lib/db";
import { requirePortalSession } from "@/lib/portal-session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createNotification } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { sanitizeString } from "@/lib/sanitize";

const rescheduleRequestSchema = z.object({
  appointmentId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

const cancelRequestSchema = z.object({
  appointmentId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

async function verifyAppointmentOwnership(appointmentId: string, patientId: string) {
  const appt = await db.appointment.findFirst({
    where: { id: appointmentId, patientId, status: "scheduled" },
    select: { id: true, providerId: true, scheduledAt: true, type: true },
  });
  if (!appt) throw new Error("Appointment not found");
  return appt;
}

export async function confirmAppointment(
  appointmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requirePortalSession();
    const appt = await verifyAppointmentOwnership(appointmentId, session.patientId);

    // Add a "confirmed" note to the appointment (we don't have a confirmed status in schema,
    // so we add a system message as confirmation acknowledgement)
    await db.message.create({
      data: {
        patientId: session.patientId,
        senderType: "SYSTEM",
        content: `Patient confirmed appointment on ${new Date(appt.scheduledAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`,
        messageType: "system",
      },
    });

    logAudit({
      actorId: session.userId,
      actorType: "patient",
      action: "appointment.confirmed",
      resource: "Appointment",
      resourceId: appointmentId,
      metadata: { patientId: session.patientId },
    });

    revalidatePath("/portal/appointments");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to confirm" };
  }
}

export async function requestReschedule(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requirePortalSession();

    const parsed = rescheduleRequestSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { appointmentId, reason } = parsed.data;
    const appt = await verifyAppointmentOwnership(appointmentId, session.patientId);
    const cleanReason = sanitizeString(reason);

    // Get patient name and provider ID for notification
    const patient = await db.patient.findUnique({
      where: { id: session.patientId },
      select: { firstName: true, lastName: true },
    });

    // Send a system message to the conversation thread
    await db.message.create({
      data: {
        patientId: session.patientId,
        senderType: "SYSTEM",
        content: `Patient requested to reschedule the ${appt.type.replace(/_/g, " ")} appointment on ${new Date(appt.scheduledAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Reason: ${cleanReason}`,
        messageType: "system",
      },
    });

    // Notify the provider
    createNotification({
      recipientId: appt.providerId,
      recipientType: "provider",
      type: "appointment_reminder",
      title: "Patient Reschedule Request",
      body: `${patient?.firstName ?? "Patient"} ${patient?.lastName ?? ""} requested to reschedule their ${appt.type.replace(/_/g, " ")} appointment. Reason: ${cleanReason}`,
      patientId: session.patientId,
      resourceId: appointmentId,
    });

    logAudit({
      actorId: session.userId,
      actorType: "patient",
      action: "appointment.reschedule_requested",
      resource: "Appointment",
      resourceId: appointmentId,
      metadata: { patientId: session.patientId, reason: cleanReason },
    });

    revalidatePath("/portal/appointments");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to send request" };
  }
}

export async function cancelAppointmentPortal(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requirePortalSession();

    const parsed = cancelRequestSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { appointmentId, reason } = parsed.data;
    const appt = await verifyAppointmentOwnership(appointmentId, session.patientId);
    const cleanReason = reason ? sanitizeString(reason) : undefined;

    // Only allow cancelling if appointment is >24h away
    const hoursUntil = (new Date(appt.scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil < 24) {
      return { success: false, error: "Appointments within 24 hours cannot be cancelled online. Please call us directly." };
    }

    await db.appointment.update({
      where: { id: appointmentId },
      data: { status: "cancelled" },
    });

    const patient = await db.patient.findUnique({
      where: { id: session.patientId },
      select: { firstName: true, lastName: true },
    });

    const reasonNote = cleanReason ? ` Reason: ${cleanReason}` : "";
    await db.message.create({
      data: {
        patientId: session.patientId,
        senderType: "SYSTEM",
        content: `Patient cancelled their ${appt.type.replace(/_/g, " ")} appointment on ${new Date(appt.scheduledAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.${reasonNote}`,
        messageType: "system",
      },
    });

    createNotification({
      recipientId: appt.providerId,
      recipientType: "provider",
      type: "appointment_reminder",
      title: "Appointment Cancelled by Patient",
      body: `${patient?.firstName ?? "Patient"} ${patient?.lastName ?? ""} cancelled their ${appt.type.replace(/_/g, " ")} appointment (${new Date(appt.scheduledAt).toLocaleDateString()}).${reasonNote}`,
      patientId: session.patientId,
      resourceId: appointmentId,
    });

    logAudit({
      actorId: session.userId,
      actorType: "patient",
      action: "appointment.cancelled",
      resource: "Appointment",
      resourceId: appointmentId,
      metadata: { patientId: session.patientId, reason: cleanReason },
    });

    revalidatePath("/portal/appointments");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to cancel" };
  }
}
