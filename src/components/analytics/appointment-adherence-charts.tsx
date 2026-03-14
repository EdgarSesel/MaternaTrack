"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { AdherenceData } from "@/app/dashboard/analytics/page";

export function AppointmentAdherenceCharts({ data }: { data: AdherenceData }) {
  const { adherenceRate, totalScheduled, noShows, noShowByType, highNoShowPatients } = data;

  if (totalScheduled === 0) return null;

  const adherenceColor =
    adherenceRate >= 80 ? "#22c55e" : adherenceRate >= 60 ? "#eab308" : "#ef4444";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-blue-500" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Appointment Adherence
        </h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          — {totalScheduled} appointment{totalScheduled !== 1 ? "s" : ""} tracked
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Adherence rate stat */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Overall Adherence Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <span
                className="text-5xl font-bold"
                style={{ color: adherenceColor }}
              >
                {adherenceRate}%
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400 pb-1.5">attended</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5">
              <div
                className="h-2.5 rounded-full transition-all"
                style={{ width: `${adherenceRate}%`, backgroundColor: adherenceColor }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{noShows} no-show{noShows !== 1 ? "s" : ""}</span>
              <span>{totalScheduled - noShows} attended or cancelled</span>
            </div>
          </CardContent>
        </Card>

        {/* No-show by type bar chart */}
        {noShowByType.length > 0 ? (
          <Card className="dark:bg-slate-900 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No-Shows by Appointment Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={noShowByType}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    allowDecimals={false}
                  />
                  <YAxis
                    dataKey="type"
                    type="category"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    width={90}
                  />
                  <Tooltip
                    formatter={(val, name) =>
                      name === "noShows" ? [`${val}`, "No-shows"] : [`${val}%`, "Rate"]
                    }
                    contentStyle={{
                      background: "var(--tooltip-bg, #fff)",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="noShows" fill="#ef4444" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <Card className="dark:bg-slate-900 dark:border-slate-700 flex items-center justify-center">
            <CardContent className="text-center py-8">
              <p className="text-sm text-slate-400 dark:text-slate-500">No no-show data yet</p>
            </CardContent>
          </Card>
        )}

        {/* High no-show patients */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Patients Needing Outreach
            </CardTitle>
          </CardHeader>
          <CardContent>
            {highNoShowPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <div className="text-2xl mb-1">✓</div>
                <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                  No high no-show patients
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {highNoShowPatients.map((p) => (
                  <li key={p.patientId}>
                    <Link
                      href={`/dashboard/patients/${p.patientId}`}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                    >
                      <span className="text-sm text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                        {p.name}
                      </span>
                      <span className="shrink-0 ml-2 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full px-2 py-0.5">
                        {p.count} missed
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
