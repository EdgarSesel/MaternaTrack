/**
 * GET /api/cron/appointment-reminders
 *
 * Sends 24-hour appointment reminder notifications.
 * Finds appointments scheduled 23–25 hours from now that haven't been reminded.
 *
 * Protected by x-cron-secret header.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { createNotification } from "@/lib/notifications";
import { addHours, subHours } from "date-fns";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const start = Date.now();
  const now = new Date();
  // Window: appointments 23–25 hours from now
  const windowStart = addHours(now, 23);
  const windowEnd = addHours(now, 25);

  try {
    const upcoming = await db.appointment.findMany({
      where: {
        scheduledAt: { gte: windowStart, lte: windowEnd },
        status: "scheduled",
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        provider: { select: { id: true, name: true } },
      },
    });

    let sent = 0;
    let skipped = 0;

    for (const appt of upcoming) {
      // Check if reminder already sent (notification in last 2 hours for this appointment)
      const existing = await db.notification.findFirst({
        where: {
          recipientId: appt.providerId,
          type: "appointment_reminder",
          resourceId: appt.id,
          createdAt: { gte: subHours(now, 2) },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const patientName = `${appt.patient.firstName} ${appt.patient.lastName}`;
      const apptTime = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(appt.scheduledAt));

      await createNotification({
        recipientId: appt.providerId,
        recipientType: "provider",
        type: "appointment_reminder",
        title: "Appointment Tomorrow",
        body: `${patientName} — ${appt.type.replace(/_/g, " ")} at ${apptTime}`,
        patientId: appt.patient.id,
        resourceId: appt.id,
      });

      sent++;
    }

    const durationMs = Date.now() - start;
    logger.info("Cron: appointment-reminders", { total: upcoming.length, sent, skipped, durationMs });

    return Response.json({
      ok: true,
      total: upcoming.length,
      sent,
      skipped,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Cron: appointment-reminders failed", { error: String(err) });
    return Response.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
