import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { RiskLevel, TaskStatus } from "@/generated/prisma/client";
import { subDays, startOfWeek, format, subMonths, startOfMonth } from "date-fns";
import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { AiPanelSummary } from "@/components/ai/ai-panel-summary";
import { OutcomesCharts } from "@/components/analytics/outcomes-charts";
import { AppointmentAdherenceCharts } from "@/components/analytics/appointment-adherence-charts";
import { getProviderScope, requirePermission, PERMISSIONS } from "@/lib/rbac";
import { cachedQuery } from "@/lib/cache";

export const metadata = { title: "Analytics — MaternaTrack" };

interface SearchParams {
  range?: string;
}

async function getAnalyticsData(
  providerFilter: { providerId?: string },
  rangeDays: number,
) {
  const now = new Date();
  const sevenDaysAgo = subDays(now, 7);
  const fourteenDaysAgo = subDays(now, 14);
  const ninetyDaysAgo = subDays(now, 90);
  const rangeStart = subDays(now, rangeDays);
  const patientWhere = { ...providerFilter, deletedAt: null };

  const [
    totalPatients,
    byRiskLevel,
    byStatus,
    byTaskStatus,
    contactedThisWeek,
    notContactedIn14Days,
    activeProtocols,
    topRiskPatients,
    allTasks,
    missingDepressionScreen,
    riskScoreHistory,
    patientsByRiskLevel,
  ] = await Promise.all([
    db.patient.count({ where: patientWhere }),

    db.patient.groupBy({ by: ["riskLevel"], where: patientWhere, _count: true }),

    db.patient.groupBy({ by: ["status"], where: patientWhere, _count: true }),

    db.careTask.groupBy({
      by: ["status"],
      where: { deletedAt: null, patient: patientWhere },
      _count: true,
    }),

    db.patient.count({
      where: { ...patientWhere, lastContactAt: { gte: sevenDaysAgo } },
    }),

    db.patient.count({
      where: {
        ...patientWhere,
        OR: [{ lastContactAt: { lt: fourteenDaysAgo } }, { lastContactAt: null }],
      },
    }),

    db.carePlan.groupBy({
      by: ["protocolType"],
      where: { deletedAt: null, patient: patientWhere, status: "active" },
      _count: true,
    }),

    db.patient.findMany({
      where: {
        ...patientWhere,
        riskLevel: { in: [RiskLevel.HIGH, RiskLevel.VERY_HIGH] },
      },
      orderBy: { riskScore: "desc" },
      take: 8,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        riskScore: true,
        riskLevel: true,
        lastContactAt: true,
        careTasks: {
          where: { deletedAt: null, status: TaskStatus.OVERDUE },
          select: { id: true, title: true, dueDate: true },
          orderBy: { dueDate: "asc" },
          take: 2,
        },
      },
    }),

    db.careTask.findMany({
      where: { deletedAt: null, patient: patientWhere },
      select: { status: true },
    }),

    db.patient.count({
      where: {
        ...patientWhere,
        screenings: {
          none: {
            type: { in: ["phq9", "epds"] },
            administeredAt: { gte: ninetyDaysAgo },
          },
        },
      },
    }),

    // Time-series: risk score history for trend chart
    db.riskScoreHistory.findMany({
      where: {
        calculatedAt: { gte: rangeStart },
        patient: patientWhere,
      },
      select: { score: true, level: true, calculatedAt: true },
      orderBy: { calculatedAt: "asc" },
    }),

    // Drill-down: patients grouped by risk level (minimal fields)
    db.patient.findMany({
      where: patientWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        riskScore: true,
        riskLevel: true,
        status: true,
        gestationalAgeWeeks: true,
      },
      orderBy: { riskScore: "desc" },
    }),
  ]);

  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t) => t.status === "COMPLETED").length;
  const overdueTasks = allTasks.filter((t) => t.status === "OVERDUE").length;
  const taskCompletionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const riskMap: Record<string, number> = {};
  for (const r of byRiskLevel) riskMap[r.riskLevel] = r._count;

  const statusMap: Record<string, number> = {};
  for (const s of byStatus) statusMap[s.status] = s._count;

  const taskStatusMap: Record<string, number> = {};
  for (const t of byTaskStatus) taskStatusMap[t.status] = t._count;

  // Aggregate risk score history by week for trend chart
  const weekMap = new Map<string, { scores: number[]; high: number; total: number }>();
  for (const entry of riskScoreHistory) {
    const weekKey = format(startOfWeek(new Date(entry.calculatedAt), { weekStartsOn: 1 }), "MMM d");
    const existing = weekMap.get(weekKey) ?? { scores: [], high: 0, total: 0 };
    existing.scores.push(entry.score);
    existing.total++;
    if (entry.level === RiskLevel.HIGH || entry.level === RiskLevel.VERY_HIGH) {
      existing.high++;
    }
    weekMap.set(weekKey, existing);
  }
  const riskTrend = Array.from(weekMap.entries()).map(([week, data]) => ({
    week,
    avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
    highRiskCount: data.high,
  }));

  // Group drill-down patients by risk level
  const drilldownByRisk: Record<string, typeof patientsByRiskLevel> = {
    LOW: [],
    MODERATE: [],
    HIGH: [],
    VERY_HIGH: [],
  };
  for (const p of patientsByRiskLevel) {
    drilldownByRisk[p.riskLevel]?.push(p);
  }

  return {
    totalPatients,
    riskDistribution: {
      LOW: riskMap[RiskLevel.LOW] ?? 0,
      MODERATE: riskMap[RiskLevel.MODERATE] ?? 0,
      HIGH: riskMap[RiskLevel.HIGH] ?? 0,
      VERY_HIGH: riskMap[RiskLevel.VERY_HIGH] ?? 0,
    },
    patientStatus: statusMap,
    taskStatusDistribution: taskStatusMap,
    taskCompletionRate,
    totalTasks,
    overdueTasks,
    contactedThisWeek,
    notContactedIn14Days,
    activeProtocols: activeProtocols.map((p) => ({
      type: p.protocolType,
      count: p._count,
    })),
    topRiskPatients,
    missingDepressionScreen,
    riskTrend,
    drilldownByRisk,
    rangeDays,
  };
}

