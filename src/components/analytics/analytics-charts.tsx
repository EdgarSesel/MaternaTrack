"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { differenceInDays } from "date-fns";
import { Users, AlertCircle, CheckCircle, MessageSquare, TrendingUp } from "lucide-react";
import type { AnalyticsData } from "@/app/dashboard/analytics/page";
import { AnalyticsDrilldown } from "@/components/analytics/analytics-drilldown";

// ─── Color constants ────────────────────────────────────────────────────────

const RISK_COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MODERATE: "#eab308",
  HIGH: "#f97316",
  VERY_HIGH: "#ef4444",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  COMPLETED: "#22c55e",
  PENDING: "#94a3b8",
  OVERDUE: "#ef4444",
  SNOOZED: "#eab308",
  NOT_APPLICABLE: "#e2e8f0",
};

const RISK_LABELS: Record<string, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  VERY_HIGH: "Very High",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Completed",
  PENDING: "Pending",
  OVERDUE: "Overdue",
  SNOOZED: "Snoozed",
  NOT_APPLICABLE: "N/A",
};

const PROTOCOL_LABELS: Record<string, string> = {
  standard_prenatal: "Standard Prenatal",
  preeclampsia_prevention: "Preeclampsia Prevention",
  gdm_management: "GDM Management",
  perinatal_depression: "Perinatal Mental Health",
};

// ─── Date range selector ─────────────────────────────────────────────────────

