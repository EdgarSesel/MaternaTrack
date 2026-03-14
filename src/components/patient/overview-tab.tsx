"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BpChart, WeightChart, GlucoseChart } from "@/components/patient/vitals-chart";
import { format, differenceInDays } from "date-fns";
import type {
  Patient,
  Vital,
  Screening,
  CarePlan,
  CareTask,
  RiskScoreHistory,
  Appointment,
} from "@/generated/prisma/client";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import { AiRiskSummary } from "@/components/ai/ai-risk-summary";
import { AdministerScreeningDialog } from "@/components/patient/administer-screening-dialog";
import { RescheduleAppointmentDialog } from "@/components/appointments/reschedule-appointment-dialog";
import { RiskTrendIndicator } from "@/components/patient/risk-trajectory";
import { predictRiskTrend } from "@/lib/risk-predictor";

type PatientData = Patient & {
  vitals: Vital[];
  screenings: Screening[];
  carePlans: (CarePlan & { tasks: CareTask[] })[];
  riskScoreHistory: RiskScoreHistory[];
  appointments: Appointment[];
};

interface RiskFactor {
  factor: string;
  score: number;
  weight: number;
  trend: "improving" | "worsening" | "stable";
}

const FACTOR_LABELS: Record<string, string> = {
  age: "Age",
  bmi: "BMI",
  previousPreterm: "Previous Preterm",
  previousCSection: "Previous C-Section",
  preexistingConditions: "Pre-existing Conditions",
  bloodPressureTrend: "Blood Pressure Trend",
  glucoseStatus: "Glucose / GDM",
  weightGainTrajectory: "Weight Gain",
  depressionScreening: "Depression Screening",
  substanceUse: "Substance Use",
  appointmentAdherence: "Appointment Adherence",
  daysSinceLastContact: "Days Since Contact",
  careTaskCompletion: "Care Task Completion",
  housingInstability: "Housing Instability",
  foodInsecurity: "Food Insecurity",
  transportationBarrier: "Transportation Barrier",
  socialIsolation: "Social Isolation",
  intimatePartnerViolence: "Intimate Partner Violence",
};

const SCREENING_LABELS: Record<string, string> = {
  phq9: "PHQ-9 (Depression)",
  epds: "EPDS (Postpartum Depression)",
  gdm_screen: "GDM Screening",
  sdoh: "Social Determinants",
  gad7: "GAD-7 (Anxiety)",
};

const RISK_RESULT_CLASSES: Record<string, string> = {
  minimal: "bg-green-50 text-green-700",
  low: "bg-green-50 text-green-700",
  mild: "bg-yellow-50 text-yellow-700",
  moderate: "bg-orange-50 text-orange-700",
  moderate_severe: "bg-red-50 text-red-700",
  severe: "bg-red-50 text-red-700",
  high: "bg-red-50 text-red-700",
  positive: "bg-orange-50 text-orange-700",
  negative: "bg-green-50 text-green-700",
};

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "improving") return <TrendingDown className="w-3.5 h-3.5 text-green-500" />;
  if (trend === "worsening") return <TrendingUp className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-slate-400" />;
}

function getRiskBarColor(score: number, maxScore: number): string {
  const ratio = score / maxScore;
  if (ratio > 0.7) return "bg-red-500";
  if (ratio > 0.4) return "bg-orange-400";
  return "bg-yellow-400";
}

function computeStaleReason(
  patient: PatientData,
  summaryAt: Date | null,
): string | null {
  if (!summaryAt) return null;

  if (differenceInDays(new Date(), summaryAt) >= 3)
    return `Summary is ${differenceInDays(new Date(), summaryAt)} days old`;

  if (patient.vitals.some((v) => new Date(v.recordedAt) > summaryAt))
    return "New vital signs recorded since last summary";

  if (patient.screenings.some((s) => new Date(s.administeredAt) > summaryAt))
    return "New screening completed since last summary";

  if (new Date(patient.updatedAt) > summaryAt)
    return "Patient record updated since last summary";

  return null;
}

