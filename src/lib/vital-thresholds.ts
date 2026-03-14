/**
 * Critical Vital Threshold Escalation
 *
 * Evaluates vital readings against evidence-based clinical thresholds and
 * fires immediate alerts for dangerous values. Called fire-and-forget from
 * recordVital() — runs after the vital is saved, never blocks the response.
 *
 * Guideline references:
 *  - ACOG Practice Bulletin 222: Gestational Hypertension and Preeclampsia (2020)
 *  - ACOG: "Emergent Therapy for Acute-Onset, Severe Hypertension" (2015, reaffirmed 2019)
 *  - ADA Standards of Care in Diabetes (2024) — critical glucose thresholds
 *  - ACOG: "Antepartum Fetal Surveillance" (2021) — fetal kick count guidance
 */

import { db } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { subHours } from "date-fns";

// ─── Threshold Constants ────────────────────────────────────────────────────

// Blood pressure — ACOG: Severe-range hypertension requires urgent evaluation ≤ 30 min
const BP_SEVERE_SYSTOLIC = 160;
const BP_SEVERE_DIASTOLIC = 110;
// Blood pressure — ACOG: Hypertensive range (non-severe); monitor closely
const BP_ELEVATED_SYSTOLIC = 140;
const BP_ELEVATED_DIASTOLIC = 90;

// Glucose — ADA: > 300 mg/dL suggests critical hyperglycemia, evaluate for DKA
const GLUCOSE_CRITICAL = 300;
// Glucose — ADA: Significantly elevated, immediate provider review
const GLUCOSE_HIGH = 200;

// Oxygen saturation — standard clinical threshold for hypoxia
const SPO2_CRITICAL = 94;

// Fetal movement — ACOG "count to 10": < 10 movements in 2 hours = concern
const FETAL_KICK_COUNT_LOW = 10;
const FETAL_KICK_PERIOD_HOURS = 2;

// Cooldown: suppress identical alerts fired within this window (per patient + vital type)
const ALERT_COOLDOWN_HOURS = 4;

// ─── Types ──────────────────────────────────────────────────────────────────

export type ThresholdSeverity = "critical" | "elevated";

interface ThresholdResult {
  severity: ThresholdSeverity;
  title: string;
  guidance: string;
  taskTitle: string;
  taskPriority: "urgent" | "high";
}

interface EvaluateParams {
  patientId: string;
  providerId: string;
  vitalType: string;
  value: Record<string, unknown>;
}

// ─── Threshold Evaluation ───────────────────────────────────────────────────

function evaluateBP(value: Record<string, unknown>): ThresholdResult | null {
  const systolic = value.systolic as number | undefined;
  const diastolic = value.diastolic as number | undefined;
  if (systolic == null || diastolic == null) return null;

  if (systolic >= BP_SEVERE_SYSTOLIC || diastolic >= BP_SEVERE_DIASTOLIC) {
    return {
      severity: "critical",
      title: `CRITICAL: Severe hypertension — ${systolic}/${diastolic} mmHg`,
      guidance:
        `BP ${systolic}/${diastolic} meets ACOG criteria for severe-range hypertension ` +
        `(≥160 systolic or ≥110 diastolic). Urgent evaluation required within 15–30 minutes. ` +
        `Consider IV antihypertensive therapy per ACOG guidelines.`,
      taskTitle: `URGENT: Evaluate severe hypertension — BP ${systolic}/${diastolic}`,
      taskPriority: "urgent",
    };
  }

  if (systolic >= BP_ELEVATED_SYSTOLIC || diastolic >= BP_ELEVATED_DIASTOLIC) {
    return {
      severity: "elevated",
      title: `Elevated blood pressure — ${systolic}/${diastolic} mmHg`,
      guidance:
        `BP ${systolic}/${diastolic} meets ACOG hypertensive threshold ` +
        `(≥140 systolic or ≥90 diastolic). Assess for preeclampsia symptoms. ` +
        `Confirm with repeat reading in 4 hours per ACOG protocol.`,
      taskTitle: `Review elevated BP: ${systolic}/${diastolic} — confirm and assess`,
      taskPriority: "high",
    };
  }

  return null;
}

