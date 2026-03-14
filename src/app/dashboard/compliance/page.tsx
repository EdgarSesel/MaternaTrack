/**
 * /dashboard/compliance
 *
 * Clinical compliance dashboard — adherence to ACOG/USPSTF/SMFM guidelines
 * across the provider's patient panel.
 */

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProviderScope } from "@/lib/rbac";
import { evaluatePatientCompliance, aggregateCompliance } from "@/lib/compliance-rules";
import { ComplianceCharts } from "@/components/analytics/compliance-charts";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "Compliance — MaternaTrack" };

export default async function CompliancePage() {
  const session = await auth();
  const scope = getProviderScope(session!);
  const providerFilter = scope ? { providerId: scope } : {};

  const patients = await db.patient.findMany({
    where: {
      ...providerFilter,
      deletedAt: null,
      status: { in: ["PREGNANT", "POSTPARTUM"] },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      gestationalAgeWeeks: true,
      enrollmentDate: true,
      riskFactors: true,
      screenings: {
        select: { type: true, administeredAt: true },
        orderBy: { administeredAt: "asc" },
      },
      carePlans: {
        where: { deletedAt: null, status: "active" },
        select: { protocolType: true, activatedAt: true },
      },
    },
  });

  const allResults = patients.flatMap((p) =>
    evaluatePatientCompliance({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      status: p.status,
      gestationalAgeWeeks: p.gestationalAgeWeeks,
      enrollmentDate: p.enrollmentDate,
      riskFactors: p.riskFactors,
      screenings: p.screenings,
      carePlans: p.carePlans,
    })
  );

  const stats = aggregateCompliance(allResults);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-rose-500" />
            <h1 className="text-2xl font-semibold text-slate-900">Clinical Compliance</h1>
          </div>
          <p className="text-slate-500 text-sm">
            Guideline adherence across your panel — ACOG, USPSTF, and SMFM.
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Includes {patients.length} active pregnant and postpartum patient{patients.length !== 1 ? "s" : ""}.
          </p>
        </div>
      </div>

      <ComplianceCharts stats={stats} />
    </div>
  );
}
