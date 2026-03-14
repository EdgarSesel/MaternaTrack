import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { predictRiskTrend } from "@/lib/risk-predictor";

interface PatientWithHistory {
  id: string;
  firstName: string;
  lastName: string;
  riskScore: number;
  riskScoreHistory: { score: number; calculatedAt: Date }[];
}

interface Props {
  patients: PatientWithHistory[];
}

export function RisingRiskBanner({ patients }: Props) {
  // Evaluate each patient's trajectory
  const alertingPatients = patients
    .map((p) => {
      const trend = predictRiskTrend(
        p.riskScoreHistory.map((h) => ({ score: h.score, calculatedAt: h.calculatedAt }))
      );
      return { patient: p, trend };
    })
    .filter(({ trend }) => trend.alert !== null)
    .sort((a, b) => {
      // critical_trajectory first
      if (a.trend.alert === "critical_trajectory" && b.trend.alert !== "critical_trajectory") return -1;
      if (b.trend.alert === "critical_trajectory" && a.trend.alert !== "critical_trajectory") return 1;
      return b.patient.riskScore - a.patient.riskScore;
    });

  if (alertingPatients.length === 0) return null;

  const hasCritical = alertingPatients.some(({ trend }) => trend.alert === "critical_trajectory");

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        hasCritical
          ? "bg-red-50 border-red-200"
          : "bg-orange-50 border-orange-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className={`w-5 h-5 mt-0.5 shrink-0 ${hasCritical ? "text-red-500" : "text-orange-500"}`}
        />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${hasCritical ? "text-red-800" : "text-orange-800"}`}>
            Rising Risk Detected &mdash; {alertingPatients.length} patient
            {alertingPatients.length !== 1 ? "s" : ""} show escalating risk trajectories
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {alertingPatients.map(({ patient, trend }) => (
              <Link
                key={patient.id}
                href={`/dashboard/patients/${patient.id}`}
                className={`text-sm underline underline-offset-2 hover:no-underline font-medium ${
                  trend.alert === "critical_trajectory"
                    ? "text-red-700 hover:text-red-900"
                    : "text-orange-700 hover:text-orange-900"
                }`}
              >
                {patient.firstName} {patient.lastName}
                <span className="font-normal ml-1 text-xs">
                  ({patient.riskScore} → {trend.projectedScore7d} in 7d)
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
