import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/dashboard/risk-badge";
import { PatientTabs } from "@/components/patient/patient-tabs";
import { ChevronLeft, Calendar, Phone } from "lucide-react";
import { ScheduleAppointmentDialog } from "@/components/appointments/schedule-appointment-dialog";
import { EditPatientDialog } from "@/components/patient/edit-patient-dialog";
import { RecordVitalDialog } from "@/components/patient/record-vital-dialog";
import { HandoffDialog } from "@/components/patient/handoff-dialog";
import { ExportButton } from "@/components/patient/export-button";
import { format, differenceInYears } from "date-fns";
import type { RiskLevel } from "@/generated/prisma/client";
import { isAdmin } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

interface Props {
  params: Promise<{ id: string }>;
}

async function detectAndMarkOverdueTasks(patientId: string) {
  await db.careTask.updateMany({
    where: { patientId, status: "PENDING", dueDate: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });
}

async function getPatient(id: string, providerId?: string) {
  const where = providerId
    ? {
        id,
        deletedAt: null,
        OR: [
          { providerId },
          { patientAccesses: { some: { providerId } } },
        ],
      }
    : { id, deletedAt: null };
  return db.patient.findFirst({
    where,
    include: {
      vitals: { orderBy: { recordedAt: "asc" } },
      screenings: { orderBy: { administeredAt: "desc" } },
      carePlans: {
        where: { deletedAt: null, status: "active" },
        include: {
          tasks: { where: { deletedAt: null }, orderBy: { dueDate: "asc" } },
        },
      },
      careTasks: {
        where: { deletedAt: null },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      },
      messages: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      timelineEvents: { orderBy: { createdAt: "desc" } },
      riskScoreHistory: {
        orderBy: { calculatedAt: "asc" },
        take: 12,
      },
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 10,
      },
      visitNotes: {
        orderBy: { createdAt: "desc" },
        include: { provider: { select: { name: true, role: true } } },
      },
      babies: {
        include: {
          neonatalVitals: { orderBy: { recordedAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

const STATUS_LABELS: Record<string, string> = {
  PRECONCEPTION: "Preconception",
  PREGNANT: "Pregnant",
  POSTPARTUM: "Postpartum",
  INACTIVE: "Inactive",
};

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  const pid = session?.user?.id ?? "";
  const metaWhere = session && isAdmin(session)
    ? { id, deletedAt: null }
    : { id, deletedAt: null, OR: [{ providerId: pid }, { patientAccesses: { some: { providerId: pid } } }] };
  const patient = await db.patient.findFirst({
    where: metaWhere,
    select: { firstName: true, lastName: true },
  });
  if (!patient) return { title: "Patient Not Found" };
  return { title: `${patient.firstName} ${patient.lastName} — MaternaTrack` };
}

export default async function PatientDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  // Auto-mark any PENDING tasks past their due date as OVERDUE
  await detectAndMarkOverdueTasks(id);

  const scope = isAdmin(session!) ? undefined : session!.user.id;
  const [patient, allProviders] = await Promise.all([
    getPatient(id, scope),
    db.provider.findMany({ select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
  ]);

  if (!patient) notFound();

  logAudit({ actorId: session!.user.id, action: "patient.view", resource: "Patient", resourceId: id });

  const age = differenceInYears(new Date(), new Date(patient.dateOfBirth));

  const subheadParts = [
    `Age ${age}`,
    patient.gestationalAgeWeeks
      ? `${patient.gestationalAgeWeeks}w GA`
      : null,
    patient.status === "POSTPARTUM" ? "Postpartum" : null,
    patient.dueDate
      ? `EDD ${format(new Date(patient.dueDate), "MMM d, yyyy")}`
      : null,
    patient.insuranceType ?? null,
  ].filter(Boolean);

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to panel
          </Link>
        </Button>
      </div>

      {/* Patient header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-slate-900">
              {patient.firstName} {patient.lastName}
            </h1>
            <span className="text-sm font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {STATUS_LABELS[patient.status]}
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {subheadParts.join(" · ")}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <RiskBadge
            level={patient.riskLevel as RiskLevel}
            score={patient.riskScore}
          />
          <EditPatientDialog patient={{
            id: patient.id,
            firstName: patient.firstName,
            lastName: patient.lastName,
            dateOfBirth: patient.dateOfBirth,
            dueDate: patient.dueDate,
            status: patient.status,
            gestationalAgeWeeks: patient.gestationalAgeWeeks,
            insuranceType: patient.insuranceType,
          }} />
          <RecordVitalDialog patientId={patient.id} />
          <ScheduleAppointmentDialog
            patientId={patient.id}
            patientName={`${patient.firstName} ${patient.lastName}`}
          />
          <HandoffDialog
            patientId={patient.id}
            patientName={`${patient.firstName} ${patient.lastName}`}
            providers={allProviders}
            currentProviderId={session!.user.id}
            riskSummary={patient.aiRiskSummary}
          />
          <ExportButton patientId={patient.id} />
          <Button variant="outline" size="sm">
            <Phone className="w-3.5 h-3.5 mr-1.5" />
            Call
          </Button>
          {patient.dueDate && (
            <div className="flex items-center gap-1.5 text-sm text-slate-500">
              <Calendar className="w-4 h-4" />
              <span>EDD {format(new Date(patient.dueDate), "MMM d")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <PatientTabs patient={patient} />
    </div>
  );
}
