/**
 * Email sending via Resend.
 * Gracefully degrades if RESEND_API_KEY is not set — logs to console in dev, silently no-ops in prod.
 */

import { logger } from "@/lib/logger";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "MaternaTrack <noreply@materna.dev>";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn("RESEND_API_KEY not set — skipping email", { to: params.to, subject: params.subject });
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.error("Resend API error", { status: res.status, body: text });
    }
  } catch (err) {
    logger.error("Failed to send email", { error: err });
  }
}

// --- Email templates ---

export function appointmentReminderEmail(params: {
  patientName: string;
  appointmentType: string;
  scheduledAt: Date;
}): string {
  const dateStr = params.scheduledAt.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Appointment Reminder</h2>
      <p>Hi ${params.patientName},</p>
      <p>This is a reminder about your upcoming <strong>${params.appointmentType.replace(/_/g, " ")}</strong> appointment on <strong>${dateStr}</strong>.</p>
      <p>If you need to reschedule, please contact your care team as soon as possible.</p>
      <p style="color: #64748b; font-size: 14px;">— MaternaTrack Care Team</p>
    </div>
  `;
}

export function overdueTaskAlertEmail(params: {
  providerName: string;
  patientName: string;
  taskTitle: string;
  daysOverdue: number;
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Overdue Care Task Alert</h2>
      <p>Hi ${params.providerName},</p>
      <p>A care task for <strong>${params.patientName}</strong> is <strong>${params.daysOverdue} day${params.daysOverdue !== 1 ? "s" : ""} overdue</strong>:</p>
      <blockquote style="border-left: 3px solid #dc2626; padding-left: 12px; color: #374151;">${params.taskTitle}</blockquote>
      <p>Please review the patient's care plan and take action as needed.</p>
      <p style="color: #64748b; font-size: 14px;">— MaternaTrack Care Team</p>
    </div>
  `;
}

export function newMessageNotificationEmail(params: {
  recipientName: string;
  senderName: string;
  preview: string;
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">New Message</h2>
      <p>Hi ${params.recipientName},</p>
      <p>You have a new message from <strong>${params.senderName}</strong>:</p>
      <blockquote style="border-left: 3px solid #3b82f6; padding-left: 12px; color: #374151; font-style: italic;">${params.preview}</blockquote>
      <p>Log in to MaternaTrack to view and reply.</p>
      <p style="color: #64748b; font-size: 14px;">— MaternaTrack Care Team</p>
    </div>
  `;
}

export function riskScoreChangeEmail(params: {
  providerName: string;
  patientName: string;
  oldLevel: string;
  newLevel: string;
  newScore: number;
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0f172a;">Risk Score Change Alert</h2>
      <p>Hi ${params.providerName},</p>
      <p>The risk score for <strong>${params.patientName}</strong> has changed:</p>
      <p><strong>${params.oldLevel}</strong> → <strong>${params.newLevel}</strong> (score: ${params.newScore})</p>
      <p>Please review the patient's updated risk profile in MaternaTrack.</p>
      <p style="color: #64748b; font-size: 14px;">— MaternaTrack Care Team</p>
    </div>
  `;
}
