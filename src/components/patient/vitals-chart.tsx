"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import type { Vital } from "@/generated/prisma/client";

interface BpValue {
  systolic: number;
  diastolic: number;
}

interface NumericValue {
  value: number;
  unit?: string;
}

function parseBpVital(v: Vital): { date: string; systolic: number; diastolic: number } | null {
  if (v.type !== "bp") return null;
  const val = v.value as unknown as BpValue;
  if (!val?.systolic) return null;
  return {
    date: format(new Date(v.recordedAt), "MMM d"),
    systolic: val.systolic,
    diastolic: val.diastolic,
  };
}

function parseNumericVital(v: Vital): { date: string; value: number; unit: string } | null {
  const val = v.value as unknown as NumericValue;
  if (val?.value === undefined) return null;
  return {
    date: format(new Date(v.recordedAt), "MMM d"),
    value: val.value,
    unit: val.unit ?? "",
  };
}

interface Props {
  vitals: Vital[];
}

export function BpChart({ vitals }: Props) {
  const data = vitals
    .filter((v) => v.type === "bp")
    .map(parseBpVital)
    .filter(Boolean) as { date: string; systolic: number; diastolic: number }[];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
        No blood pressure readings recorded
      </div>
    );
  }

  const maxSystolic = Math.max(...data.map((d) => d.systolic));
  const hasElevated = maxSystolic >= 140;

  return (
    <div>
      {hasElevated && (
        <div className="mb-2 text-xs text-red-600 font-medium flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full inline-block" />
          Systolic ≥140 detected — review immediately
        </div>
      )}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <YAxis
            domain={[60, 160]}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
            formatter={(val, name) =>
              [`${String(val)} mmHg`, String(name) === "systolic" ? "Systolic" : "Diastolic"]
            }
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11 }}
          />
          {/* Reference ranges: Normal <120, Elevated 120-139, Hypertensive ≥140 */}
          <ReferenceArea y1={140} y2={160} fill="#fee2e2" fillOpacity={0.5} />
          <ReferenceArea y1={120} y2={140} fill="#fef9c3" fillOpacity={0.4} />
          <ReferenceLine y={140} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />
          <ReferenceLine y={120} stroke="#eab308" strokeDasharray="4 4" strokeWidth={1} />
          <Line
            type="monotone"
            dataKey="systolic"
            stroke="#f97316"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="diastolic"
            stroke="#94a3b8"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeightChart({ vitals }: Props) {
  const data = vitals
    .filter((v) => v.type === "weight")
    .map(parseNumericVital)
    .filter(Boolean) as { date: string; value: number; unit: string }[];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
        No weight readings recorded
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(val) => [`${String(val)} ${data[0]?.unit ?? "lbs"}`, "Weight"]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name="Weight"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GlucoseChart({ vitals }: Props) {
  const data = vitals
    .filter((v) => v.type === "glucose")
    .map(parseNumericVital)
    .filter(Boolean) as { date: string; value: number; unit: string }[];

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
        No glucose readings recorded
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
        <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(val) => [`${String(val)} mg/dL`, "Fasting Glucose"]}
        />
        {/* Reference ranges: Normal <95, Impaired 95-125, Diabetic ≥126 */}
        <ReferenceArea y1={126} y2={250} fill="#fee2e2" fillOpacity={0.4} />
        <ReferenceArea y1={95} y2={126} fill="#fef9c3" fillOpacity={0.3} />
        <ReferenceLine y={126} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />
        <ReferenceLine y={95} stroke="#eab308" strokeDasharray="4 4" strokeWidth={1} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#eab308"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name="Glucose"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RiskTrendChart({
  history,
}: {
  history: { calculatedAt: Date; score: number; level: string }[];
}) {
  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
        Not enough history for trend
      </div>
    );
  }

  const data = history.map((h) => ({
    date: format(new Date(h.calculatedAt), "MMM d"),
    score: h.score,
    level: h.level,
  }));

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(val) => [`${String(val)}`, "Risk Score"]}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#ef4444"
          strokeWidth={2.5}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
