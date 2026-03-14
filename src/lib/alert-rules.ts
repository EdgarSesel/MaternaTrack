/**
 * Alert Rule Engine for MaternaTrack
 *
 * Evaluates clinical alert conditions across all active patients.
 * Called by the /api/cron/alerts endpoint (periodic) and after key data events.
 *
 * Cooldown periods prevent alert spam — each rule fires at most once per period.
 */

import { db } from "@/lib/db";
import { differenceInDays, differenceInHours } from "date-fns";
import type { PatientStatus } from "@/generated/prisma/client";
import { createNotification } from "@/lib/notifications";
import {
  sendEmail,
  overdueTaskAlertEmail,
  riskScoreChangeEmail,
  newMessageNotificationEmail,
} from "@/lib/email";
import { logger } from "@/lib/logger";
import { predictRiskTrend } from "@/lib/risk-predictor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type AlertResult = {
  ruleId: string;
  patientId: string;
  patientName: string;
  providerId: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  fired: boolean;
  reason?: string;
};

// Simple in-memory cooldown store (resets on server restart, sufficient for low-traffic apps)
// Key: `${ruleId}:${patientId}` → last fired timestamp
const cooldownStore = new Map<string, Date>();

function isInCooldown(ruleId: string, patientId: string, cooldownHours: number): boolean {
  const key = `${ruleId}:${patientId}`;
  const last = cooldownStore.get(key);
  if (!last) return false;
  return differenceInHours(new Date(), last) < cooldownHours;
}

function recordFired(ruleId: string, patientId: string) {
  cooldownStore.set(`${ruleId}:${patientId}`, new Date());
}

// ---------------------------------------------------------------------------
// Rule: Elevated Blood Pressure Trend
// Fires when 3 consecutive BP readings are ≥ 140 systolic
// ---------------------------------------------------------------------------
async function checkBpTrend(
  patient: { id: string; firstName: string; lastName: string; providerId: string },
  providerEmail: string,
  providerName: string
): Promise<AlertResult | null> {
  const RULE_ID = "bp_trend_elevated";
  if (isInCooldown(RULE_ID, patient.id, 24)) return null;

  const recentBps = await db.vital.findMany({
    where: { patientId: patient.id, type: "bp" },
    orderBy: { recordedAt: "desc" },
    take: 3,
  });

  if (recentBps.length < 3) return null;

  const elevatedCount = recentBps.filter((v) => {
    const val = v.value as { systolic?: number };
    return typeof val.systolic === "number" && val.systolic >= 140;
  }).length;

  if (elevatedCount < 3) return null;

  const patientName = `${patient.firstName} ${patient.lastName}`;
  const title = `Hypertensive BP trend — ${patientName}`;
  const body = `${patientName} has had 3 consecutive blood pressure readings ≥ 140 systolic. Evaluate for preeclampsia per ACOG guidelines.`;

  // Notify provider
  createNotification({
    recipientId: patient.providerId,
    recipientType: "provider",
    type: "risk_escalation",
    title,
    body,
    patientId: patient.id,
  });

  // Email provider
  await sendEmail({
    to: providerEmail,
    subject: `⚠️ Alert: Elevated BP Trend — ${patientName}`,
    html: riskScoreChangeEmail({
      providerName,
      patientName,
      oldLevel: "Borderline",
      newLevel: "Hypertensive range",
      newScore: 3,
    }),
  });

  recordFired(RULE_ID, patient.id);
  return { ruleId: RULE_ID, patientId: patient.id, patientName, providerId: patient.providerId, severity: "critical", title, body, fired: true };
}

