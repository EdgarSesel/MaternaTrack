import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PatientList } from "@/components/dashboard/patient-list";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { TodayAppointments } from "@/components/appointments/today-appointments";
import { AddPatientDialog } from "@/components/dashboard/add-patient-dialog";
import { RiskLevel, TaskStatus } from "@/generated/prisma/client";
import { getProviderScope, isAdmin } from "@/lib/rbac";
import type { AuthSession } from "@/lib/rbac";
import { startOfDay, endOfDay } from "date-fns";
import { MorningBriefingPanel } from "@/components/dashboard/morning-briefing";
import { computeMorningBriefing } from "@/lib/briefing";
import { AiDailyWorklist } from "@/components/dashboard/ai-worklist";
import { cachedQuery } from "@/lib/cache";
import { IncomingHandoffsBanner } from "@/components/dashboard/incoming-handoffs";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { LinkPatientDialog } from "@/components/dashboard/link-patient-dialog";
import { RisingRiskBanner } from "@/components/dashboard/rising-risk-banner";

export const metadata = {
  title: "Dashboard — MaternaTrack",
};

async function getPatients(providerFilter: { providerId?: string }, providerId?: string) {
  const where = providerFilter.providerId
    ? {
        deletedAt: null,
        OR: [
          { providerId: providerFilter.providerId },
          { patientAccesses: { some: { providerId: providerFilter.providerId } } },
        ],
      }
    : { deletedAt: null };

  const patients = await db.patient.findMany({
    where,
    orderBy: { riskScore: "desc" },
    include: {
      _count: { select: { messages: { where: { deletedAt: null } } } },
      careTasks: {
        where: {
          deletedAt: null,
          status: { in: [TaskStatus.PENDING, TaskStatus.OVERDUE] },
        },
        select: { id: true, status: true, dueDate: true },
        orderBy: { dueDate: "asc" },
      },
      riskScoreHistory: {
        orderBy: { calculatedAt: "desc" },
        take: 6,
        select: { score: true, calculatedAt: true },
      },
      patientAccesses: providerId
        ? { where: { providerId }, select: { role: true } }
        : false,
    },
  });

  return patients;
}

async function getStats(providerFilter: { providerId?: string }) {
  const patientWhere = providerFilter.providerId
    ? {
        deletedAt: null,
        OR: [
          { providerId: providerFilter.providerId },
          { patientAccesses: { some: { providerId: providerFilter.providerId } } },
        ],
      }
    : { deletedAt: null };

  const [total, byRisk, overdueTasks] = await Promise.all([
    db.patient.count({ where: patientWhere }),
    db.patient.groupBy({
      by: ["riskLevel"],
      where: patientWhere,
      _count: true,
    }),
    db.careTask.count({
      where: {
        deletedAt: null,
        patient: patientWhere,
        status: TaskStatus.OVERDUE,
      },
    }),
  ]);

  const riskCounts: Record<string, number> = {};
  for (const r of byRisk) riskCounts[r.riskLevel] = r._count;

  return {
    total,
    highRisk:
      (riskCounts[RiskLevel.HIGH] ?? 0) +
      (riskCounts[RiskLevel.VERY_HIGH] ?? 0),
    moderate: riskCounts[RiskLevel.MODERATE] ?? 0,
    low: riskCounts[RiskLevel.LOW] ?? 0,
    overdueTasks,
  };
}

async function getTodayAppointments(providerFilter: { providerId?: string }) {
  const now = new Date();
  return db.appointment.findMany({
    where: {
      ...providerFilter,
      scheduledAt: { gte: startOfDay(now), lte: endOfDay(now) },
      status: "scheduled",
    },
    include: {
      patient: {
        select: { id: true, firstName: true, lastName: true, riskLevel: true },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });
}

async function getIncomingHandoffs(providerId: string) {
  const rows = await db.handoff.findMany({
    where: { toProviderId: providerId, acceptedAt: null },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
      fromProvider: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((h) => ({
    id: h.id,
    patientId: h.patientId,
    patientName: `${h.patient.firstName} ${h.patient.lastName}`,
    fromProviderName: h.fromProvider.name,
    summary: h.summary,
    openConcerns: h.openConcerns,
    createdAt: h.createdAt,
  }));
}

export default async function DashboardPage() {
  const session = await auth();
  const scope = getProviderScope(session!);
  const providerFilter = scope ? { providerId: scope } : {};
  const admin = isAdmin(session as AuthSession);
  const providerId = session!.user.id;

  const statsCacheKey = scope ? `dashboard-stats-${scope}` : "dashboard-stats-all";

  const [patients, stats, todayAppointments, briefing, providers, incomingHandoffs, providerRecord] =
    await Promise.all([
      getPatients(providerFilter, scope),
      cachedQuery(() => getStats(providerFilter), [statsCacheKey], 60, ["stats"]),
      getTodayAppointments(providerFilter),
      computeMorningBriefing(providerFilter),
      admin
        ? db.provider.findMany({ select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })
        : Promise.resolve([]),
      getIncomingHandoffs(providerId),
      db.provider.findUnique({ where: { id: providerId }, select: { onboardedAt: true } }),
    ]);

  const showOnboarding = !providerRecord?.onboardedAt;

  return (
    <div className="space-y-6">
      {showOnboarding && <OnboardingWizard />}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Patient Panel
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Welcome back, {session!.user.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LinkPatientDialog />
          <AddPatientDialog isAdmin={admin} providers={providers} />
        </div>
      </div>

      <IncomingHandoffsBanner handoffs={incomingHandoffs} />
      <RisingRiskBanner patients={patients} />
      <DashboardStats stats={stats} />
      <MorningBriefingPanel briefing={briefing} />
      <AiDailyWorklist />
      {todayAppointments.length > 0 && (
        <TodayAppointments appointments={todayAppointments} />
      )}
      <PatientList patients={patients} />
    </div>
  );
}
