"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isToday, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, AlertTriangle } from "lucide-react";
import { updateAppointmentStatus } from "@/app/actions/appointment-actions";
import type { RiskLevel } from "@/generated/prisma/client";
import { useState } from "react";

const RISK_COLORS: Record<string, string> = {
  LOW: "bg-green-100 text-green-800 border-green-200",
  MODERATE: "bg-yellow-100 text-yellow-800 border-yellow-200",
  HIGH: "bg-orange-100 text-orange-800 border-orange-200",
  VERY_HIGH: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_STYLES: Record<string, string> = {
  scheduled: "border-l-blue-400 bg-blue-50",
  completed: "border-l-green-400 bg-green-50 opacity-75",
  cancelled: "border-l-slate-300 bg-slate-50 opacity-60",
  no_show: "border-l-red-400 bg-red-50 opacity-75",
};

const TYPE_LABELS: Record<string, string> = {
  initial_intake: "Initial Intake",
  routine_prenatal: "Routine Prenatal",
  follow_up: "Follow-up",
  urgent: "Urgent",
  postpartum: "Postpartum",
};

interface Appointment {
  id: string;
  type: string;
  scheduledAt: Date;
  duration: number;
  status: string;
  notes: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    riskLevel: RiskLevel;
    gestationalAgeWeeks?: number | null;
    status?: string;
  };
  provider: { name: string };
}

interface DayGroup {
  date: Date;
  label: string;
  appointments: Appointment[];
}

interface UpcomingAppointment {
  id: string;
  scheduledAt: Date;
  type: string;
  status: string;
  noShowCount: number;
  patient: { id: string; firstName: string; lastName: string; riskLevel: RiskLevel };
}

interface AppointmentsCalendarProps {
  byDay: DayGroup[];
  weekOffset: number;
  upcoming: UpcomingAppointment[];
}

function AppointmentCard({ appt }: { appt: Appointment }) {
  const [updating, setUpdating] = useState(false);

  async function handleStatus(status: "completed" | "cancelled" | "no_show") {
    setUpdating(true);
    await updateAppointmentStatus({ appointmentId: appt.id, patientId: appt.patient.id, status });
    setUpdating(false);
  }

  const isPastAndScheduled = isPast(new Date(appt.scheduledAt)) && appt.status === "scheduled";

  return (
    <div
      className={cn(
        "rounded-lg border-l-4 px-3 py-2 text-xs border border-slate-200 space-y-1",
        STATUS_STYLES[appt.status] ?? "border-l-slate-300 bg-white"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <Link
          href={`/dashboard/patients/${appt.patient.id}`}
          className="font-medium text-slate-900 hover:text-blue-600 leading-tight"
        >
          {appt.patient.firstName} {appt.patient.lastName}
        </Link>
        <Badge
          variant="outline"
          className={cn("text-[10px] px-1 py-0 h-4 shrink-0", RISK_COLORS[appt.patient.riskLevel])}
        >
          {appt.patient.riskLevel.replace("_", " ")}
        </Badge>
      </div>
      <p className="text-slate-600">{TYPE_LABELS[appt.type] ?? appt.type}</p>
      <p className="text-slate-500">
        {format(new Date(appt.scheduledAt), "h:mm a")} · {appt.duration}min
      </p>

      {appt.status === "scheduled" && isPastAndScheduled && (
        <div className="flex gap-1 pt-1">
          <button
            onClick={() => handleStatus("completed")}
            disabled={updating}
            className="flex-1 text-[10px] py-0.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
          >
            Done
          </button>
          <button
            onClick={() => handleStatus("no_show")}
            disabled={updating}
            className="flex-1 text-[10px] py-0.5 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
          >
            No-show
          </button>
          <button
            onClick={() => handleStatus("cancelled")}
            disabled={updating}
            className="flex-1 text-[10px] py-0.5 rounded bg-slate-400 text-white hover:bg-slate-500 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function AppointmentsCalendar({
  byDay,
  weekOffset,
  upcoming,
}: AppointmentsCalendarProps) {
  const router = useRouter();

  function navigate(offset: number) {
    router.push(`/dashboard/appointments?week=${weekOffset + offset}`);
  }

  const totalThisWeek = byDay.reduce((s, d) => s + d.appointments.length, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      {/* Calendar grid */}
      <div className="space-y-4">
        {/* Week navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Prev week
          </Button>
          <span className="text-sm text-slate-600 font-medium">
            {totalThisWeek} appointment{totalThisWeek !== 1 ? "s" : ""} this week
          </span>
          <Button variant="outline" size="sm" onClick={() => navigate(1)}>
            Next week
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        {/* 7-column day grid */}
        <div className="grid grid-cols-7 gap-2">
          {byDay.map(({ date, label, appointments }) => {
            const today = isToday(date);
            return (
              <div key={date.toISOString()} className="min-h-[120px]">
                {/* Day header */}
                <div
                  className={cn(
                    "text-center mb-2 pb-1 border-b",
                    today
                      ? "border-blue-400"
                      : "border-slate-200"
                  )}
                >
                  <p className={cn("text-xs font-medium", today ? "text-blue-600" : "text-slate-500")}>
                    {label}
                  </p>
                  <p
                    className={cn(
                      "text-base font-semibold leading-tight",
                      today
                        ? "text-blue-600"
                        : "text-slate-900"
                    )}
                  >
                    {format(date, "d")}
                  </p>
                </div>

                {/* Appointments */}
                <div className="space-y-1.5">
                  {appointments.length === 0 ? (
                    <p className="text-[10px] text-center text-slate-300 mt-4">—</p>
                  ) : (
                    appointments.map((appt) => (
                      <AppointmentCard key={appt.id} appt={appt} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar: upcoming */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Upcoming</h2>
          <p className="text-xs text-slate-400">Next 10 scheduled</p>
        </div>

        {upcoming.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No upcoming appointments</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((appt) => (
              <Link
                key={appt.id}
                href={`/dashboard/patients/${appt.patient.id}`}
                className="block bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {appt.patient.firstName} {appt.patient.lastName}
                  </p>
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0 h-4 shrink-0", RISK_COLORS[appt.patient.riskLevel])}
                  >
                    {appt.patient.riskLevel.replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {TYPE_LABELS[appt.type] ?? appt.type}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {format(new Date(appt.scheduledAt), "MMM d · h:mm a")}
                </p>
                {appt.noShowCount >= 2 && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      {appt.noShowCount} missed appointment{appt.noShowCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
