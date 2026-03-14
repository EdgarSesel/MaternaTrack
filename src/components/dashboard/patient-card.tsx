import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/dashboard/risk-badge";
import { AlertCircle, Calendar, MessageSquare, Clock, Link2 } from "lucide-react";
import type { Patient, CareTask, RiskLevel, TaskStatus } from "@/generated/prisma/client";

type PatientCardData = Pick<
  Patient,
  | "id"
  | "firstName"
  | "lastName"
  | "dateOfBirth"
  | "gestationalAgeWeeks"
  | "dueDate"
  | "status"
  | "riskScore"
  | "riskLevel"
  | "lastContactAt"
  | "lastContactChannel"
  | "insuranceType"
> & {
  _count: { messages: number };
  careTasks: Pick<CareTask, "id" | "status" | "dueDate">[];
  patientAccesses?: { role: string }[];
};

function getEngagementStatus(lastContactAt: Date | null): {
  label: string;
  className: string;
} {
  if (!lastContactAt) return { label: "No contact", className: "bg-slate-100 text-slate-500" };
  const days = Math.floor(
    (Date.now() - new Date(lastContactAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days <= 7) return { label: "Active", className: "bg-green-50 text-green-700" };
  if (days <= 14) return { label: "At risk", className: "bg-yellow-50 text-yellow-700" };
  return { label: "Disengaged", className: "bg-red-50 text-red-700" };
}

const STATUS_LABELS: Record<string, string> = {
  PRECONCEPTION: "Preconception",
  PREGNANT: "Pregnant",
  POSTPARTUM: "Postpartum",
  INACTIVE: "Inactive",
};

export function PatientCard({ patient }: { patient: PatientCardData }) {
  const overdueTasks = patient.careTasks.filter(
    (t) => t.status === ("OVERDUE" as TaskStatus)
  );
  const engagement = getEngagementStatus(patient.lastContactAt);
  const linkedRole = patient.patientAccesses?.[0]?.role;

  return (
    <Link href={`/dashboard/patients/${patient.id}`} className="block group">
      <Card className="transition-shadow hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-rose-500">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-slate-900 text-sm">
                  {patient.firstName} {patient.lastName}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {STATUS_LABELS[patient.status]}
                </Badge>
                {patient.gestationalAgeWeeks && (
                  <span className="text-xs text-slate-500">
                    {patient.gestationalAgeWeeks}w GA
                  </span>
                )}
                {linkedRole && (
                  <span className="text-xs flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium">
                    <Link2 className="w-3 h-3" />
                    {linkedRole.charAt(0).toUpperCase() + linkedRole.slice(1)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <RiskBadge
                  level={patient.riskLevel as RiskLevel}
                  score={patient.riskScore}
                />
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${engagement.className}`}
                >
                  {engagement.label}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 text-xs text-slate-400 flex-shrink-0">
              {patient.lastContactAt && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    {formatDistanceToNow(new Date(patient.lastContactAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              )}
              {patient.dueDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Due {format(new Date(patient.dueDate), "MMM d")}</span>
                </div>
              )}
              {patient._count.messages > 0 && (
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  <span>{patient._count.messages}</span>
                </div>
              )}
            </div>
          </div>

          {overdueTasks.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-medium">
                {overdueTasks.length} overdue task
                {overdueTasks.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