// ---------------------------------------------------------------------------
// Rule: No Contact in 14+ Days (for pregnant/postpartum patients)
// ---------------------------------------------------------------------------
async function checkNoContact(
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    providerId: string;
    status: string;
    lastContactAt: Date | null;
  },
  providerEmail: string,
  providerName: string
): Promise<AlertResult | null> {
  const RULE_ID = "no_contact_14d";
  if (!["PREGNANT", "POSTPARTUM"].includes(patient.status)) return null;
  if (isInCooldown(RULE_ID, patient.id, 48)) return null;

  const days = patient.lastContactAt
    ? differenceInDays(new Date(), new Date(patient.lastContactAt))
    : 30;

  if (days < 14) return null;

  const patientName = `${patient.firstName} ${patient.lastName}`;
  const title = `No contact in ${days} days — ${patientName}`;
  const body = `${patientName} has not been contacted in ${days} days. Consider proactive outreach, especially given their current status.`;

  createNotification({
    recipientId: patient.providerId,
    recipientType: "provider",
    type: "care_gap",
    title,
    body,
    patientId: patient.id,
  });

  await sendEmail({
    to: providerEmail,
    subject: `Care Gap: No Contact in ${days} Days — ${patientName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7c3aed;">Patient Engagement Alert</h2>
        <p>Hi ${providerName},</p>
        <p><strong>${patientName}</strong> has not been contacted in <strong>${days} days</strong>.</p>
        <p>For ${patient.status.toLowerCase()} patients, regular contact is critical for risk monitoring and care plan adherence.</p>
        <p>Please review their profile and reach out through the MaternaTrack messaging system.</p>
        <p style="color: #64748b; font-size: 14px;">— MaternaTrack Care Team</p>
      </div>
    `,
  });

  recordFired(RULE_ID, patient.id);
  return { ruleId: RULE_ID, patientId: patient.id, patientName, providerId: patient.providerId, severity: "high", title, body, fired: true };
}

// ---------------------------------------------------------------------------
// Rule: PHQ-9 ≥ 15 (Moderately Severe Depression)
// ---------------------------------------------------------------------------
async function checkDepressionScreen(
  patient: { id: string; firstName: string; lastName: string; providerId: string }
): Promise<AlertResult | null> {
  const RULE_ID = "phq9_high";
  if (isInCooldown(RULE_ID, patient.id, 72)) return null;

  const latest = await db.screening.findFirst({
    where: { patientId: patient.id, type: "phq9" },
    orderBy: { administeredAt: "desc" },
  });

  if (!latest || latest.score === null || latest.score < 15) return null;

  // Only alert if recent (within 7 days)
  if (differenceInDays(new Date(), new Date(latest.administeredAt)) > 7) return null;

  const patientName = `${patient.firstName} ${patient.lastName}`;
  const title = `PHQ-9 score ${latest.score} — ${patientName}`;
  const body = `${patientName} scored ${latest.score} on the PHQ-9 (moderately severe depression). Clinical evaluation and treatment planning recommended per USPSTF guidelines.`;

  createNotification({
    recipientId: patient.providerId,
    recipientType: "provider",
    type: "risk_escalation",
    title,
    body,
    patientId: patient.id,
    resourceId: latest.id,
  });

  recordFired(RULE_ID, patient.id);
  return { ruleId: RULE_ID, patientId: patient.id, patientName, providerId: patient.providerId, severity: "critical", title, body, fired: true };
}

