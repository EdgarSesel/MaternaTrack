import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, PERMISSIONS, getProviderScope } from "@/lib/rbac";
import { subDays, addDays } from "date-fns";
import { RiskLevel, PatientStatus, TaskStatus } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { CohortFilterPanel } from "@/components/cohorts/cohort-filter-panel";
import { CohortResults } from "@/components/cohorts/cohort-results";
import { Suspense } from "react";

export const metadata = { title: "Cohort Builder — MaternaTrack" };

interface SearchParams {
  riskLevel?: string;
  status?: string;
  lastContact?: string;
  hasOverdueTasks?: string;
  missingScreening?: string;
  dueSoon?: string;
  housing?: string;
  food?: string;
  transport?: string;
  ipv?: string;
}

async function getCohortPatients(
  providerFilter: { providerId?: string },
  params: SearchParams,
) {
  const now = new Date();

  // Base provider isolation
  const providerWhere: Prisma.PatientWhereInput = providerFilter.providerId
    ? {
        deletedAt: null,
        OR: [
          { providerId: providerFilter.providerId },
          { patientAccesses: { some: { providerId: providerFilter.providerId } } },
        ],
      }
    : { deletedAt: null };

  // Parse filter params
  const riskLevels = params.riskLevel
    ?.split(",")
    .filter((v): v is RiskLevel => Object.values(RiskLevel).includes(v as RiskLevel)) ?? [];

  const statuses = params.status
    ?.split(",")
    .filter((v): v is PatientStatus => Object.values(PatientStatus).includes(v as PatientStatus)) ?? [];

  const lastContactDays: number | undefined =
    params.lastContact && params.lastContact !== "never"
      ? parseInt(params.lastContact, 10)
      : undefined;

  const hasOverdueTasks = params.hasOverdueTasks === "1";
  const missingScreening = params.missingScreening ?? "";
  const dueSoonDays = params.dueSoon ? parseInt(params.dueSoon, 10) : undefined;
  const hasHousing = params.housing === "1";
  const hasFood = params.food === "1";
  const hasTransport = params.transport === "1";
  const hasIPV = params.ipv === "1";

  // Build filter clauses
  const filterClauses: Prisma.PatientWhereInput[] = [];

  if (riskLevels.length > 0) {
    filterClauses.push({ riskLevel: { in: riskLevels } });
  }

  if (statuses.length > 0) {
    filterClauses.push({ status: { in: statuses } });
  }

  // Last contact filter
  if (params.lastContact === "never") {
    filterClauses.push({ lastContactAt: null });
  } else if (lastContactDays !== undefined) {
    filterClauses.push({
      OR: [
        { lastContactAt: { lt: subDays(now, lastContactDays) } },
        { lastContactAt: null },
      ],
    });
  }

  // Overdue tasks filter
  if (hasOverdueTasks) {
    filterClauses.push({
      careTasks: { some: { status: TaskStatus.OVERDUE, deletedAt: null } },
    });
  }

  // Missing screening filter (last 90 days)
  if (missingScreening && missingScreening !== "any") {
    const ninetyDaysAgo = subDays(now, 90);
    filterClauses.push({
      screenings: {
        none: {
          type: missingScreening,
          administeredAt: { gte: ninetyDaysAgo },
        },
      },
    });
  }

  // Due date filter
  if (dueSoonDays !== undefined) {
    filterClauses.push({
      dueDate: { gte: now, lte: addDays(now, dueSoonDays) },
    });
  }

  // SDOH filters — query JSONB fields
  if (hasHousing) {
    filterClauses.push({ socialDeterminants: { path: ["housingInstability"], equals: true } });
  }
  if (hasFood) {
    filterClauses.push({ socialDeterminants: { path: ["foodInsecurity"], equals: true } });
  }
  if (hasTransport) {
    filterClauses.push({ socialDeterminants: { path: ["transportationBarrier"], equals: true } });
  }
  if (hasIPV) {
    filterClauses.push({ socialDeterminants: { path: ["intimatePartnerViolence"], equals: true } });
  }

  const where: Prisma.PatientWhereInput =
    filterClauses.length > 0
      ? { AND: [providerWhere, ...filterClauses] }
      : providerWhere;

  const patients = await db.patient.findMany({
    where,
    orderBy: { riskScore: "desc" },
    take: 100,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      riskScore: true,
      riskLevel: true,
      status: true,
      gestationalAgeWeeks: true,
      dueDate: true,
      lastContactAt: true,
      careTasks: {
        where: { deletedAt: null, status: TaskStatus.OVERDUE },
        select: { status: true },
      },
    },
  });

  const total = await db.patient.count({ where });

  return { patients, total };
}

export default async function CohortsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  requirePermission(session!, PERMISSIONS.PATIENT_READ);

  const scope = getProviderScope(session!);
  const providerFilter = scope ? { providerId: scope } : {};

  const params = await searchParams;
  const { patients, total } = await getCohortPatients(providerFilter, params);

  // Build export URL with current filters applied
  const exportParams = new URLSearchParams();
  if (params.riskLevel) exportParams.set("riskLevel", params.riskLevel);
  if (params.status) exportParams.set("status", params.status);
  const exportUrl = `/api/export/patients?${exportParams.toString()}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Cohort Builder
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          Filter your patient panel by clinical, engagement, and social factors
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">
        {/* Filter Panel */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 lg:sticky lg:top-4">
          <Suspense>
            <CohortFilterPanel />
          </Suspense>
        </div>

        {/* Results */}
        <CohortResults patients={patients} total={total} exportUrl={exportUrl} />
      </div>
    </div>
  );
}