export type AnalyticsData = Awaited<ReturnType<typeof getAnalyticsData>>;

const BENCHMARKS = {
  cSectionRate: 31.8,
  pretermRate: 10.4,
  lowBirthWeightRate: 8.3,
  nicuRate: 10.0,
};

async function getOutcomesData(providerFilter: { providerId?: string }) {
  const patientWhere = providerFilter.providerId
    ? {
        OR: [
          { providerId: providerFilter.providerId },
          { patientAccesses: { some: { providerId: providerFilter.providerId } } },
        ],
        deletedAt: null,
      }
    : { deletedAt: null };

  const sixMonthsAgo = subMonths(new Date(), 6);

  const babies = await db.baby.findMany({
    where: { patient: patientWhere },
    select: {
      deliveryType: true,
      gestationalAgeAtBirth: true,
      birthWeightGrams: true,
      nicuAdmission: true,
      dateOfBirth: true,
      patient: {
        select: {
          status: true,
          screenings: {
            where: {
              type: { in: ["phq9", "epds"] },
              administeredAt: { gte: subDays(new Date(), 42) }, // 6 weeks
            },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  if (babies.length === 0) return null;

  const total = babies.length;
  const cSections = babies.filter((b) => b.deliveryType === "cesarean").length;
  const vbacs = babies.filter((b) => b.deliveryType === "vbac").length;
  const vaginal = babies.filter((b) => b.deliveryType === "vaginal").length;
  const preterm = babies.filter((b) => b.gestationalAgeAtBirth !== null && b.gestationalAgeAtBirth < 37).length;
  const lowBirthWeight = babies.filter((b) => b.birthWeightGrams !== null && b.birthWeightGrams < 2500).length;
  const nicu = babies.filter((b) => b.nicuAdmission).length;

  // Postpartum patients with recent PHQ-9/EPDS
  const postpartumBabies = babies.filter((b) => b.patient.status === "POSTPARTUM");
  const screenedPostpartum = postpartumBabies.filter((b) => b.patient.screenings.length > 0).length;

  // Monthly trend (last 6 months)
  const monthlyMap = new Map<string, { total: number; cSection: number; nicu: number }>();
  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(new Date(), i));
    const key = format(monthStart, "MMM");
    monthlyMap.set(key, { total: 0, cSection: 0, nicu: 0 });
  }
  for (const b of babies) {
    if (!b.dateOfBirth || b.dateOfBirth < sixMonthsAgo) continue;
    const key = format(startOfMonth(b.dateOfBirth), "MMM");
    const entry = monthlyMap.get(key);
    if (entry) {
      entry.total++;
      if (b.deliveryType === "cesarean") entry.cSection++;
      if (b.nicuAdmission) entry.nicu++;
    }
  }

  return {
    total,
    deliveryTypes: { vaginal, cSection: cSections, vbac: vbacs },
    rates: {
      cSection: total > 0 ? Math.round((cSections / total) * 1000) / 10 : 0,
      preterm: total > 0 ? Math.round((preterm / total) * 1000) / 10 : 0,
      lowBirthWeight: total > 0 ? Math.round((lowBirthWeight / total) * 1000) / 10 : 0,
      nicu: total > 0 ? Math.round((nicu / total) * 1000) / 10 : 0,
    },
    benchmarks: BENCHMARKS,
    postpartumScreeningRate:
      postpartumBabies.length > 0
        ? Math.round((screenedPostpartum / postpartumBabies.length) * 100)
        : null,
    postpartumTotal: postpartumBabies.length,
    monthlyTrend: Array.from(monthlyMap.entries()).map(([month, d]) => ({
      month,
      cSectionRate: d.total > 0 ? Math.round((d.cSection / d.total) * 1000) / 10 : 0,
      nicuRate: d.total > 0 ? Math.round((d.nicu / d.total) * 1000) / 10 : 0,
      total: d.total,
    })),
  };
}

export type OutcomesData = NonNullable<Awaited<ReturnType<typeof getOutcomesData>>>;

async function getAdherenceData(providerFilter: { providerId?: string }) {
  const apptWhere = providerFilter.providerId
    ? { providerId: providerFilter.providerId }
    : {};

  const [allAppts, byType, topNoShow] = await Promise.all([
    db.appointment.findMany({
      where: { ...apptWhere, status: { in: ["completed", "no_show", "cancelled"] } },
      select: { status: true },
    }),

    db.appointment.groupBy({
      by: ["type", "status"],
      where: { ...apptWhere, status: { in: ["completed", "no_show"] } },
      _count: true,
    }),

    db.appointment.groupBy({
      by: ["patientId"],
      where: { ...apptWhere, status: "no_show" },
      _count: true,
      orderBy: { _count: { patientId: "desc" } },
      take: 5,
    }),
  ]);

  const completed = allAppts.filter((a) => a.status === "completed").length;
  const noShows = allAppts.filter((a) => a.status === "no_show").length;
  const total = allAppts.length;
  const adherenceRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // No-show by appointment type
  const typeMap = new Map<string, { noShow: number; completed: number }>();
  for (const row of byType) {
    const entry = typeMap.get(row.type) ?? { noShow: 0, completed: 0 };
    if (row.status === "no_show") entry.noShow += row._count;
    else entry.completed += row._count;
    typeMap.set(row.type, entry);
  }
  const noShowByType = Array.from(typeMap.entries())
    .map(([type, d]) => ({
      type: type.replace(/_/g, " "),
      noShows: d.noShow,
      total: d.noShow + d.completed,
      rate: d.noShow + d.completed > 0 ? Math.round((d.noShow / (d.noShow + d.completed)) * 100) : 0,
    }))
    .filter((d) => d.noShows > 0)
    .sort((a, b) => b.noShows - a.noShows);

  // Enrich top no-show patients with names
  const patientIds = topNoShow.map((t) => t.patientId);
  const patients = await db.patient.findMany({
    where: { id: { in: patientIds }, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  const patientMap = new Map(patients.map((p) => [p.id, p]));

  const highNoShowPatients = topNoShow
    .filter((t) => t._count > 0)
    .map((t) => ({
      patientId: t.patientId,
      name: patientMap.has(t.patientId)
        ? `${patientMap.get(t.patientId)!.firstName} ${patientMap.get(t.patientId)!.lastName}`
        : "Unknown",
      count: t._count,
    }))
    .filter((t) => t.name !== "Unknown");

  return { adherenceRate, totalScheduled: total, noShows, noShowByType, highNoShowPatients };
}

export type AdherenceData = Awaited<ReturnType<typeof getAdherenceData>>;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  requirePermission(session!, PERMISSIONS.ANALYTICS_VIEW);
  const scope = getProviderScope(session!);
  const providerFilter = scope ? { providerId: scope } : {};

  const params = await searchParams;
  const rangeDays = params.range === "60" ? 60 : params.range === "90" ? 90 : 30;

  const cacheKey = scope ? `analytics-${scope}-${rangeDays}` : `analytics-all-${rangeDays}`;
  const [data, outcomesData, adherenceData] = await Promise.all([
    cachedQuery(
      () => getAnalyticsData(providerFilter, rangeDays),
      [cacheKey],
      300,
      ["analytics"],
    ),
    getOutcomesData(providerFilter),
    getAdherenceData(providerFilter),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Analytics</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Panel-level metrics and trends for your {data.totalPatients} patients
          </p>
        </div>
        <a
          href="/api/export/patients"
          download
          className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg px-3 py-2 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </a>
      </div>

      <AiPanelSummary data={data} />
      <AnalyticsCharts data={data} />
      {outcomesData && <OutcomesCharts data={outcomesData} />}
      <AppointmentAdherenceCharts data={adherenceData} />
    </div>
  );
}
