/**
 * FHIR R4 $everything Operation
 * GET /api/fhir/Patient/[id]/$everything
 *
 * Returns a comprehensive FHIR R4 Bundle containing all clinical data for a patient:
 *   - Patient resource
 *   - Observation resources (all vitals)
 *   - Gestational age Observation (if applicable)
 *   - Condition resources (risk factors / medical history)
 *   - CarePlan resources (active care plans)
 *
 * Content-Type: application/fhir+json
 * Conforms to US Core $everything operation pattern.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import {
  toFhirPatient,
  toFhirObservation,
  toFhirGestationalAgeObservation,
  toFhirBundle,
} from "@/lib/fhir-mapper";

function toFhirCondition(
  patientId: string,
  factor: { factor: string; label?: string; score?: number },
  index: number,
) {
  return {
    resourceType: "Condition",
    id: `condition-${patientId}-${index}`,
    meta: { profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition-problems-health-concerns"] },
    clinicalStatus: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }],
    },
    category: [
      {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "problem-list-item" }],
      },
    ],
    code: {
      text: factor.label ?? factor.factor,
      coding: [
        {
          system: "https://materna-track.dev/fhir/CodeSystem/risk-factors",
          code: factor.factor,
          display: factor.label ?? factor.factor,
        },
      ],
    },
    subject: { reference: `Patient/${patientId}` },
    extension: [
      ...(factor.score != null
        ? [
            {
              url: "https://materna-track.dev/fhir/StructureDefinition/risk-score-contribution",
              valueInteger: factor.score,
            },
          ]
        : []),
    ],
  };
}

function toFhirCarePlan(
  patientId: string,
  plan: { id: string; protocolType: string; status: string; activatedAt: Date },
) {
  const statusMap: Record<string, string> = {
    active: "active",
    completed: "completed",
    discontinued: "revoked",
  };

  return {
    resourceType: "CarePlan",
    id: plan.id,
    meta: { profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan"] },
    status: statusMap[plan.status] ?? "active",
    intent: "plan",
    title: plan.protocolType.replace(/_/g, " "),
    subject: { reference: `Patient/${patientId}` },
    period: { start: plan.activatedAt.toISOString() },
    category: [
      {
        coding: [
          {
            system: "http://hl7.org/fhir/us/core/CodeSystem/careplan-category",
            code: "assess-plan",
          },
        ],
      },
      {
        coding: [
          {
            system: "https://materna-track.dev/fhir/CodeSystem/protocol-types",
            code: plan.protocolType,
            display: plan.protocolType.replace(/_/g, " "),
          },
        ],
      },
    ],
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/fhir+json" } },
    );
  }

  const { id } = await params;

  const patientWhere = isAdmin(session)
    ? { id, deletedAt: null }
    : {
        id,
        deletedAt: null,
        OR: [
          { providerId: session.user.id },
          { patientAccesses: { some: { providerId: session.user.id } } },
        ],
      };

  const patient = await db.patient.findFirst({
    where: patientWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gestationalAgeWeeks: true,
      dueDate: true,
      status: true,
      riskScore: true,
      riskLevel: true,
      riskFactors: true,
      createdAt: true,
      vitals: {
        orderBy: { recordedAt: "desc" },
        take: 200,
        select: { id: true, patientId: true, type: true, value: true, recordedAt: true, source: true },
      },
      carePlans: {
        where: { deletedAt: null },
        select: { id: true, protocolType: true, status: true, activatedAt: true },
        orderBy: { activatedAt: "desc" },
      },
    },
  });

  if (!patient) {
    return new Response(
      JSON.stringify({
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "not-found", diagnostics: "Patient not found" }],
      }),
      { status: 404, headers: { "Content-Type": "application/fhir+json" } },
    );
  }

  const resources: unknown[] = [];

  // 1. Patient resource
  resources.push(toFhirPatient(patient));

  // 2. Gestational age Observation
  if (patient.gestationalAgeWeeks != null) {
    resources.push(
      toFhirGestationalAgeObservation(patient.id, patient.gestationalAgeWeeks, patient.createdAt),
    );
  }

  // 3. Vital Observations
  for (const vital of patient.vitals) {
    resources.push(
      toFhirObservation({
        id: vital.id,
        patientId: vital.patientId,
        type: vital.type,
        value: vital.value as Record<string, unknown>,
        recordedAt: vital.recordedAt,
        source: vital.source,
      }),
    );
  }

  // 4. Condition resources (from riskFactors JSON)
  const riskFactors = patient.riskFactors as Array<{
    factor: string;
    label?: string;
    score?: number;
  }> | null;

  if (Array.isArray(riskFactors)) {
    riskFactors.forEach((factor, i) => {
      if (factor.factor && (factor.score == null || factor.score > 0)) {
        resources.push(toFhirCondition(patient.id, factor, i));
      }
    });
  }

  // 5. CarePlan resources
  for (const plan of patient.carePlans) {
    resources.push(toFhirCarePlan(patient.id, plan));
  }

  const bundle = toFhirBundle(resources, "collection", resources.length);

  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/fhir+json",
      "X-FHIR-Version": "4.0.1",
    },
  });
}