function evaluateGlucose(value: Record<string, unknown>): ThresholdResult | null {
  const glucose = value.value as number | undefined;
  if (glucose == null) return null;

  if (glucose >= GLUCOSE_CRITICAL) {
    return {
      severity: "critical",
      title: `CRITICAL: Blood glucose ${glucose} mg/dL`,
      guidance:
        `Glucose of ${glucose} mg/dL exceeds ADA critical threshold (≥300 mg/dL). ` +
        `Evaluate for diabetic ketoacidosis (DKA) — assess symptoms, check ketones, ` +
        `consider emergency referral.`,
      taskTitle: `URGENT: Evaluate critical glucose — ${glucose} mg/dL`,
      taskPriority: "urgent",
    };
  }

  if (glucose >= GLUCOSE_HIGH) {
    return {
      severity: "elevated",
      title: `High blood glucose — ${glucose} mg/dL`,
      guidance:
        `Glucose of ${glucose} mg/dL is significantly elevated. Review medication adherence, ` +
        `dietary intake, and GDM management plan. Consider adjustment to glucose targets.`,
      taskTitle: `Review high glucose: ${glucose} mg/dL`,
      taskPriority: "high",
    };
  }

  return null;
}

function evaluateSpO2(value: Record<string, unknown>): ThresholdResult | null {
  const spo2 = value.value as number | undefined;
  if (spo2 == null) return null;

  if (spo2 <= SPO2_CRITICAL) {
    return {
      severity: "critical",
      title: `CRITICAL: Oxygen saturation ${spo2}%`,
      guidance:
        `SpO₂ of ${spo2}% indicates hypoxia (threshold: ≤94%). ` +
        `Evaluate immediately — consider supplemental oxygen, assess respiratory status, ` +
        `rule out pulmonary embolism or pneumonia.`,
      taskTitle: `URGENT: Evaluate hypoxia — SpO₂ ${spo2}%`,
      taskPriority: "urgent",
    };
  }

  return null;
}

function evaluateFetalMovement(value: Record<string, unknown>): ThresholdResult | null {
  const count = value.count as number | undefined;
  const periodHours = value.period_hours as number | undefined;
  if (count == null || periodHours == null) return null;

  // Normalize to a 2-hour window for ACOG "count to 10" comparison
  const normalizedCount = periodHours > 0 ? (count / periodHours) * FETAL_KICK_PERIOD_HOURS : count;

  if (normalizedCount < FETAL_KICK_COUNT_LOW) {
    return {
      severity: "critical",
      title: `Reduced fetal movement — ${count} kicks in ${periodHours}h`,
      guidance:
        `Fetal kick count of ${count} movements in ${periodHours}h is below the ACOG "count to 10" ` +
        `threshold (10 movements in 2 hours). Recommend non-stress test (NST) or biophysical ` +
        `profile (BPP) today. Contact patient for immediate evaluation.`,
      taskTitle: `URGENT: Evaluate reduced fetal movement — ${count} kicks in ${periodHours}h`,
      taskPriority: "urgent",
    };
  }

  return null;
}

// ─── Cooldown Check ─────────────────────────────────────────────────────────

async function wasAlertRecentlyFired(
  patientId: string,
  alertTitle: string,
): Promise<boolean> {
  const recent = await db.careTask.findFirst({
    where: {
      patientId,
      title: alertTitle,
      createdAt: { gte: subHours(new Date(), ALERT_COOLDOWN_HOURS) },
      deletedAt: null,
    },
    select: { id: true },
  });
  return !!recent;
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

export async function evaluateCriticalVitalThresholds({
  patientId,
  providerId,
  vitalType,
  value,
}: EvaluateParams): Promise<void> {
  let result: ThresholdResult | null = null;

  switch (vitalType) {
    case "bp":
      result = evaluateBP(value);
      break;
    case "glucose":
      result = evaluateGlucose(value);
      break;
    case "oxygen_saturation":
      result = evaluateSpO2(value);
      break;
    case "fetal_movement":
      result = evaluateFetalMovement(value);
      break;
    default:
      return; // No threshold rules for this vital type
  }

  if (!result) return;

  // Cooldown: don't re-fire the same alert within 4 hours
  const alreadyFired = await wasAlertRecentlyFired(patientId, result.taskTitle);
  if (alreadyFired) return;

  // Create URGENT care task
  const task = await db.careTask.create({
    data: {
      patientId,
      title: result.taskTitle,
      description: result.guidance,
      dueDate: new Date(), // Due immediately
      priority: result.taskPriority,
      status: "PENDING",
    },
  });

  // Create escalation timeline event
  await db.timelineEvent.create({
    data: {
      patientId,
      eventType: "escalation",
      title: result.title,
      description: result.guidance,
      metadata: {
        severity: result.severity,
        vitalType,
        taskId: task.id,
        guideline: "ACOG/ADA",
        triggeredBy: "vital_threshold",
      },
    },
  });

  // Fire real-time notification to provider
  createNotification({
    recipientId: providerId,
    recipientType: "provider",
    type: result.severity === "critical" ? "critical_vital_alert" : "risk_escalation",
    title: result.title,
    body: result.guidance.slice(0, 200),
    patientId,
    resourceId: task.id,
  });
}
