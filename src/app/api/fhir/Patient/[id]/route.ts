/**
 * FHIR R4 Patient Resource Endpoint
 * GET /api/fhir/Patient/[id]
 *
 * Returns a FHIR R4 Patient resource for the specified patient.
 * Requires valid provider session and patient ownership.
 * Content-Type: application/fhir+json
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { toFhirPatient } from "@/lib/fhir-mapper";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const where = isAdmin(session)
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
    where,
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
      createdAt: true,
    },
  });

  if (!patient) {
    return Response.json(
      {
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "not-found", diagnostics: "Patient not found" }],
      },
      { status: 404, headers: { "Content-Type": "application/fhir+json" } },
    );
  }

  const fhirPatient = toFhirPatient(patient);

  return new Response(JSON.stringify(fhirPatient, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/fhir+json",
      "X-FHIR-Version": "4.0.1",
    },
  });
}
