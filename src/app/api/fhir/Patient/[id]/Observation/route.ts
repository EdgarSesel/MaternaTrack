/**
 * FHIR R4 Observation Bundle Endpoint
 * GET /api/fhir/Patient/[id]/Observation
 *
 * Returns all vitals as FHIR R4 Observation resources in a searchset Bundle.
 * Supports ?type= query param to filter by vital type.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { toFhirObservation, toFhirBundle } from "@/lib/fhir-mapper";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const typeFilter = url.searchParams.get("type");

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
    select: { id: true },
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

  const vitals = await db.vital.findMany({
    where: {
      patientId: id,
      ...(typeFilter ? { type: typeFilter } : {}),
    },
    orderBy: { recordedAt: "desc" },
    select: { id: true, patientId: true, type: true, value: true, recordedAt: true, source: true },
  });

  const observations = vitals.map((v) =>
    toFhirObservation({
      id: v.id,
      patientId: v.patientId,
      type: v.type,
      value: v.value as Record<string, unknown>,
      recordedAt: v.recordedAt,
      source: v.source,
    }),
  );

  const bundle = toFhirBundle(observations, "searchset", observations.length);

  return new Response(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/fhir+json",
      "X-FHIR-Version": "4.0.1",
    },
  });
}
