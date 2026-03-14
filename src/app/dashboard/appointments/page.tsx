import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requirePermission, PERMISSIONS, getProviderScope } from "@/lib/rbac";
import {
  startOfWeek,
  addWeeks,
  subWeeks,
  format,
  isSameDay,
  startOfDay,
  endOfDay,
} from "date-fns";
import { AppointmentsCalendar } from "@/components/appointments/appointments-calendar";

export const metadata = { title: "Appointments — MaternaTrack" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekDays(weekOffset: number) {
  const base = weekOffset >= 0
    ? addWeeks(new Date(), weekOffset)
    : subWeeks(new Date(), Math.abs(weekOffset));
  const start = startOfWeek(base, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const session = await auth();
  requirePermission(session!, PERMISSIONS.APPOINTMENT_VIEW);

  const sp = await searchParams;
  const weekOffset = parseInt(sp.week ?? "0", 10);
  const days = getWeekDays(weekOffset);
  const weekStart = startOfDay(days[0]);
  const weekEnd = endOfDay(days[6]);

  const scope = getProviderScope(session!);
  const providerFilter = scope ? { providerId: scope } : {};

  const appointments = await db.appointment.findMany({
    where: {
      ...providerFilter,
      scheduledAt: { gte: weekStart, lte: weekEnd },
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          riskLevel: true,
          gestationalAgeWeeks: true,
          status: true,
        },
      },
      provider: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  // Group by day
  const byDay = days.map((day) => ({
    date: day,
    label: DAYS[day.getDay()],
    appointments: appointments.filter((a) =>
      isSameDay(new Date(a.scheduledAt), day)
    ),
  }));

  // Upcoming appointments (next 14 days, for the sidebar)
  const [upcoming, noShowGroups] = await Promise.all([
    db.appointment.findMany({
      where: {
        ...providerFilter,
        scheduledAt: { gte: new Date() },
        status: "scheduled",
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, riskLevel: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }),
    db.appointment.groupBy({
      by: ["patientId"],
      where: { ...providerFilter, status: "no_show" },
      _count: true,
    }),
  ]);

  // Build a lookup: patientId → no-show count
  const noShowMap = new Map(noShowGroups.map((g) => [g.patientId, g._count]));

  // Enrich upcoming with noShowCount
  const upcomingWithHistory = upcoming.map((appt) => ({
    ...appt,
    noShowCount: noShowMap.get(appt.patient.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Appointments</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          Week of {format(weekStart, "MMMM d")} – {format(weekEnd, "MMMM d, yyyy")}
        </p>
      </div>

      <AppointmentsCalendar
        byDay={byDay}
        weekOffset={weekOffset}
        upcoming={upcomingWithHistory}
      />
    </div>
  );
}
