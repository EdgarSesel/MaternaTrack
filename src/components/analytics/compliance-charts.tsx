"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CheckCircle, AlertCircle, ChevronRight, Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComplianceStat } from "@/lib/compliance-rules";

const GUIDELINE_COLORS: Record<string, string> = {
  ACOG: "#3b82f6",
  USPSTF: "#8b5cf6",
  SMFM: "#ec4899",
};

const GUIDELINE_BG: Record<string, string> = {
  ACOG: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
  USPSTF: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800",
  SMFM: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800",
};

type Guideline = "ACOG" | "USPSTF" | "SMFM";
type FilterTab = "all" | Guideline;

function rateColor(rate: number) {
  if (rate >= 90) return "#22c55e";
  if (rate >= 70) return "#eab308";
  return "#ef4444";
}

function RateRing({ rate }: { rate: number }) {
  const color = rateColor(rate);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  return (
    <svg width={72} height={72} className="shrink-0">
      <circle cx={36} cy={36} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
      <circle
        cx={36} cy={36} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
      <text x={36} y={40} textAnchor="middle" fontSize={14} fontWeight="bold" fill={color}>
        {rate}%
      </text>
    </svg>
  );
}

function NonCompliantSheet({
  stat,
  open,
  onClose,
}: {
  stat: ComplianceStat;
  open: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = stat.nonCompliantPatients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) { onClose(); setSearch(""); } }}>
      <SheetContent side="right" className="w-full sm:w-125 p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div className="flex items-start gap-3">
            <RateRing rate={stat.rate} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge
                  variant="outline"
                  className={cn("text-xs font-medium", GUIDELINE_BG[stat.rule.guideline])}
                >
                  {stat.rule.guideline}
                </Badge>
              </div>
              <SheetTitle className="text-base leading-snug">{stat.rule.title}</SheetTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {stat.rule.description}
              </p>
            </div>
          </div>

          {/* Summary row */}
          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
            <div className="text-center">
              <p className="text-lg font-bold text-green-600">{stat.compliant}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Compliant</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-500">{stat.nonCompliantPatients.length}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Need action</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{stat.total}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total</p>
            </div>
          </div>
        </SheetHeader>

        {/* Search — only shown when list is long enough to warrant it */}
        {stat.nonCompliantPatients.length > 4 && (
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                placeholder="Search patients…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
          </div>
        )}

        {/* Patient list */}
        <div className="flex-1 overflow-y-auto">
          {stat.nonCompliantPatients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mb-3" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                All patients compliant
              </p>
              <p className="text-xs text-slate-400 mt-1">No action required for this rule</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm text-slate-500">No patients match &quot;{search}&quot;</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {filtered.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/patients/${p.id}`}
                  onClick={onClose}
                  className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                      {p.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 group-hover:text-rose-600 dark:group-hover:text-rose-400 leading-snug">
                      {p.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.detail}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-rose-400 shrink-0 mt-1" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface ComplianceChartsProps {
  stats: ComplianceStat[];
}

const FILTER_TABS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ACOG", label: "ACOG" },
  { value: "USPSTF", label: "USPSTF" },
  { value: "SMFM", label: "SMFM" },
];

export function ComplianceCharts({ stats }: ComplianceChartsProps) {
  const [selectedStat, setSelectedStat] = useState<ComplianceStat | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const overallRate =
    stats.length === 0
      ? 100
      : Math.round(stats.reduce((sum, s) => sum + s.rate, 0) / stats.length);

  const filteredStats = stats.filter(
    (s) => s.total > 0 && (activeFilter === "all" || s.rule.guideline === activeFilter),
  );

  const chartData = filteredStats.map((s) => ({
    name: s.rule.title.length > 32 ? s.rule.title.slice(0, 32) + "…" : s.rule.title,
    rate: s.rate,
    total: s.total,
    compliant: s.compliant,
    guideline: s.rule.guideline,
    stat: s,
  }));

  return (
    <>
      {/* Score cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-5 flex flex-col items-center justify-center text-center">
            <div className="text-4xl font-bold mb-1" style={{ color: rateColor(overallRate) }}>
              {overallRate}%
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Overall</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              {stats.filter((s) => s.total > 0).length} active rules
            </p>
          </CardContent>
        </Card>

        {(["ACOG", "USPSTF", "SMFM"] as const).map((g) => {
          const gStats = stats.filter((s) => s.rule.guideline === g && s.total > 0);
          const rate =
            gStats.length === 0
              ? 100
              : Math.round(gStats.reduce((sum, s) => sum + s.rate, 0) / gStats.length);
          const isActive = activeFilter === g;
          return (
            <Card
              key={g}
              className="cursor-pointer hover:shadow-md transition-all"
              onClick={() => setActiveFilter(isActive ? "all" : g)}
              style={{ borderColor: isActive ? GUIDELINE_COLORS[g] : undefined, borderWidth: isActive ? 2 : undefined }}
            >
              <CardContent className="p-5 flex flex-col items-center justify-center text-center">
                <div className="font-bold text-3xl mb-1" style={{ color: rateColor(rate) }}>
                  {rate}%
                </div>
                <p className="text-sm font-medium" style={{ color: GUIDELINE_COLORS[g] }}>
                  {g}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {gStats.length} rule{gStats.length !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Chart + filter tabs */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm">Adherence by Guideline Rule</CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Click a bar or card to see non-compliant patients
              </p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveFilter(tab.value)}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                    activeFilter === tab.value
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-5">
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              No applicable patients found for this filter.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={chartData.length * 44 + 20}>
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{ left: 10, right: 50, top: 0, bottom: 0 }}
                onClick={(data: unknown) => {
                  const d = data as { activePayload?: { payload: typeof chartData[0] }[] };
                  if (d?.activePayload?.[0]) {
                    setSelectedStat(d.activePayload[0].payload.stat);
                  }
                }}
              >
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={210} />
                <Tooltip
                  formatter={(val, _name, props) => {
                    const d = props.payload as typeof chartData[0];
                    return [`${d.compliant}/${d.total} patients (${val}%)`, "Compliant"];
                  }}
                />
                <Bar dataKey="rate" radius={[0, 4, 4, 0]} cursor="pointer">
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={rateColor(entry.rate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Rule cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        {filteredStats.map((s) => (
          <button
            key={s.rule.id}
            onClick={() => setSelectedStat(s)}
            className="text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] font-semibold px-1.5 py-0", GUIDELINE_BG[s.rule.guideline])}
                  >
                    {s.rule.guideline}
                  </Badge>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
                    {s.rule.title}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {s.rule.description}
                </p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="font-bold text-xl leading-none" style={{ color: rateColor(s.rate) }}>
                  {s.rate}%
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {s.compliant}/{s.total}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${s.rate}%`, backgroundColor: rateColor(s.rate) }}
              />
            </div>

            <div className="mt-2">
              {s.nonCompliantPatients.length > 0 ? (
                <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="w-3 h-3" />
                  {s.nonCompliantPatients.length} patient{s.nonCompliantPatients.length !== 1 ? "s" : ""} need attention
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="w-3 h-3" />
                  All compliant
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Drill-down sheet */}
      {selectedStat && (
        <NonCompliantSheet
          stat={selectedStat}
          open={!!selectedStat}
          onClose={() => setSelectedStat(null)}
        />
      )}
    </>
  );
}
