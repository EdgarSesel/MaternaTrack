/**
 * GET /api/export/patients
 *
 * Export patient list as CSV. RBAC-enforced.
 * Admins export all patients; providers export their own.
 * No PHI in URL params.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, PERMISSIONS, isAdmin, getProviderScope } from "@/lib/rbac";
import { toCsv, csvResponse } from "@/lib/export";
import { logAudit } from "@/lib/audit";
import { format } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  requirePermission(session, PERMISSIONS.PATIENT_READ);

  const scope = getProviderScope(session);
  const patientWhere = scope
    ? { providerId: scope, deletedAt: null }
    : { deletedAt: null };

  const patients = await db.patient.findMany({
    where: patientWhere,
    orderBy: { riskScore: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      status: true,
      riskLevel: true,
      riskScore: true,
      gestationalAgeWeeks: true,
      dueDate: true,
      enrollmentDate: true,
      insuranceType: true,
      lastContactAt: true,
      lastContactChannel: true,
      provider: { select: { name: true, role: true } },
    },
  });

  const rows = patients.map((p) => ({
    "Patient ID": p.id,
    "First Name": p.firstName,
    "Last Name": p.lastName,
    "Date of Birth": format(new Date(p.dateOfBirth), "yyyy-MM-dd"),
    "Status": p.status,
    "Risk Level": p.riskLevel,
    "Risk Score": p.riskScore,
    "Gestational Age (weeks)": p.gestationalAgeWeeks ?? "",
    "Due Date": p.dueDate ? format(new Date(p.dueDate), "yyyy-MM-dd") : "",
    "Enrollment Date": format(new Date(p.enrollmentDate), "yyyy-MM-dd"),
    "Insurance": p.insuranceType ?? "",
    "Last Contact": p.lastContactAt ? format(new Date(p.lastContactAt), "yyyy-MM-dd") : "",
    "Last Contact Channel": p.lastContactChannel ?? "",
    "Provider": p.provider.name,
    "Provider Role": p.provider.role,
  }));

  logAudit({
    actorId: session.user.id,
    action: "export.patients.csv",
    resource: "Patient",
    metadata: { count: patients.length, scope: scope ?? "all" },
  });

  const csv = toCsv(rows);
  const filename = `patients-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
  return csvResponse(csv, filename);
}
