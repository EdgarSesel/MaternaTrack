"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import Link from "next/link";
import type { AnalyticsData } from "@/app/dashboard/analytics/page";

const RISK_LABELS: Record<string, string> = {
  LOW: "Low Risk",
  MODERATE: "Moderate Risk",
  HIGH: "High Risk",
  VERY_HIGH: "Very High Risk",
};

const RISK_COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MODERATE: "#eab308",
  HIGH: "#f97316",
  VERY_HIGH: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  PREGNANT: "Pregnant",
  PRECONCEPTION: "Preconception",
  POSTPARTUM: "Postpartum",
  INACTIVE: "Inactive",
};

type DrilldownPatient = AnalyticsData["drilldownByRisk"][string][number];

interface Props {
  riskLevel: string | null;
  patients: DrilldownPatient[];
  onClose: () => void;
}

export function AnalyticsDrilldown({ riskLevel, patients, onClose }: Props) {
  if (!riskLevel) return null;

  const color = RISK_COLORS[riskLevel] ?? "#94a3b8";
  const label = RISK_LABELS[riskLevel] ?? riskLevel;

  return (
    <Sheet open={!!riskLevel} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <span
              className="inline-block w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            {label} — {patients.length} patient{patients.length !== 1 ? "s" : ""}
          </SheetTitle>
        </SheetHeader>

        {patients.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-12">
            No patients at this risk level
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {patients.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/patients/${p.id}`}
                onClick={onClose}
                className="flex items-center gap-3 py-3 hover:bg-slate-50 transition-colors rounded-lg px-2 -mx-2"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: color }}
                >
                  {p.riskScore}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {STATUS_LABELS[p.status] ?? p.status}
                    {p.gestationalAgeWeeks ? ` · ${p.gestationalAgeWeeks}w GA` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
