import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock } from "lucide-react";
import type { RiskLevel } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

const RISK_COLORS: Record<string, string> = {
  LOW: "text-green-700 border-green-300",
  MODERATE: "text-yellow-700 border-yellow-300",
  HIGH: "text-orange-700 border-orange-300",
  VERY_HIGH: "text-red-700 border-red-300",
};

const TYPE_LABELS: Record<string, string> = {
  initial_intake: "Initial Intake",
  routine_prenatal: "Routine Prenatal",
  follow_up: "Follow-up",
  urgent: "Urgent",
  postpartum: "Postpartum",
};

interface TodayAppointment {
  id: string;
  type: string;
  scheduledAt: Date;
  duration: number;
  patient: { id: string; firstName: string; lastName: string; riskLevel: RiskLevel };
}

interface TodayAppointmentsProps {
  appointments: TodayAppointment[];
}

export function TodayAppointments({ appointments }: TodayAppointmentsProps) {
  return (
    <Card className="border-blue-200 dark:border-blue-900/40">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-300">
            Today&apos;s Appointments ({appointments.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {appointments.map((appt) => (
            <Link
              key={appt.id}
              href={`/dashboard/patients/${appt.patient.id}`}
              className="flex items-center gap-3 rounded-lg border border-blue-200 dark:border-blue-900/50 px-3 py-2 hover:border-blue-400 dark:hover:border-blue-700 hover:shadow-sm transition-all"
            >
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {appt.patient.firstName} {appt.patient.lastName}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {format(new Date(appt.scheduledAt), "h:mm a")} · {TYPE_LABELS[appt.type] ?? appt.type}
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn("text-xs shrink-0", RISK_COLORS[appt.patient.riskLevel])}
              >
                {appt.patient.riskLevel.replace("_", " ")}
              </Badge>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
