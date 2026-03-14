"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Baby, Activity } from "lucide-react";
import type { OutcomesData } from "@/app/dashboard/analytics/page";

const DELIVERY_COLORS = ["#22c55e", "#f97316", "#3b82f6"];

function BenchmarkCard({
  label,
  rate,
  benchmark,
  suffix = "%",
}: {
  label: string;
  rate: number;
  benchmark: number;
  suffix?: string;
}) {
  const diff = Math.round((rate - benchmark) * 10) / 10;
  const better = diff < 0;
  const same = Math.abs(diff) < 0.5;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
        {rate}
        {suffix}
      </p>
      <div className="flex items-center gap-1 mt-1">
        {same ? (
          <Minus className="w-3.5 h-3.5 text-slate-400" />
        ) : better ? (
          <TrendingDown className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <TrendingUp className="w-3.5 h-3.5 text-red-500" />
        )}
        <span
          className={`text-xs font-medium ${
            same
              ? "text-slate-400"
              : better
              ? "text-green-600 dark:text-green-400"
              : "text-red-600 dark:text-red-400"
          }`}
        >
          {same ? "At benchmark" : `${better ? "" : "+"}${diff}% vs national avg (${benchmark}%)`}
        </span>
      </div>
    </div>
  );
}

export function OutcomesCharts({ data }: { data: OutcomesData }) {
  const deliveryData = [
    { name: "Vaginal", value: data.deliveryTypes.vaginal },
    { name: "C-Section", value: data.deliveryTypes.cSection },
    { name: "VBAC", value: data.deliveryTypes.vbac },
  ].filter((d) => d.value > 0);

  const hasMonthlyData = data.monthlyTrend.some((m) => m.total > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Baby className="w-5 h-5 text-pink-500" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Delivery Outcomes
        </h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          — {data.total} birth{data.total !== 1 ? "s" : ""} recorded
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Delivery type donut */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Delivery Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={deliveryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {deliveryData.map((_, i) => (
                    <Cell key={i} fill={DELIVERY_COLORS[i % DELIVERY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val, name) => [`${val} births`, name]}
                  contentStyle={{
                    background: "var(--tooltip-bg, #fff)",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-xs text-slate-600 dark:text-slate-400">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Benchmark stats grid */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-3 content-start">
          <BenchmarkCard
            label="C-Section Rate"
            rate={data.rates.cSection}
            benchmark={data.benchmarks.cSectionRate}
          />
          <BenchmarkCard
            label="Preterm Birth Rate"
            rate={data.rates.preterm}
            benchmark={data.benchmarks.pretermRate}
          />
          <BenchmarkCard
            label="NICU Admission Rate"
            rate={data.rates.nicu}
            benchmark={data.benchmarks.nicuRate}
          />
          <BenchmarkCard
            label="Low Birth Weight"
            rate={data.rates.lowBirthWeight}
            benchmark={data.benchmarks.lowBirthWeightRate}
          />
        </div>
      </div>

      {/* Postpartum screening + monthly trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Postpartum depression screening card */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-purple-500" />
              Postpartum Depression Screening
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.postpartumTotal === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                No postpartum patients currently
              </p>
            ) : data.postpartumScreeningRate === null ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                No data available
              </p>
            ) : (
              <div className="space-y-3 mt-1">
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                    {data.postpartumScreeningRate}%
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400 pb-1">screened</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      data.postpartumScreeningRate >= 80
                        ? "bg-green-500"
                        : data.postpartumScreeningRate >= 50
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${data.postpartumScreeningRate}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  PHQ-9 or EPDS in last 6 weeks · {data.postpartumTotal} postpartum patient
                  {data.postpartumTotal !== 1 ? "s" : ""}
                </p>
                {data.postpartumScreeningRate < 100 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    USPSTF recommends screening all postpartum patients
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 6-month trend */}
        {hasMonthlyData && (
          <Card className="lg:col-span-2 dark:bg-slate-900 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">
                6-Month Outcome Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={data.monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} unit="%" domain={[0, 50]} />
                  <Tooltip
                    formatter={(val, name) => [`${val}%`, name]}
                    contentStyle={{
                      background: "var(--tooltip-bg, #fff)",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} />
                  <Line
                    type="monotone"
                    dataKey="cSectionRate"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    name="C-Section Rate"
                  />
                  <Line
                    type="monotone"
                    dataKey="nicuRate"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    name="NICU Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
