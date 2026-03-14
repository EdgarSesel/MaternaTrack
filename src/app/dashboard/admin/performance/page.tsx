import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import type { AuthSession } from "@/lib/rbac";
import { format, subDays } from "date-fns";
import { BarChart2, Users, CheckSquare, MessageSquare, Calendar, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProviderPerformanceCharts } from "@/components/admin/provider-performance-charts";

export const metadata = { title: "Provider Performance — MaternaTrack" };

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

async function computeProviderMetrics(): Promise<ProviderMetrics[]> {
  const thirtyDaysAgo = subDays(new Date(), 30);

  const providers = await db.provider.findMany({
    where: { role: { not: "ADMIN" } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      role: true,
      lastLoginAt: true,
      patients: {
        where: { deletedAt: null },
        select: {
          id: true,
          status: true,
          riskScore: true,
          riskLevel: true,
          careTasks: {
            where: { deletedAt: null },
            select: { status: true, completedAt: true },
          },
          messages: {
            where: { senderType: "PROVIDER", deletedAt: null },
            select: { createdAt: true },
          },
          appointments: {
            select: { status: true, scheduledAt: true },
          },
          carePlans: {
            where: { status: "active", deletedAt: null },
            select: { id: true },
          },
        },
      },
    },
  });

  return providers.map((p) => {
    const activePatients = p.patients.filter(
      (pt) => pt.status === "PREGNANT" || pt.status === "POSTPARTUM"
    );
    const highRisk = p.patients.filter((pt) => pt.riskLevel === "HIGH").length;
    const veryHighRisk = p.patients.filter((pt) => pt.riskLevel === "VERY_HIGH").length;
    const avgRisk =
      p.patients.length > 0
        ? Math.round(p.patients.reduce((sum, pt) => sum + pt.riskScore, 0) / p.patients.length)
        : 0;

    const allTasks = p.patients.flatMap((pt) => pt.careTasks);
    const completedTasks = allTasks.filter((t) => t.status === "COMPLETED").length;
    const nonNaTasks = allTasks.filter((t) => t.status !== "NOT_APPLICABLE").length;
    const taskRate = nonNaTasks > 0 ? Math.round((completedTasks / nonNaTasks) * 100) : 0;

    const allMessages = p.patients.flatMap((pt) => pt.messages);
    const recentMessages = allMessages.filter(
      (m) => new Date(m.createdAt) >= thirtyDaysAgo
    ).length;

    const allAppointments = p.patients.flatMap((pt) => pt.appointments);
    const completedAppts = allAppointments.filter((a) => a.status === "completed").length;
    const noShows = allAppointments.filter((a) => a.status === "no_show").length;
    const scheduledOrDone = completedAppts + noShows;
    const adherenceRate =
      scheduledOrDone > 0 ? Math.round((completedAppts / scheduledOrDone) * 100) : 0;

    const activePlans = p.patients.flatMap((pt) => pt.carePlans).length;

    return {
      id: p.id,
      name: p.name,
      role: p.role,
      panelSize: p.patients.length,
      activePatients: activePatients.length,
      highRiskCount: highRisk,
      veryHighRiskCount: veryHighRisk,
      avgRiskScore: avgRisk,
      taskCompletionRate: taskRate,
      tasksCompleted: completedTasks,
      tasksTotal: nonNaTasks,
      messagesSent: allMessages.length,
      messagesLast30: recentMessages,
      appointmentsScheduled: allAppointments.filter((a) => a.status === "scheduled").length,
      appointmentsCompleted: completedAppts,
      appointmentNoShows: noShows,
      appointmentAdherenceRate: adherenceRate,
      activePlansCount: activePlans,
      lastLoginAt: p.lastLoginAt,
    };
  });
}

const ROLE_LABELS: Record<string, string> = {
  NURSE: "Nurse",
  MIDWIFE: "Midwife",
  OBGYN: "OB-GYN",
  DIETITIAN: "Dietitian",
  THERAPIST: "Therapist",
};

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  color = "text-slate-700",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-lg border p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-slate-500">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className={`text-xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function RateBar({ rate, label }: { rate: number; label: string }) {
  const color =
    rate >= 80 ? "bg-green-500" : rate >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-medium text-slate-700">{rate}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

