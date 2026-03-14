"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { RiskTrend } from "@/lib/risk-predictor";

interface Props {
  trend: RiskTrend | null;
}

export function RiskTrendIndicator({ trend }: Props) {
  if (!trend) return null;

  const { direction, alert, projectedScore7d } = trend;

  return (
    <div className="flex items-center gap-1.5">
      {/* Direction icon */}
      {direction === "rising" ? (
        <TrendingUp
          className={`w-4 h-4 ${alert === "critical_trajectory" ? "text-red-500" : "text-orange-500"}`}
        />
      ) : direction === "falling" ? (
        <TrendingDown className="w-4 h-4 text-green-500" />
      ) : (
        <Minus className="w-4 h-4 text-slate-400" />
      )}

      {/* Alert badge */}
      {alert === "critical_trajectory" && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 whitespace-nowrap">
          Critical Trajectory
        </span>
      )}
      {alert === "rising_risk" && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 whitespace-nowrap">
          Rising Risk
        </span>
      )}

      {/* Projected score (shown only when direction is rising) */}
      {direction === "rising" && !alert && (
        <span className="text-xs text-slate-500">→ {projectedScore7d} in 7d</span>
      )}
    </div>
  );
}