export function OverviewTab({
  patient,
  patientId,
}: {
  patient: PatientData;
  patientId: string;
}) {
  const summaryAt = patient.aiRiskSummaryAt ? new Date(patient.aiRiskSummaryAt) : null;
  const staleReason = computeStaleReason(patient, summaryAt);
  const riskFactors = (patient.riskFactors as unknown as RiskFactor[]) ?? [];
  const riskTrend = predictRiskTrend(
    patient.riskScoreHistory.map((h) => ({ score: h.score, calculatedAt: h.calculatedAt }))
  );
  const medicalHistory = (patient.medicalHistory as unknown as Record<string, unknown>) ?? {};
  const socialDeterminants = (patient.socialDeterminants as unknown as Record<string, boolean>) ?? {};

  const hasBloodPressure = patient.vitals.some((v) => v.type === "bp");
  const hasWeight = patient.vitals.some((v) => v.type === "weight");
  const hasGlucose = patient.vitals.some((v) => v.type === "glucose");

  const sdohFlags = Object.entries(socialDeterminants)
    .filter(([, val]) => val === true)
    .map(([key]) => key);

  const conditions = (medicalHistory.preexistingConditions as string[]) ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Risk Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Risk Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <div className="text-4xl font-bold text-slate-900">{patient.riskScore}</div>
            <div>
              <div className="text-xs text-slate-500">Risk Score</div>
              <div className="text-xs font-medium text-slate-700">
                {patient.riskLevel.replace("_", " ")}
              </div>
              <div className="mt-1">
                <RiskTrendIndicator trend={riskTrend} />
              </div>
            </div>
            {/* Risk gauge bar */}
            <div className="flex-1 ml-2">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    patient.riskScore > 75
                      ? "bg-red-500"
                      : patient.riskScore > 50
                      ? "bg-orange-400"
                      : patient.riskScore > 25
                      ? "bg-yellow-400"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${patient.riskScore}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                <span>0</span>
                <span>100</span>
              </div>
            </div>
          </div>

          {riskFactors.length > 0 ? (
            <div className="space-y-2">
              {riskFactors.map((factor) => (
                <div key={factor.factor} className="flex items-center gap-2">
                  <div className="w-32 text-xs text-slate-600 flex-shrink-0 truncate">
                    {FACTOR_LABELS[factor.factor] ?? factor.factor}
                  </div>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
                    <div
                      className={`h-full rounded-full ${getRiskBarColor(factor.score, factor.weight)}`}
                      style={{
                        width: `${Math.min(100, (factor.score / factor.weight) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 w-12 text-right">
                    {factor.score}/{factor.weight}
                  </div>
                  <TrendIcon trend={factor.trend} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">No risk factors recorded</p>
          )}
        </CardContent>
      </Card>

      {/* Clinical Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Clinical Summary
            </CardTitle>
            <AdministerScreeningDialog
              patientId={patientId}
              patientStatus={patient.status}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Medical history */}
          {conditions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                Conditions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {conditions.map((c) => (
                  <Badge
                    key={c}
                    variant="secondary"
                    className="text-xs capitalize"
                  >
                    {c.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* SDOH flags */}
          {sdohFlags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                Social Risk Flags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {sdohFlags.map((flag) => (
                  <Badge
                    key={flag}
                    variant="outline"
                    className="text-xs border-orange-200 text-orange-700 bg-orange-50 capitalize"
                  >
                    {flag.replace(/([A-Z])/g, " $1").trim()}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Latest screenings */}
          {patient.screenings.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">
                Recent Screenings
              </p>
              <div className="space-y-1.5">
                {patient.screenings.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-slate-600">
                      {SCREENING_LABELS[s.type] ?? s.type}
                    </span>
                    <div className="flex items-center gap-2">
                      {s.score !== null && (
                        <span className="font-medium text-slate-700">
                          Score: {s.score}
                        </span>
                      )}
                      {s.riskResult && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize ${RISK_RESULT_CLASSES[s.riskResult] ?? "bg-slate-100 text-slate-600"}`}
                        >
                          {s.riskResult.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {conditions.length === 0 && sdohFlags.length === 0 && patient.screenings.length === 0 && (
            <p className="text-xs text-slate-400">No clinical data recorded</p>
          )}
        </CardContent>
      </Card>

      {/* Blood Pressure Chart */}
      {hasBloodPressure && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Blood Pressure Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <BpChart vitals={patient.vitals} />
          </CardContent>
        </Card>
      )}

      {/* Glucose Chart */}
      {hasGlucose && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Fasting Glucose Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <GlucoseChart vitals={patient.vitals} />
          </CardContent>
        </Card>
      )}

      {/* Weight Chart */}
      {hasWeight && (
        <Card className={hasGlucose || hasBloodPressure ? "" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Weight Trend
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <WeightChart vitals={patient.vitals} />
          </CardContent>
        </Card>
      )}

      {/* No vitals */}
      {!hasBloodPressure && !hasWeight && !hasGlucose && (
        <Card className="md:col-span-2">
          <CardContent className="py-10 text-center">
            <p className="text-slate-400 text-sm">
              No vital signs recorded yet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* AI Risk Summary */}
      <AiRiskSummary
        patientId={patientId}
        initialSummary={patient.aiRiskSummary ?? null}
        summaryAt={summaryAt}
        staleReason={staleReason}
      />

      {/* Last Contact */}
      {patient.lastContactAt && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
              Last Contact
            </p>
            <p className="text-sm font-medium text-slate-800">
              {format(new Date(patient.lastContactAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
            {patient.lastContactChannel && (
              <p className="text-xs text-slate-500 capitalize mt-0.5">
                via {patient.lastContactChannel}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Appointments */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-500" />
            <CardTitle className="text-sm font-medium text-slate-600">Appointments</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {patient.appointments.length === 0 ? (
            <p className="text-xs text-slate-400">No appointments recorded.</p>
          ) : (
            <div className="space-y-2">
              {patient.appointments.map((appt) => {
                const apptDate = new Date(appt.scheduledAt);
                const isUpcoming = apptDate > new Date() && appt.status === "scheduled";
                const statusColors: Record<string, string> = {
                  scheduled: "bg-blue-50 text-blue-700",
                  completed: "bg-green-50 text-green-700",
                  cancelled: "bg-slate-100 text-slate-500",
                  no_show: "bg-red-50 text-red-700",
                };
                return (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`shrink-0 text-center text-xs font-medium rounded px-2 py-1 ${statusColors[appt.status] ?? "bg-slate-100"}`}>
                        {appt.status.replace("_", " ")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 capitalize">
                          {appt.type.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-slate-500">
                          {format(apptDate, "MMM d, yyyy 'at' h:mm a")} · {appt.duration} min
                        </p>
                      </div>
                    </div>
                    {isUpcoming && (
                      <RescheduleAppointmentDialog
                        appointmentId={appt.id}
                        patientId={patientId}
                        currentScheduledAt={apptDate}
                        currentDuration={appt.duration}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
