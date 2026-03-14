/**
 * MaternaTrack Risk Engine
 *
 * Pure, deterministic function that calculates a composite maternal risk score (0–100)
 * from structured clinical inputs. No randomness, no side effects, fully testable.
 *
 * Category weights:
 *   Demographic & History     — max 30 pts
 *   Current Clinical          — max 30 pts
 *   Engagement & Adherence    — max 20 pts
 *   Social Determinants       — max 20 pts
 *   Total max                 — 100 pts (values capped at 100)
 */

import { RiskLevel } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface BpReading {
  systolic: number;
  diastolic: number;
  recordedAt: Date;
}

export interface WeightReading {
  value: number; // lbs
  recordedAt: Date;
}

export interface GlucoseReading {
  value: number; // mg/dL fasting
  recordedAt: Date;
}

export interface RiskInput {
  // Demographics & History
  dateOfBirth: Date;
  bmi: number | null;
  previousPreterm: boolean;
  previousCSection: boolean;
  preexistingConditions: string[]; // e.g. ["chronic_hypertension", "gestational_diabetes"]
  substanceUse: "active" | "history" | "none";

  // Current Clinical
  recentBpReadings: BpReading[]; // ordered by date, most recent last
  recentGlucoseReadings: GlucoseReading[];
  recentWeightReadings: WeightReading[];
  latestPhq9Score: number | null;
  hasGdmDiagnosis: boolean;

  // Engagement & Adherence
  lastContactAt: Date | null;
  now: Date; // injected for determinism in tests
  appointmentAdherenceRate: number | null; // 0.0–1.0, null = no data
  careTaskCompletionRate: number | null; // 0.0–1.0, null = no data

  // Social Determinants
  housingInstability: boolean;
  foodInsecurity: boolean;
  transportationBarrier: boolean;
  socialIsolation: boolean;
  intimatePartnerViolence: boolean;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface RiskFactorResult {
  factor: string;
  label: string;
  score: number;
  maxScore: number;
  trend: "improving" | "worsening" | "stable";
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  factors: RiskFactorResult[];
}

// ---------------------------------------------------------------------------
// Score → Level mapping
// ---------------------------------------------------------------------------

export function scoreToLevel(score: number): RiskLevel {
  if (score >= 76) return RiskLevel.VERY_HIGH;
  if (score >= 51) return RiskLevel.HIGH;
  if (score >= 26) return RiskLevel.MODERATE;
  return RiskLevel.LOW;
}

// ---------------------------------------------------------------------------
// Individual factor scoring functions
// ---------------------------------------------------------------------------

function scoreAge(dob: Date, now: Date): number {
  const ageMs = now.getTime() - dob.getTime();
  const age = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25));
  if (age > 40) return 8;
  if (age > 35) return 5;
  if (age < 18) return 5;
  return 0;
}

function scoreBmi(bmi: number | null): number {
  if (bmi === null) return 0;
  if (bmi > 35) return 5;
  if (bmi > 30) return 3;
  return 0;
}

function scorePreexistingConditions(conditions: string[]): number {
  return Math.min(conditions.length * 3, 8);
}

function scoreSubstanceUse(use: "active" | "history" | "none"): number {
  if (use === "active") return 5;
  if (use === "history") return 2;
  return 0;
}

/**
 * Blood pressure scoring:
 * - Latest reading ≥ 140/90 (hypertensive) → 10
 * - Readings show rising trend (>10 mmHg increase systolic over last 3) → 8
 * - Latest reading 130–139 / 85–89 (stage 1 / borderline) → 5
 * - Otherwise → 0
 */
function scoreBpTrend(readings: BpReading[]): {
  score: number;
  trend: "improving" | "worsening" | "stable";
} {
  if (readings.length === 0) return { score: 0, trend: "stable" };

  const sorted = [...readings].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
  );
  const latest = sorted[sorted.length - 1];

  // Hypertensive range
  if (latest.systolic >= 140 || latest.diastolic >= 90) {
    const trend =
      sorted.length >= 2 &&
      latest.systolic > sorted[sorted.length - 2].systolic
        ? "worsening"
        : "stable";
    return { score: 10, trend };
  }

  // Check for rising trend: systolic increased ≥10 mmHg over last 3 readings
  if (sorted.length >= 3) {
    const oldest = sorted[sorted.length - 3];
    const systolicRise = latest.systolic - oldest.systolic;
    if (systolicRise >= 10) {
      return { score: 8, trend: "worsening" };
    }
  }

  // Borderline / Stage 1
  if (latest.systolic >= 130 || latest.diastolic >= 85) {
    return { score: 5, trend: "stable" };
  }

  // Check for improvement
  if (sorted.length >= 2) {
    const prev = sorted[sorted.length - 2];
    if (latest.systolic < prev.systolic - 5) {
      return { score: 0, trend: "improving" };
    }
  }

  return { score: 0, trend: "stable" };
}

