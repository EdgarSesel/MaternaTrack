"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requirePermission,
  PERMISSIONS,
  isAdmin,
  type AuthSession,
} from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import {
  computeScreeningResult,
  computeGdmResult,
  SCREENING_DEFINITIONS,
  GDM_SCREEN,
} from "@/lib/screening-definitions";
import { evaluateScreeningTriggers } from "@/lib/protocol-triggers";

const administerScreeningSchema = z.object({
  patientId: z.string().min(1),
  type: z.enum(["phq9", "epds", "gad7", "gdm_screen", "sdoh"]),
  responses: z.record(z.string(), z.number()),
  administeredAt: z.string().datetime(),
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
    : { id: patientId, providerId: session.user.id, deletedAt: null };
  const patient = await db.patient.findFirst({ where, select: { id: true } });
  if (!patient) throw new Error("Patient not found or access denied");
}

export async function administerScreening(input: unknown) {
  const session = await getSessionOrThrow();
  requirePermission(session, PERMISSIONS.PATIENT_WRITE);

  const parsed = administerScreeningSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid input: " + parsed.error.issues[0]?.message };
  }

  const { patientId, type, responses, administeredAt } = parsed.data;

  try {
    await verifyPatientOwnership(patientId, session);

    let score: number | null = null;
    let riskResult: string;
    let interpretationLabel: string;

    if (type === "gdm_screen") {
      const result = computeGdmResult(responses);
      riskResult = result.riskResult;
      interpretationLabel = result.label;
    } else {
      const definition = SCREENING_DEFINITIONS[type];
      if (!definition || definition.type === "gdm_screen") {
        return { success: false, error: "Unknown screening type" };
      }
      // definition is ScreeningDefinition here
      const result = computeScreeningResult(
        definition as Parameters<typeof computeScreeningResult>[0],
        responses
      );
      score = result.score;
      riskResult = result.riskResult;
      interpretationLabel = result.label;
    }

    const screening = await db.screening.create({
      data: {
        patientId,
        type,
        score,
        riskResult,
        responses: responses as Parameters<typeof db.screening.create>[0]["data"]["responses"],
        administeredAt: new Date(administeredAt),
        administeredBy: session.user.id,
      },
    });

    // Timeline event
    const scoreText = score !== null ? ` (Score: ${score})` : "";
    await db.timelineEvent.create({
      data: {
        patientId,
        eventType: "screening_completed",
        title: `${type.toUpperCase()} screening completed${scoreText}`,
        description: `Result: ${interpretationLabel}. Administered by ${session.user.name ?? "provider"}.`,
        metadata: {
          screeningId: screening.id,
          type,
          score,
          riskResult,
          interpretationLabel,
        } as Parameters<typeof db.timelineEvent.create>[0]["data"]["metadata"],
      },
    });

    // Update patient's social determinants if SDOH
    if (type === "sdoh") {
      const sdohMap: Record<string, string> = {
        sdoh_1: "housingInstability",
        sdoh_2: "foodInsecurity",
        sdoh_3: "transportationBarrier",
        sdoh_4: "socialIsolation",
        sdoh_5: "intimatePartnerViolence",
        sdoh_10: "substanceUse",
      };

      const currentPatient = await db.patient.findUnique({
        where: { id: patientId },
        select: { socialDeterminants: true },
      });

      const existingSocial =
        (currentPatient?.socialDeterminants as Record<string, boolean>) ?? {};

      const updatedSocial = { ...existingSocial };
      for (const [qId, field] of Object.entries(sdohMap)) {
        updatedSocial[field] = responses[qId] === 1;
      }

      await db.patient.update({
        where: { id: patientId },
        data: {
          socialDeterminants:
            updatedSocial as Parameters<typeof db.patient.update>[0]["data"]["socialDeterminants"],
        },
      });
    }

    logAudit({
      actorId: session.user.id,
      action: "screening.administered",
      resource: "Screening",
      resourceId: screening.id,
      metadata: { patientId, type, score, riskResult },
    });

    // Fire-and-forget: evaluate protocol auto-activation triggers
    evaluateScreeningTriggers({
      patientId,
      providerId: session.user.id,
      screeningType: type,
      score,
      riskResult,
    });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true, data: { screeningId: screening.id, score, riskResult } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record screening";
    return { success: false, error: message };
  }
}

export async function getPatientScreenings(patientId: string) {
  const session = await getSessionOrThrow();
  requirePermission(session, PERMISSIONS.PATIENT_READ);
  await verifyPatientOwnership(patientId, session);

  return db.screening.findMany({
    where: { patientId },
    orderBy: { administeredAt: "desc" },
  });
}
