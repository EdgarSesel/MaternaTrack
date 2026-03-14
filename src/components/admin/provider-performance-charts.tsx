"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProviderMetrics {
  id: string;
  name: string;
  role: string;
  panelSize: number;
  activePatients: number;
  highRiskCount: number;
  veryHighRiskCount: number;
  avgRiskScore: number;
  taskCompletionRate: number;
  tasksCompleted: number;
  tasksTotal: number;
  messagesSent: number;
  messagesLast30: number;
  appointmentsScheduled: number;
  appointmentsCompleted: number;
  appointmentNoShows: number;
  appointmentAdherenceRate: number;
  activePlansCount: number;
  lastLoginAt: Date | null;
}

interface Props {
  metrics: ProviderMetrics[];
}

function shortName(name: string) {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1].charAt(0)}.` : name;
}

function taskRateColor(rate: number) {
  if (rate >= 80) return "#22c55e";
  if (rate >= 60) return "#eab308";
  return "#ef4444";
}

function riskColor(score: number) {
  if (score >= 76) return "#ef4444";
  if (score >= 51) return "#f97316";
  if (score >= 26) return "#eab308";
  return "#22c55e";
}

export function ProviderPerformanceCharts({ metrics }: Props) {
  const panelData = metrics.map((m) => ({
    name: shortName(m.name),
    Active: m.activePatients,
    HighRisk: m.highRiskCount + m.veryHighRiskCount,
  }));

  const taskData = metrics.map((m) => ({
    name: shortName(m.name),
    rate: m.taskCompletionRate,
  }));

  const riskData = metrics.map((m) => ({
    name: shortName(m.name),
    score: m.avgRiskScore,
  }));

  const msgData = metrics.map((m) => ({
    name: shortName(m.name),
    messages: m.messagesLast30,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Panel composition */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Panel Composition</CardTitle>
          <p className="text-xs text-slate-400">Active patients vs high-risk patients</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={panelData} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Active" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="HighRisk" fill="#f97316" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Task completion rates */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Task Completion Rate</CardTitle>
          <p className="text-xs text-slate-400">% of non-N/A tasks completed</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={taskData} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => [`${v}%`, "Completion"]} />
              <Bar dataKey="rate" radius={[3, 3, 0, 0]}>
                {taskData.map((d, i) => (
                  <Cell key={i} fill={taskRateColor(d.rate)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Average risk score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Average Panel Risk Score</CardTitle>
          <p className="text-xs text-slate-400">Mean risk score across all patients</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={riskData} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip formatter={(v) => [v, "Avg Risk Score"]} />
              <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                {riskData.map((d, i) => (
                  <Cell key={i} fill={riskColor(d.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Messages last 30 days */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700">Messages Sent (30 days)</CardTitle>
          <p className="text-xs text-slate-400">Provider-initiated messages to patients</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={msgData} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [v, "Messages"]} />
              <Bar dataKey="messages" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
