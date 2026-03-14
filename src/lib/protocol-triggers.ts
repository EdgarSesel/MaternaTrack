/**
 * Protocol Trigger Engine
 *
 * Evaluates clinical thresholds after screenings and vitals are saved,
 * and auto-activates relevant care protocols when criteria are met.
 * All functions are fire-and-forget — call without await.
 */

import { db } from "@/lib/db";
import { generateProtocolTasks, type ProtocolType } from "@/lib/protocols";
import { createNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";

async function getActiveProtocols(patientId: string): Promise<string[]> {
  const plans = await db.carePlan.findMany({
    where: { patientId, status: "active" },
    select: { protocolType: true },
  });
  return plans.map((p) => p.protocolType);
}

async function activateProtocolAutomatically(
  patientId: string,
  providerId: string,
  protocolType: ProtocolType,
  reason: string
): Promise<void> {
  const now = new Date();

  await db.$transaction(async (tx) => {
    const carePlan = await tx.carePlan.create({
      data: {
        patientId,
        protocolType,
        status: "active",
        activatedAt: now,
        config: { autoActivated: true, reason } as Parameters<typeof tx.carePlan.create>[0]["data"]["config"],
      },
    });

    const taskData = generateProtocolTasks(protocolType, patientId, carePlan.id, now);
    await tx.careTask.createMany({ data: taskData });

    await tx.timelineEvent.create({
      data: {
        patientId,
        eventType: "care_plan_update",
        title: "Protocol auto-activated",
        description: `${protocolType.replace(/_/g, " ")} protocol was automatically activated: ${reason}`,
        metadata: { protocolType, carePlanId: carePlan.id, autoActivated: true, reason } as Parameters<typeof tx.timelineEvent.create>[0]["data"]["metadata"],
      },
    });
  });

  const patient = await db.patient.findUnique({
    where: { id: patientId },
    select: { firstName: true, lastName: true },
  });

  createNotification({
    recipientId: providerId,
    recipientType: "provider",
    type: "care_gap",
    title: "Protocol Auto-Activated",
    body: `${protocolType.replace(/_/g, " ")} protocol was auto-activated for ${patient?.firstName ?? "patient"} ${patient?.lastName ?? ""}. Reason: ${reason}`,
    patientId,
    metadata: { protocolType, reason },
  });
}

/**
 * Evaluate triggers after a screening is saved.
 * Call fire-and-forget from screening-actions.ts.
 */
export function evaluateScreeningTriggers(params: {
  patientId: string;
  providerId: string;
  screeningType: string;
  score: number | null;
  riskResult: string;
}): void {
  const { patientId, providerId, screeningType, score, riskResult } = params;

  (async () => {
    try {
      const active = await getActiveProtocols(patientId);

      // Trigger 1: GDM positive → activate GDM Management
      if (
        screeningType === "gdm_screen" &&
        riskResult === "positive" &&
        !active.includes("gdm_management")
      ) {
        await activateProtocolAutomatically(
          patientId,
          providerId,
          "gdm_management",
          "GDM screen returned positive result"
        );
      }

      // Trigger 2: PHQ-9 ≥15 → activate Perinatal Depression
      if (
        (screeningType === "phq9" || screeningType === "epds") &&
        score !== null &&
        score >= 15 &&
        !active.includes("perinatal_depression")
      ) {
        await activateProtocolAutomatically(
          patientId,
          providerId,
          "perinatal_depression",
          `${screeningType.toUpperCase()} score of ${score} meets threshold for protocol activation (≥15)`
        );
      }

      // Trigger 3: Postpartum patient + no depression screening yet → notify provider
      const patient = await db.patient.findUnique({
        where: { id: patientId },
        select: { status: true },
      });

      if (patient?.status === "POSTPARTUM" && screeningType !== "epds" && screeningType !== "phq9") {
        const hasDepressionScreen = await db.screening.findFirst({
          where: { patientId, type: { in: ["epds", "phq9"] } },
        });
        if (!hasDepressionScreen) {
          createNotification({
            recipientId: providerId,
            recipientType: "provider",
            type: "care_gap",
            title: "Postpartum Depression Screening Due",
            body: `Patient is postpartum and has no depression screening on record. EPDS or PHQ-9 is recommended.`,
            patientId,
          });
        }
      }
    } catch (err) {
      logger.error("Protocol trigger evaluation failed", { error: err, patientId });
    }
  })();
}

/**
 * Evaluate triggers after a vital is saved.
 * Call fire-and-forget from vital-actions.ts.
 */
export function evaluateVitalTriggers(params: {
  patientId: string;
  providerId: string;
  vitalType: string;
  value: unknown;
}): void {
  const { patientId, providerId, vitalType, value } = params;

  if (vitalType !== "bp") return;

  (async () => {
    try {
      const active = await getActiveProtocols(patientId);
      if (active.includes("preeclampsia_prevention")) return;

      // Get last 3 BP readings (most recent first)
      const recentBPs = await db.vital.findMany({
        where: { patientId, type: "bp" },
        orderBy: { recordedAt: "desc" },
        take: 3,
      });

      if (recentBPs.length < 3) return;

      // Check if all 3 are elevated (systolic ≥130 OR diastolic ≥80)
      const allElevated = recentBPs.every((v) => {
        const bp = v.value as { systolic?: number; diastolic?: number };
        return (bp.systolic ?? 0) >= 130 || (bp.diastolic ?? 0) >= 80;
      });

      if (allElevated) {
        const bp = value as { systolic?: number; diastolic?: number };
        await activateProtocolAutomatically(
          patientId,
          providerId,
          "preeclampsia_prevention",
          `3 consecutive elevated blood pressure readings (latest: ${bp.systolic ?? "?"}/${bp.diastolic ?? "?"} mmHg)`
        );
      }
    } catch (err) {
      logger.error("BP trigger evaluation failed", { error: err, patientId });
    }
  })();
}