/**
 * Glucose / GDM scoring:
 * - GDM diagnosis confirmed → 8
 * - Fasting glucose consistently > 130 (last 3 readings) → 6
 * - Fasting glucose > 110 (latest) → 4
 * - Otherwise → 0
 */
function scoreGlucose(
  readings: GlucoseReading[],
  hasGdm: boolean
): { score: number; trend: "improving" | "worsening" | "stable" } {
  if (hasGdm) {
    // Check if glucose is improving (managed)
    if (readings.length >= 2) {
      const sorted = [...readings].sort(
        (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
      );
      const latest = sorted[sorted.length - 1];
      const prev = sorted[sorted.length - 2];
      const trend = latest.value < prev.value - 5 ? "improving" : "stable";
      return { score: 8, trend };
    }
    return { score: 8, trend: "stable" };
  }

  if (readings.length === 0) return { score: 0, trend: "stable" };

  const sorted = [...readings].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
  );
  const latest = sorted[sorted.length - 1];

  if (readings.length >= 3) {
    const last3 = sorted.slice(-3);
    const allHigh = last3.every((r) => r.value > 130);
    if (allHigh) return { score: 6, trend: "worsening" };
  }

  if (latest.value > 110) return { score: 4, trend: "stable" };

  if (sorted.length >= 2) {
    const prev = sorted[sorted.length - 2];
    if (latest.value < prev.value - 10) {
      return { score: 0, trend: "improving" };
    }
  }

  return { score: 0, trend: "stable" };
}

/**
 * Weight gain trajectory:
 * Calculates gain rate per week over last 4 weeks.
 * - > 2.5 lbs/week OR < 0 lbs/4wk in second/third trimester → 5
 * - > 1.5 lbs/week (excessive) → 3
 * - Otherwise → 0
 */
function scoreWeightGain(readings: WeightReading[]): number {
  if (readings.length < 2) return 0;

  const sorted = [...readings].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
  );
  const oldest = sorted[0];
  const latest = sorted[sorted.length - 1];

  const weeks =
    (latest.recordedAt.getTime() - oldest.recordedAt.getTime()) /
    (1000 * 60 * 60 * 24 * 7);
  if (weeks < 1) return 0;

  const gainPerWeek = (latest.value - oldest.value) / weeks;

  // Weight loss during pregnancy is concerning
  if (latest.value < oldest.value) return 5;
  if (gainPerWeek > 2.5) return 5;
  if (gainPerWeek > 1.5) return 3;
  return 0;
}

/**
 * PHQ-9 Depression screening:
 * - Score ≥ 20 (severe) → 7
 * - Score ≥ 15 (moderately severe) → 7
 * - Score ≥ 10 (moderate) → 5
 * - Score ≥ 5 (mild) → 2
 * - Otherwise → 0
 */
function scoreDepression(phq9: number | null): number {
  if (phq9 === null) return 0;
  if (phq9 >= 15) return 7;
  if (phq9 >= 10) return 5;
  if (phq9 >= 5) return 2;
  return 0;
}

function scoreAppointmentAdherence(rate: number | null): number {
  if (rate === null) return 0;
  if (rate < 0.5) return 7;
  if (rate < 0.75) return 4;
  return 0;
}