// ---------------------------------------------------------------------------
// Rule: Overdue tasks > 3 days past due on HIGH/VERY_HIGH risk patients
// ---------------------------------------------------------------------------
async function checkOverdueTasks(
  patient: { id: string; firstName: string; lastName: string; providerId: string; riskLevel: string },
  providerEmail: string,
  providerName: string
): Promise<AlertResult | null> {
  const RULE_ID = "overdue_tasks_high_risk";
  if (!["HIGH", "VERY_HIGH"].includes(patient.riskLevel)) return null;
  if (isInCooldown(RULE_ID, patient.id, 48)) return null;

  const overdueTasks = await db.careTask.findMany({
    where: {
      patientId: patient.id,
      status: "OVERDUE",
      deletedAt: null,
      dueDate: { lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { dueDate: "asc" },
    take: 3,
  });

  if (overdueTasks.length === 0) return null;

  const patientName = `${patient.firstName} ${patient.lastName}`;
  const title = `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""} — ${patientName}`;
  const body = `${patientName} has ${overdueTasks.length} overdue care task${overdueTasks.length > 1 ? "s" : ""} on a ${patient.riskLevel.replace("_", " ").toLowerCase()} risk care plan. Oldest: "${overdueTasks[0].title}"`;

  createNotification({
    recipientId: patient.providerId,
    recipientType: "provider",
    type: "task_overdue",
    title,
    body,
    patientId: patient.id,
  });

  await sendEmail({
    to: providerEmail,
    subject: `Action Required: Overdue Tasks — ${patientName}`,
    html: overdueTaskAlertEmail({
      providerName,
      patientName,
      taskTitle: overdueTasks[0].title,
      daysOverdue: differenceInDays(new Date(), new Date(overdueTasks[0].dueDate)),
    }),
  });

  recordFired(RULE_ID, patient.id);
  return { ruleId: RULE_ID, patientId: patient.id, patientName, providerId: patient.providerId, severity: "high", title, body, fired: true };
}

// ---------------------------------------------------------------------------
// Rule: Predictive Risk Trajectory Alert
// Fires when risk score is projected to cross HIGH or VERY_HIGH threshold
// ---------------------------------------------------------------------------
async function checkRiskTrajectory(
  patient: { id: string; firstName: string; lastName: string; providerId: string; riskLevel: string }
): Promise<AlertResult | null> {
  const RULE_ID = "risk_trajectory";
  if (isInCooldown(RULE_ID, patient.id, 48)) return null;

  const history = await db.riskScoreHistory.findMany({
    where: { patientId: patient.id },
    orderBy: { calculatedAt: "desc" },
    take: 6,
    select: { score: true, calculatedAt: true },
  });

  if (history.length < 3) return null;

  const trend = predictRiskTrend(history);
  if (!trend.alert) return null;

  const patientName = `${patient.firstName} ${patient.lastName}`;
  const isCritical = trend.alert === "critical_trajectory";

  const title = isCritical
    ? `Critical risk trajectory — ${patientName}`
    : `Rising risk trajectory — ${patientName}`;

  const body = isCritical
    ? `${patientName}'s risk score is projected to reach ${trend.projectedScore7d}/100 (Very High) within 7 days (current slope: +${trend.slope} pts/day). Immediate care plan review recommended.`
    : `${patientName}'s risk score is projected to reach ${trend.projectedScore14d}/100 (High) within 14 days (current slope: +${trend.slope} pts/day). Proactive intervention suggested.`;

  createNotification({
    recipientId: patient.providerId,
    recipientType: "provider",
    type: "risk_escalation",
    title,
    body,
    patientId: patient.id,
  });

  recordFired(RULE_ID, patient.id);
  return {
    ruleId: RULE_ID,
    patientId: patient.id,
    patientName,
    providerId: patient.providerId,
    severity: isCritical ? "critical" : "high",
    title,
    body,
    fired: true,
  };
}

// ---------------------------------------------------------------------------
// Main: Run all alert rules across all active patients
// ---------------------------------------------------------------------------
export async function runAlertRules(providerFilter?: { providerId?: string }): Promise<{
  evaluated: number;
  fired: AlertResult[];
  errors: number;
}> {
  const activeStatuses = ["PREGNANT", "POSTPARTUM"] as PatientStatus[];
  const where = providerFilter?.providerId
    ? { providerId: providerFilter.providerId, deletedAt: null, status: { in: activeStatuses } }
    : { deletedAt: null, status: { in: activeStatuses } };

  const patients = await db.patient.findMany({
    where,
    include: {
      provider: { select: { email: true, name: true } },
    },
    take: 200,
  });

  const fired: AlertResult[] = [];
  let errors = 0;

  for (const patient of patients) {
    try {
      const providerEmail = patient.provider.email;
      const providerName = patient.provider.name;

      const results = await Promise.allSettled([
        checkBpTrend(patient, providerEmail, providerName),
        checkNoContact(patient, providerEmail, providerName),
        checkDepressionScreen(patient),
        checkOverdueTasks(patient, providerEmail, providerName),
        checkRiskTrajectory(patient),
      ]);

      for (const result of results) {
        if (result.status === "fulfilled" && result.value?.fired) {
          fired.push(result.value);
        } else if (result.status === "rejected") {
          errors++;
          logger.error("Alert rule error", { error: result.reason, patientId: patient.id });
        }
      }
    } catch (err) {
      errors++;
      logger.error("Alert evaluation error", { error: err, patientId: patient.id });
    }
  }

  return { evaluated: patients.length, fired, errors };
}

// ---------------------------------------------------------------------------
// Hook: Call after new message is received (provider side notification)
// ---------------------------------------------------------------------------
export function alertProviderNewPatientMessage(params: {
  patientId: string;
  patientName: string;
  providerId: string;
  providerEmail: string;
  providerName: string;
  messagePreview: string;
}) {
  const { patientId, patientName, providerId, providerEmail, providerName, messagePreview } = params;

  createNotification({
    recipientId: providerId,
    recipientType: "provider",
    type: "new_message",
    title: `New message from ${patientName}`,
    body: messagePreview.slice(0, 100),
    patientId,
  });

  sendEmail({
    to: providerEmail,
    subject: `New Message from ${patientName}`,
    html: newMessageNotificationEmail({ recipientName: providerName, senderName: patientName, preview: messagePreview }),
  }).catch(() => {});
}