export default async function ProviderPerformancePage() {
  const session = await auth();
  requirePermission(session as AuthSession, PERMISSIONS.ADMIN_VIEW_AUDIT_LOG);

  const metrics = await computeProviderMetrics();

  const totalPatients = metrics.reduce((s, m) => s + m.panelSize, 0);
  const totalHighRisk = metrics.reduce((s, m) => s + m.highRiskCount + m.veryHighRiskCount, 0);
  const avgTaskRate = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.taskCompletionRate, 0) / metrics.length)
    : 0;
  const avgAdherence = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.appointmentAdherenceRate, 0) / metrics.length)
    : 0;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart2 className="w-6 h-6 text-rose-500" />
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Provider Performance</h1>
          <p className="text-sm text-slate-500">
            Panel metrics as of {format(new Date(), "MMMM d, yyyy")} · {metrics.length} providers
          </p>
        </div>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-slate-900">{metrics.length}</p>
            <p className="text-sm text-slate-500">Active Providers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-slate-900">{totalPatients}</p>
            <p className="text-sm text-slate-500">Total Patients</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className={`text-2xl font-bold ${totalHighRisk > 0 ? "text-orange-600" : "text-green-600"}`}>
              {totalHighRisk}
            </p>
            <p className="text-sm text-slate-500">High/Very High Risk</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-slate-900">{avgTaskRate}%</p>
            <p className="text-sm text-slate-500">Avg Task Completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <ProviderPerformanceCharts metrics={metrics} />

      {/* Per-provider cards */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
          Individual Provider Breakdown
        </h2>
        {metrics.map((m) => (
          <Card key={m.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-semibold text-sm flex items-center justify-center">
                    {m.name.charAt(0)}
                  </div>
                  <div>
                    <CardTitle className="text-base">{m.name}</CardTitle>
                    <p className="text-xs text-slate-500">{ROLE_LABELS[m.role] ?? m.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {m.veryHighRiskCount > 0 && (
                    <Badge variant="destructive" className="text-xs gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {m.veryHighRiskCount} Very High Risk
                    </Badge>
                  )}
                  <span className="text-xs text-slate-400">
                    {m.lastLoginAt
                      ? `Last login ${format(new Date(m.lastLoginAt), "MMM d")}`
                      : "Never logged in"}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <MetricCard
                  label="Panel Size"
                  value={m.panelSize}
                  sub={`${m.activePatients} active`}
                  icon={Users}
                />
                <MetricCard
                  label="High Risk"
                  value={m.highRiskCount + m.veryHighRiskCount}
                  sub={`${m.highRiskCount} high · ${m.veryHighRiskCount} very high`}
                  icon={AlertTriangle}
                  color={m.veryHighRiskCount > 0 ? "text-red-600" : m.highRiskCount > 0 ? "text-orange-600" : "text-slate-700"}
                />
                <MetricCard
                  label="Avg Risk Score"
                  value={m.avgRiskScore}
                  icon={TrendingUp}
                  color={m.avgRiskScore >= 51 ? "text-orange-600" : m.avgRiskScore >= 26 ? "text-yellow-600" : "text-green-600"}
                />
                <MetricCard
                  label="Messages (30d)"
                  value={m.messagesLast30}
                  sub={`${m.messagesSent} all time`}
                  icon={MessageSquare}
                />
              </div>
              <div className="space-y-2">
                <RateBar rate={m.taskCompletionRate} label={`Task Completion (${m.tasksCompleted}/${m.tasksTotal})`} />
                <RateBar rate={m.appointmentAdherenceRate} label={`Appt Adherence (${m.appointmentsCompleted} completed, ${m.appointmentNoShows} no-shows)`} />
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 border-t">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {m.appointmentsScheduled} upcoming · {m.appointmentsCompleted} completed
                </span>
                <span className="flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5" />
                  {m.activePlansCount} active care plan{m.activePlansCount !== 1 ? "s" : ""}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