function scoreDaysSinceContact(lastContactAt: Date | null, now: Date): {
  score: number;
  trend: "worsening" | "stable";
} {
  if (!lastContactAt) return { score: 6, trend: "worsening" };
  const days = Math.floor(
    (now.getTime() - lastContactAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days > 14) return { score: 6, trend: "worsening" };
  if (days > 7) return { score: 3, trend: "stable" };
  return { score: 0, trend: "stable" };
}

function scoreCareTaskCompletion(rate: number | null): number {
  if (rate === null) return 0;
  if (rate < 0.5) return 7;
  if (rate < 0.75) return 4;
  return 0;
}

// ---------------------------------------------------------------------------
// Main export: calculateRiskScore
// ---------------------------------------------------------------------------

export function calculateRiskScore(input: RiskInput): RiskResult {
  const factors: RiskFactorResult[] = [];

  // --- Demographic & History ---
  const ageScore = scoreAge(input.dateOfBirth, input.now);
  factors.push({
    factor: "age",
    label: "Age",
    score: ageScore,
    maxScore: 8,
    trend: "stable",
  });

  const bmiScore = scoreBmi(input.bmi);
  factors.push({
    factor: "bmi",
    label: "BMI",
    score: bmiScore,
    maxScore: 5,
    trend: "stable",
  });

  const pretermScore = input.previousPreterm ? 8 : 0;
  factors.push({
    factor: "previousPreterm",
    label: "Previous Preterm Birth",
    score: pretermScore,
    maxScore: 8,
    trend: "stable",
  });

  const cSectionScore = input.previousCSection ? 4 : 0;
  factors.push({
    factor: "previousCSection",
    label: "Previous C-Section",
    score: cSectionScore,
    maxScore: 4,
    trend: "stable",
  });

  const conditionsScore = scorePreexistingConditions(
    input.preexistingConditions
  );
  factors.push({
    factor: "preexistingConditions",
    label: "Pre-existing Conditions",
    score: conditionsScore,
    maxScore: 8,
    trend: "stable",
  });

  const substanceScore = scoreSubstanceUse(input.substanceUse);
  factors.push({
    factor: "substanceUse",
    label: "Substance Use",
    score: substanceScore,
    maxScore: 5,
    trend: input.substanceUse === "active" ? "worsening" : "stable",
  });

  // --- Current Clinical ---
  const bpResult = scoreBpTrend(input.recentBpReadings);
  factors.push({
    factor: "bloodPressureTrend",
    label: "Blood Pressure Trend",
    score: bpResult.score,
    maxScore: 10,
    trend: bpResult.trend,
  });

  const glucoseResult = scoreGlucose(
    input.recentGlucoseReadings,
    input.hasGdmDiagnosis
  );
  factors.push({
    factor: "glucoseStatus",
    label: "Glucose / GDM Status",
    score: glucoseResult.score,
    maxScore: 8,
    trend: glucoseResult.trend,
  });

  const weightScore = scoreWeightGain(input.recentWeightReadings);
  factors.push({
    factor: "weightGainTrajectory",
    label: "Weight Gain Trajectory",
    score: weightScore,
    maxScore: 5,
    trend: weightScore > 0 ? "worsening" : "stable",
  });

  const depressionScore = scoreDepression(input.latestPhq9Score);
  factors.push({
    factor: "depressionScreening",
    label: "Depression Screening (PHQ-9)",
    score: depressionScore,
    maxScore: 7,
    trend: "stable",
  });

  // --- Engagement & Adherence ---
  const apptScore = scoreAppointmentAdherence(input.appointmentAdherenceRate);
  factors.push({
    factor: "appointmentAdherence",
    label: "Appointment Adherence",
    score: apptScore,
    maxScore: 7,
    trend: apptScore > 0 ? "worsening" : "stable",
  });

  const contactResult = scoreDaysSinceContact(input.lastContactAt, input.now);
  factors.push({
    factor: "daysSinceLastContact",
    label: "Days Since Last Contact",
    score: contactResult.score,
    maxScore: 6,
    trend: contactResult.trend,
  });

  const taskScore = scoreCareTaskCompletion(input.careTaskCompletionRate);
  factors.push({
    factor: "careTaskCompletion",
    label: "Care Task Completion",
    score: taskScore,
    maxScore: 7,
    trend: taskScore > 0 ? "worsening" : "stable",
  });

  // --- Social Determinants ---
  factors.push({
    factor: "housingInstability",
    label: "Housing Instability",
    score: input.housingInstability ? 5 : 0,
    maxScore: 5,
    trend: "stable",
  });

  factors.push({
    factor: "foodInsecurity",
    label: "Food Insecurity",
    score: input.foodInsecurity ? 5 : 0,
    maxScore: 5,
    trend: "stable",
  });

  factors.push({
    factor: "transportationBarrier",
    label: "Transportation Barrier",
    score: input.transportationBarrier ? 4 : 0,
    maxScore: 4,
    trend: "stable",
  });

  factors.push({
    factor: "socialIsolation",
    label: "Social Isolation",
    score: input.socialIsolation ? 3 : 0,
    maxScore: 3,
    trend: "stable",
  });

  factors.push({
    factor: "intimatePartnerViolence",
    label: "Intimate Partner Violence",
    score: input.intimatePartnerViolence ? 8 : 0,
    maxScore: 8,
    trend: input.intimatePartnerViolence ? "worsening" : "stable",
  });

  // --- Final score ---
  const rawScore = factors.reduce((sum, f) => sum + f.score, 0);
  const score = Math.min(100, Math.max(0, rawScore));
  const level = scoreToLevel(score);

  // Filter out zero-score factors to keep the output focused
  const significantFactors = factors.filter((f) => f.score > 0);

  return { score, level, factors: significantFactors };
}

// ---------------------------------------------------------------------------
// Utility: build RiskInput from Prisma models
// ---------------------------------------------------------------------------

interface PrismaPatient {
  dateOfBirth: Date;
  medicalHistory: unknown;
  socialDeterminants: unknown;
  lastContactAt: Date | null;
}

interface PrismaVital {
  type: string;
  value: unknown;
  recordedAt: Date;
}

interface PrismaScreening {
  type: string;
  score: number | null;
  administeredAt: Date;
}

interface PrismaCareTask {
  status: string;
}

interface PrismaAppointment {
  status: string;
}

interface MedicalHistory {
  bmi?: number;
  previousPreterm?: boolean;
  previousCSection?: boolean;
  preexistingConditions?: string[];
  substanceUse?: "active" | "history" | "none";
}

interface SocialDeterminants {
  housingInstability?: boolean;
  foodInsecurity?: boolean;
  transportationBarrier?: boolean;
  socialIsolation?: boolean;
  intimatePartnerViolence?: boolean;
}

interface BpVitalValue {
  systolic: number;
  diastolic: number;
}

interface NumericVitalValue {
  value: number;
}

export function buildRiskInput(
  patient: PrismaPatient,
  vitals: PrismaVital[],
  screenings: PrismaScreening[],
  tasks: PrismaCareTask[],
  appointments: PrismaAppointment[],
  now = new Date()
): RiskInput {
  const mh = (patient.medicalHistory as unknown as MedicalHistory) ?? {};
  const sd = (patient.socialDeterminants as unknown as SocialDeterminants) ?? {};

  const bpReadings: BpReading[] = vitals
    .filter((v) => v.type === "bp")
    .map((v) => {
      const val = v.value as unknown as BpVitalValue;
      return { systolic: val.systolic, diastolic: val.diastolic, recordedAt: v.recordedAt };
    })
    .filter((r) => r.systolic && r.diastolic);

  const glucoseReadings: GlucoseReading[] = vitals
    .filter((v) => v.type === "glucose")
    .map((v) => {
      const val = v.value as unknown as NumericVitalValue;
      return { value: val.value, recordedAt: v.recordedAt };
    })
    .filter((r) => r.value);

  const weightReadings: WeightReading[] = vitals
    .filter((v) => v.type === "weight")
    .map((v) => {
      const val = v.value as unknown as NumericVitalValue;
      return { value: val.value, recordedAt: v.recordedAt };
    })
    .filter((r) => r.value);

  // PHQ-9 or EPDS — use most recent
  const depressionScreenings = screenings
    .filter((s) => s.type === "phq9" || s.type === "epds")
    .sort((a, b) => b.administeredAt.getTime() - a.administeredAt.getTime());
  const latestPhq9Score = depressionScreenings[0]?.score ?? null;

  const hasGdmDiagnosis =
    mh.preexistingConditions?.includes("gestational_diabetes") ??
    screenings.some(
      (s) => s.type === "gdm_screen" && s.score === null
    );

  // Task completion rate
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
  const careTaskCompletionRate =
    totalTasks > 0 ? completedTasks / totalTasks : null;

  // Appointment adherence rate
  const totalAppts = appointments.length;
  const attendedAppts = appointments.filter(
    (a) => a.status === "completed"
  ).length;
  const appointmentAdherenceRate =
    totalAppts > 0 ? attendedAppts / totalAppts : null;

  return {
    dateOfBirth: patient.dateOfBirth,
    bmi: mh.bmi ?? null,
    previousPreterm: mh.previousPreterm ?? false,
    previousCSection: mh.previousCSection ?? false,
    preexistingConditions: mh.preexistingConditions ?? [],
    substanceUse: mh.substanceUse ?? "none",
    recentBpReadings: bpReadings,
    recentGlucoseReadings: glucoseReadings,
    recentWeightReadings: weightReadings,
    latestPhq9Score,
    hasGdmDiagnosis,
    lastContactAt: patient.lastContactAt,
    now,
    appointmentAdherenceRate,
    careTaskCompletionRate,
    housingInstability: sd.housingInstability ?? false,
    foodInsecurity: sd.foodInsecurity ?? false,
    transportationBarrier: sd.transportationBarrier ?? false,
    socialIsolation: sd.socialIsolation ?? false,
    intimatePartnerViolence: sd.intimatePartnerViolence ?? false,
  };
}