function DateRangeSelector({ current }: { current: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setRange(days: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", String(days));
    router.push(`?${params.toString()}`);
  }

  const options = [
    { label: "30d", value: 30 },
    { label: "60d", value: 60 },
    { label: "90d", value: 90 },
  ];

  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setRange(opt.value)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            current === opt.value
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Stat card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: "green" | "yellow" | "red" | "slate";
}) {
  const accentClass =
    accent === "red"
      ? "text-red-600 bg-red-50"
      : accent === "yellow"
        ? "text-yellow-600 bg-yellow-50"
        : accent === "green"
          ? "text-green-600 bg-green-50"
          : "text-slate-600 bg-slate-100";

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {label}
            </p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${accentClass}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Risk distribution bar chart (clickable) ─────────────────────────────────

function RiskDistributionChart({
  data,
  onDrilldown,
}: {
  data: AnalyticsData["riskDistribution"];
  onDrilldown: (level: string) => void;
}) {
  const chartData = [
    { name: "Low", count: data.LOW, fill: RISK_COLORS.LOW, key: "LOW" },
    { name: "Moderate", count: data.MODERATE, fill: RISK_COLORS.MODERATE, key: "MODERATE" },
    { name: "High", count: data.HIGH, fill: RISK_COLORS.HIGH, key: "HIGH" },
    { name: "Very High", count: data.VERY_HIGH, fill: RISK_COLORS.VERY_HIGH, key: "VERY_HIGH" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between">
          Risk Distribution
          <span className="text-xs font-normal text-slate-400">Click bar to drill down</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={chartData}
            barSize={36}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "#f8fafc" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm">
                    <p className="font-medium text-slate-800">
                      {payload[0].payload.name} Risk
                    </p>
                    <p className="text-slate-500">{payload[0].value} patients</p>
                    <p className="text-xs text-slate-400 mt-0.5">Click to see patients</p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              onClick={(entry) => {
                const payload = entry as { key?: string };
                if (payload.key) onDrilldown(payload.key);
              }}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Risk trend line chart ────────────────────────────────────────────────────

function RiskTrendChart({
  data,
  rangeDays,
}: {
  data: AnalyticsData["riskTrend"];
  rangeDays: number;
}) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            Risk Score Trend ({rangeDays}d)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-400 text-center py-10">
            No historical data in this period
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4" />
          Risk Score Trend ({rangeDays}d)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <ReferenceLine
              y={51}
              stroke="#f97316"
              strokeDasharray="4 2"
              strokeWidth={1}
              label={{ value: "High", position: "insideTopRight", fontSize: 10, fill: "#f97316" }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm">
                    <p className="font-medium text-slate-800">{label}</p>
                    <p className="text-indigo-600">Avg score: {payload[0]?.value}</p>
                    <p className="text-orange-500">High risk patients: {payload[1]?.value}</p>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="avgScore"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: "#6366f1", r: 3 }}
              activeDot={{ r: 5 }}
              name="Avg Score"
            />
            <Line
              type="monotone"
              dataKey="highRiskCount"
              stroke="#f97316"
              strokeWidth={2}
              dot={{ fill: "#f97316", r: 3 }}
              activeDot={{ r: 5 }}
              strokeDasharray="4 2"
              name="High Risk"
            />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 justify-center">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-0.5 bg-indigo-500" />
            <span className="text-xs text-slate-500">Avg risk score</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-5 border-t-2 border-dashed border-orange-400" />
            <span className="text-xs text-slate-500">High risk count</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Task status donut ───────────────────────────────────────────────────────

function TaskStatusChart({
  data,
}: {
  data: AnalyticsData["taskStatusDistribution"];
}) {
  const entries = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: TASK_STATUS_LABELS[k] ?? k,
      value: v,
      fill: TASK_STATUS_COLORS[k] ?? "#e2e8f0",
    }));

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Task Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-400 text-center py-10">No tasks yet</p>
        </CardContent>
      </Card>
    );
  }

  const total = entries.reduce((s, e) => s + e.value, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          Task Status ({total} total)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={entries}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {entries.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm">
                    <p className="font-medium text-slate-800">{payload[0].name}</p>
                    <p className="text-slate-500">
                      {payload[0].value} tasks (
                      {Math.round(((payload[0].value as number) / total) * 100)}%)
                    </p>
                  </div>
                );
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span className="text-xs text-slate-600">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Protocol adoption ───────────────────────────────────────────────────────

function ProtocolAdoptionChart({
  protocols,
}: {
  protocols: AnalyticsData["activeProtocols"];
}) {
  if (protocols.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">
            Active Protocols
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-400 text-center py-6">No protocols activated</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = protocols.map((p) => ({
    name: PROTOCOL_LABELS[p.type] ?? p.type,
    count: p.count,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">
          Active Protocols
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} layout="vertical" barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fontSize: 11, fill: "#64748b" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "#f8fafc" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm shadow-sm">
                    <p className="font-medium text-slate-800">{payload[0].payload.name}</p>
                    <p className="text-slate-500">{payload[0].value} active patients</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Priority patients table ─────────────────────────────────────────────────

function PriorityPatientsTable({
  patients,
}: {
  patients: AnalyticsData["topRiskPatients"];
}) {
  if (patients.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-500" />
          High Priority Patients
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {patients.map((p) => {
            const daysSinceContact = p.lastContactAt
              ? differenceInDays(new Date(), new Date(p.lastContactAt))
              : null;
            const riskColor = RISK_COLORS[p.riskLevel] ?? "#94a3b8";

            return (
              <Link
                key={p.id}
                href={`/dashboard/patients/${p.id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ backgroundColor: riskColor }}
                >
                  {p.riskScore}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-xs text-slate-400">
                    {RISK_LABELS[p.riskLevel]} risk
                    {daysSinceContact !== null
                      ? ` · Last contact ${daysSinceContact}d ago`
                      : " · Never contacted"}
                  </p>
                </div>

                {p.careTasks.length > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-red-600">
                      {p.careTasks.length} overdue task{p.careTasks.length > 1 ? "s" : ""}
                    </p>
                    <p className="text-xs text-slate-400 truncate max-w-40">
                      {p.careTasks[0].title}
                    </p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Engagement metrics ─────────────────────────────────────────────────────

function EngagementMetrics({ data }: { data: AnalyticsData }) {
  const contactRate =
    data.totalPatients > 0
      ? Math.round((data.contactedThisWeek / data.totalPatients) * 100)
      : 0;

  const items = [
    {
      label: "Contacted this week",
      value: `${data.contactedThisWeek} / ${data.totalPatients}`,
      sub: `${contactRate}% contact rate`,
      color:
        contactRate >= 70
          ? "text-green-600"
          : contactRate >= 40
            ? "text-yellow-600"
            : "text-red-600",
    },
    {
      label: "No contact in 14+ days",
      value: data.notContactedIn14Days,
      sub: "need outreach",
      color: data.notContactedIn14Days > 5 ? "text-red-600" : "text-slate-700",
    },
    {
      label: "Task completion rate",
      value: `${data.taskCompletionRate}%`,
      sub: `${data.overdueTasks} overdue`,
      color:
        data.taskCompletionRate >= 75
          ? "text-green-600"
          : data.taskCompletionRate >= 50
            ? "text-yellow-600"
            : "text-red-600",
    },
    {
      label: "Missing depression screen",
      value: data.missingDepressionScreen,
      sub: "no PHQ-9/EPDS in 90 days",
      color: data.missingDepressionScreen > 0 ? "text-amber-600" : "text-slate-700",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-600">
          Care Quality Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {items.map((item) => (
            <div key={item.label} className="space-y-0.5">
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-slate-400">{item.sub}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function AnalyticsCharts({ data }: { data: AnalyticsData }) {
  const [drilldownLevel, setDrilldownLevel] = useState<string | null>(null);
  const highRiskCount = data.riskDistribution.HIGH + data.riskDistribution.VERY_HIGH;

  const drilldownPatients = drilldownLevel
    ? (data.drilldownByRisk[drilldownLevel] ?? [])
    : [];

  return (
    <div className="space-y-5">
      {/* Header row with date range */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Trend period</p>
        <DateRangeSelector current={data.rangeDays} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Patients"
          value={data.totalPatients}
          sub={`${data.patientStatus["PREGNANT"] ?? 0} pregnant`}
          icon={Users}
          accent="slate"
        />
        <StatCard
          label="High / Very High Risk"
          value={highRiskCount}
          sub={`${data.totalPatients > 0 ? Math.round((highRiskCount / data.totalPatients) * 100) : 0}% of panel`}
          icon={AlertCircle}
          accent={highRiskCount > 5 ? "red" : "yellow"}
        />
        <StatCard
          label="Task Completion"
          value={`${data.taskCompletionRate}%`}
          sub={`${data.overdueTasks} overdue`}
          icon={CheckCircle}
          accent={data.taskCompletionRate >= 75 ? "green" : "yellow"}
        />
        <StatCard
          label="Contacted This Week"
          value={data.contactedThisWeek}
          sub={`${data.notContactedIn14Days} need outreach`}
          icon={MessageSquare}
          accent={data.notContactedIn14Days > 5 ? "red" : "green"}
        />
      </div>

      {/* Risk trend + task status */}
      <div className="grid md:grid-cols-2 gap-5">
        <RiskTrendChart data={data.riskTrend} rangeDays={data.rangeDays} />
        <TaskStatusChart data={data.taskStatusDistribution} />
      </div>

      {/* Risk distribution (clickable) + engagement */}
      <div className="grid md:grid-cols-2 gap-5">
        <RiskDistributionChart
          data={data.riskDistribution}
          onDrilldown={setDrilldownLevel}
        />
        <EngagementMetrics data={data} />
      </div>

      {/* Protocol adoption + priority patients */}
      <div className="grid md:grid-cols-2 gap-5">
        <ProtocolAdoptionChart protocols={data.activeProtocols} />
        <PriorityPatientsTable patients={data.topRiskPatients} />
      </div>

      {/* Drill-down sheet */}
      <AnalyticsDrilldown
        riskLevel={drilldownLevel}
        patients={drilldownPatients}
        onClose={() => setDrilldownLevel(null)}
      />
    </div>
  );
}
