"use client";

import Link from "next/link";
import { differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Users, Download, AlertTriangle, Clock } from "lucide-react";
import type { RiskLevel, PatientStatus, TaskStatus } from "@/generated/prisma/client";

const RISK_COLORS: Record<string, string> = {
  LOW: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  MODERATE: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800",
  VERY_HIGH: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
};

interface CohortPatient {
  id: string;
  firstName: string;
  lastName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  status: PatientStatus;
  gestationalAgeWeeks: number | null;
  dueDate: Date | null;
  lastContactAt: Date | null;
  careTasks: { status: TaskStatus }[];
}

interface CohortResultsProps {
  patients: CohortPatient[];
  total: number;
  exportUrl: string;
}

export function CohortResults({ patients, total, exportUrl }: CohortResultsProps) {
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-slate-500 dark:text-slate-400 font-medium">No patients match these filters</p>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
          Try adjusting or clearing some filters
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Result header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{total}</span>{" "}
          patient{total !== 1 ? "s" : ""} match your filters
        </p>
        <a
          href={exportUrl}
          download
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg px-3 py-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </a>
      </div>

      {/* Patient list */}
      {patients.map((patient) => {
        const overdueCount = patient.careTasks.filter(
          (t) => t.status === "OVERDUE",
        ).length;
        const daysSinceContact = patient.lastContactAt
          ? differenceInDays(new Date(), patient.lastContactAt)
          : null;

        return (
          <Link
            key={patient.id}
            href={`/dashboard/patients/${patient.id}`}
            className="block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {patient.firstName} {patient.lastName}
                  </p>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0 h-4", RISK_COLORS[patient.riskLevel])}
                  >
                    {patient.riskLevel.replace("_", " ")}
                  </Badge>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wide">
                    {patient.status.toLowerCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                  {patient.gestationalAgeWeeks != null && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {patient.gestationalAgeWeeks}w GA
                    </span>
                  )}
                  {patient.dueDate && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      EDD {new Date(patient.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                  {daysSinceContact !== null ? (
                    <span
                      className={cn(
                        "text-xs",
                        daysSinceContact > 14
                          ? "text-red-600 dark:text-red-400 font-medium"
                          : "text-slate-500 dark:text-slate-400",
                      )}
                    >
                      <Clock className="w-3 h-3 inline mr-0.5" />
                      {daysSinceContact}d since contact
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">Never contacted</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-none">
                    {patient.riskScore}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">risk</p>
                </div>
                {overdueCount > 0 && (
                  <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-2 py-1">
                    <AlertTriangle className="w-3 h-3 text-red-500" />
                    <span className="text-[10px] font-medium text-red-700 dark:text-red-400">
                      {overdueCount} overdue
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
