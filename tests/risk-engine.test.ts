import { describe, it, expect } from "vitest";
import {
  calculateRiskScore,
  scoreToLevel,
  type RiskInput,
} from "../src/lib/risk-engine";
import { RiskLevel } from "../src/generated/prisma/client";

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

const NOW = new Date("2026-03-06T12:00:00Z");

/** Returns a Date `years` years before NOW */
function yearsAgo(years: number): Date {
  return new Date(NOW.getTime() - years * 365.25 * 24 * 3600 * 1000);
}

/** Returns a Date `days` before NOW */
function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 3600 * 1000);
}

/** Minimal low-risk patient input (base state) */
const LOW_RISK_BASE: RiskInput = {
  dateOfBirth: yearsAgo(28),
  bmi: 23,
  previousPreterm: false,
  previousCSection: false,
  preexistingConditions: [],
  substanceUse: "none",
  recentBpReadings: [
    { systolic: 110, diastolic: 68, recordedAt: daysAgo(7) },
    { systolic: 112, diastolic: 70, recordedAt: daysAgo(1) },
  ],
  recentGlucoseReadings: [],
  recentWeightReadings: [],
  latestPhq9Score: null,
  hasGdmDiagnosis: false,
  lastContactAt: daysAgo(2),
  now: NOW,
  appointmentAdherenceRate: 1.0,
  careTaskCompletionRate: 0.9,
  housingInstability: false,
  foodInsecurity: false,
  transportationBarrier: false,
  socialIsolation: false,
  intimatePartnerViolence: false,
};

// ---------------------------------------------------------------------------
// Test 1: scoreToLevel mapping
// ---------------------------------------------------------------------------

describe("scoreToLevel", () => {
  it("maps 0 → LOW", () => expect(scoreToLevel(0)).toBe(RiskLevel.LOW));
  it("maps 25 → LOW", () => expect(scoreToLevel(25)).toBe(RiskLevel.LOW));
  it("maps 26 → MODERATE", () => expect(scoreToLevel(26)).toBe(RiskLevel.MODERATE));
  it("maps 50 → MODERATE", () => expect(scoreToLevel(50)).toBe(RiskLevel.MODERATE));
  it("maps 51 → HIGH", () => expect(scoreToLevel(51)).toBe(RiskLevel.HIGH));
  it("maps 75 → HIGH", () => expect(scoreToLevel(75)).toBe(RiskLevel.HIGH));
  it("maps 76 → VERY_HIGH", () => expect(scoreToLevel(76)).toBe(RiskLevel.VERY_HIGH));
  it("maps 100 → VERY_HIGH", () => expect(scoreToLevel(100)).toBe(RiskLevel.VERY_HIGH));
});

// ---------------------------------------------------------------------------
// Test 2: Low-risk patient gets LOW level
// ---------------------------------------------------------------------------

describe("low-risk patient", () => {
  it("returns score ≤ 25 for a healthy, engaged patient", () => {
    const result = calculateRiskScore(LOW_RISK_BASE);
    expect(result.score).toBeLessThanOrEqual(25);
    expect(result.level).toBe(RiskLevel.LOW);
  });

  it("returns empty factors array when no risk signals", () => {
    const result = calculateRiskScore(LOW_RISK_BASE);
    expect(result.factors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Age scoring
// ---------------------------------------------------------------------------

describe("age risk factor", () => {
  it("adds 5 pts for patient under 18", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, dateOfBirth: yearsAgo(17) });
    const ageFactor = result.factors.find((f) => f.factor === "age");
    expect(ageFactor?.score).toBe(5);
  });

  it("adds 5 pts for patient aged 38", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, dateOfBirth: yearsAgo(38) });
    const ageFactor = result.factors.find((f) => f.factor === "age");
    expect(ageFactor?.score).toBe(5);
  });

  it("adds 8 pts for patient over 40", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, dateOfBirth: yearsAgo(42) });
    const ageFactor = result.factors.find((f) => f.factor === "age");
    expect(ageFactor?.score).toBe(8);
  });

  it("adds 0 pts for patient aged 30 (normal range)", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, dateOfBirth: yearsAgo(30) });
    const ageFactor = result.factors.find((f) => f.factor === "age");
    expect(ageFactor).toBeUndefined(); // filtered out (score 0)
  });
});

// ---------------------------------------------------------------------------
// Test 4: Blood pressure scoring
// ---------------------------------------------------------------------------

describe("blood pressure trend", () => {
  it("scores 10 pts when latest BP ≥ 140/90 (hypertensive)", () => {
    const result = calculateRiskScore({
      ...LOW_RISK_BASE,
      recentBpReadings: [
        { systolic: 130, diastolic: 82, recordedAt: daysAgo(14) },
        { systolic: 142, diastolic: 92, recordedAt: daysAgo(1) },
      ],
    });
    const bpFactor = result.factors.find((f) => f.factor === "bloodPressureTrend");
    expect(bpFactor?.score).toBe(10);
  });

  it("scores 8 pts for rising systolic trend ≥ 10 mmHg over 3 readings", () => {
    const result = calculateRiskScore({
      ...LOW_RISK_BASE,
      recentBpReadings: [
        { systolic: 118, diastolic: 76, recordedAt: daysAgo(21) },
        { systolic: 124, diastolic: 80, recordedAt: daysAgo(14) },
        { systolic: 130, diastolic: 84, recordedAt: daysAgo(7) },
      ],
    });
    const bpFactor = result.factors.find((f) => f.factor === "bloodPressureTrend");
    expect(bpFactor?.score).toBe(8);
  });

  it("scores 5 pts for borderline BP (130–139/85–89)", () => {
    const result = calculateRiskScore({
      ...LOW_RISK_BASE,
      recentBpReadings: [
        { systolic: 132, diastolic: 86, recordedAt: daysAgo(1) },
      ],
    });
    const bpFactor = result.factors.find((f) => f.factor === "bloodPressureTrend");
    expect(bpFactor?.score).toBe(5);
  });

  it("scores 0 pts for normal BP", () => {
    const result = calculateRiskScore({
      ...LOW_RISK_BASE,
      recentBpReadings: [{ systolic: 115, diastolic: 72, recordedAt: daysAgo(1) }],
    });
    const bpFactor = result.factors.find((f) => f.factor === "bloodPressureTrend");
    expect(bpFactor).toBeUndefined();
  });

  it("marks trend as worsening when hypertensive and rising", () => {
    const result = calculateRiskScore({
      ...LOW_RISK_BASE,
      recentBpReadings: [
        { systolic: 138, diastolic: 88, recordedAt: daysAgo(7) },
        { systolic: 145, diastolic: 94, recordedAt: daysAgo(1) },
      ],
    });
    const bpFactor = result.factors.find((f) => f.factor === "bloodPressureTrend");
    expect(bpFactor?.trend).toBe("worsening");
  });
});

// ---------------------------------------------------------------------------
// Test 5: PHQ-9 depression screening
// ---------------------------------------------------------------------------

describe("depression screening (PHQ-9)", () => {
  it("scores 7 pts for severe depression (score ≥ 15)", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, latestPhq9Score: 17 });
    const f = result.factors.find((f) => f.factor === "depressionScreening");
    expect(f?.score).toBe(7);
  });

  it("scores 5 pts for moderate depression (score ≥ 10)", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, latestPhq9Score: 12 });
    const f = result.factors.find((f) => f.factor === "depressionScreening");
    expect(f?.score).toBe(5);
  });

  it("scores 2 pts for mild depression (score ≥ 5)", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, latestPhq9Score: 6 });
    const f = result.factors.find((f) => f.factor === "depressionScreening");
    expect(f?.score).toBe(2);
  });

  it("scores 0 pts for minimal/no depression (score < 5)", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, latestPhq9Score: 3 });
    const f = result.factors.find((f) => f.factor === "depressionScreening");
    expect(f).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Test 6: Social determinants
// ---------------------------------------------------------------------------

describe("social determinants", () => {
  it("adds 8 pts for IPV flag", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, intimatePartnerViolence: true });
    const f = result.factors.find((f) => f.factor === "intimatePartnerViolence");
    expect(f?.score).toBe(8);
  });

  it("adds 5 pts for food insecurity", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, foodInsecurity: true });
    const f = result.factors.find((f) => f.factor === "foodInsecurity");
    expect(f?.score).toBe(5);
  });

  it("accumulates multiple SDOH flags correctly", () => {
    const result = calculateRiskScore({
      ...LOW_RISK_BASE,
      housingInstability: true,
      foodInsecurity: true,
      transportationBarrier: true,
    });
    const sdohTotal = result.factors
      .filter((f) =>
        ["housingInstability", "foodInsecurity", "transportationBarrier"].includes(f.factor)
      )
      .reduce((s, f) => s + f.score, 0);
    expect(sdohTotal).toBe(14); // 5 + 5 + 4
  });
});

// ---------------------------------------------------------------------------
// Test 7: Engagement & adherence
// ---------------------------------------------------------------------------

describe("engagement & adherence", () => {
  it("adds 6 pts when last contact > 14 days ago", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, lastContactAt: daysAgo(20) });
    const f = result.factors.find((f) => f.factor === "daysSinceLastContact");
    expect(f?.score).toBe(6);
  });

  it("adds 3 pts when last contact 8–14 days ago", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, lastContactAt: daysAgo(10) });
    const f = result.factors.find((f) => f.factor === "daysSinceLastContact");
    expect(f?.score).toBe(3);
  });

  it("adds 0 pts when contacted within 7 days", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, lastContactAt: daysAgo(3) });
    const f = result.factors.find((f) => f.factor === "daysSinceLastContact");
    expect(f).toBeUndefined();
  });

  it("adds 7 pts for appointment adherence < 50%", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, appointmentAdherenceRate: 0.4 });
    const f = result.factors.find((f) => f.factor === "appointmentAdherence");
    expect(f?.score).toBe(7);
  });

  it("adds 7 pts for care task completion < 50%", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, careTaskCompletionRate: 0.3 });
    const f = result.factors.find((f) => f.factor === "careTaskCompletion");
    expect(f?.score).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Test 8: GDM / Glucose
// ---------------------------------------------------------------------------

describe("glucose & GDM", () => {
  it("scores 8 pts when GDM is diagnosed", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, hasGdmDiagnosis: true });
    const f = result.factors.find((f) => f.factor === "glucoseStatus");
    expect(f?.score).toBe(8);
  });

  it("marks GDM trend as improving when glucose is falling", () => {
    const result = calculateRiskScore({
      ...LOW_RISK_BASE,
      hasGdmDiagnosis: true,
      recentGlucoseReadings: [
        { value: 148, recordedAt: daysAgo(28) },
        { value: 105, recordedAt: daysAgo(1) }, // significant drop
      ],
    });
    const f = result.factors.find((f) => f.factor === "glucoseStatus");
    expect(f?.trend).toBe("improving");
  });

  it("scores 6 pts when all recent glucose readings > 130", () => {
    const result = calculateRiskScore({
      ...LOW_RISK_BASE,
      recentGlucoseReadings: [
        { value: 145, recordedAt: daysAgo(21) },
        { value: 138, recordedAt: daysAgo(14) },
        { value: 132, recordedAt: daysAgo(7) },
      ],
    });
    const f = result.factors.find((f) => f.factor === "glucoseStatus");
    expect(f?.score).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Test 9: Archetype — Sarah (High-Risk Preeclampsia)
// ---------------------------------------------------------------------------

describe("Sarah archetype — HIGH risk preeclampsia", () => {
  const sarah: RiskInput = {
    dateOfBirth: yearsAgo(38),
    bmi: 33,
    previousPreterm: false,
    previousCSection: false,
    preexistingConditions: ["chronic_hypertension", "thrombophilia"],
    substanceUse: "none",
    recentBpReadings: [
      { systolic: 118, diastolic: 76, recordedAt: daysAgo(28) },
      { systolic: 128, diastolic: 82, recordedAt: daysAgo(21) },
      { systolic: 136, diastolic: 88, recordedAt: daysAgo(14) },
      { systolic: 142, diastolic: 92, recordedAt: daysAgo(7) },
    ],
    recentGlucoseReadings: [],
    recentWeightReadings: [
      { value: 185, recordedAt: daysAgo(28) },
      { value: 198, recordedAt: daysAgo(1) }, // ~3.3 lbs/week — excessive
    ],
    latestPhq9Score: 6,
    hasGdmDiagnosis: false,
    lastContactAt: daysAgo(10),
    now: NOW,
    appointmentAdherenceRate: 0.4,
    careTaskCompletionRate: 0.7,
    housingInstability: true,
    foodInsecurity: true,
    transportationBarrier: false,
    socialIsolation: false,
    intimatePartnerViolence: false,
  };

  it("has a risk score in the HIGH range (51–75)", () => {
    const result = calculateRiskScore(sarah);
    expect(result.score).toBeGreaterThanOrEqual(51);
    expect(result.score).toBeLessThanOrEqual(75);
    expect(result.level).toBe(RiskLevel.HIGH);
  });

  it("includes bloodPressureTrend as a top factor", () => {
    const result = calculateRiskScore(sarah);
    const bp = result.factors.find((f) => f.factor === "bloodPressureTrend");
    expect(bp?.score).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Test 10: Archetype — Aisha (VERY_HIGH disengaged)
// ---------------------------------------------------------------------------

describe("Aisha archetype — VERY_HIGH disengaged", () => {
  const aisha: RiskInput = {
    dateOfBirth: yearsAgo(22),
    bmi: 37,
    previousPreterm: true,
    previousCSection: false,
    preexistingConditions: ["anemia", "chronic_hypertension"],
    substanceUse: "none",
    recentBpReadings: [],
    recentGlucoseReadings: [],
    recentWeightReadings: [],
    latestPhq9Score: 16,
    hasGdmDiagnosis: true,
    lastContactAt: daysAgo(16),
    now: NOW,
    appointmentAdherenceRate: 0.4,
    careTaskCompletionRate: 0.3,
    housingInstability: true,
    foodInsecurity: true,
    transportationBarrier: true,
    socialIsolation: true,
    intimatePartnerViolence: true,
  };

  it("has a risk score ≥ 76 (VERY_HIGH)", () => {
    const result = calculateRiskScore(aisha);
    expect(result.score).toBeGreaterThanOrEqual(76);
    expect(result.level).toBe(RiskLevel.VERY_HIGH);
  });

  it("includes previousPreterm, depressionScreening, and engagement factors", () => {
    const result = calculateRiskScore(aisha);
    const factorNames = result.factors.map((f) => f.factor);
    expect(factorNames).toContain("previousPreterm");
    expect(factorNames).toContain("depressionScreening");
    expect(factorNames).toContain("appointmentAdherence");
    expect(factorNames).toContain("careTaskCompletion");
  });
});

// ---------------------------------------------------------------------------
// Test 11: Archetype — Jennifer (LOW risk)
// ---------------------------------------------------------------------------

describe("Jennifer archetype — LOW routine", () => {
  const jennifer: RiskInput = {
    dateOfBirth: yearsAgo(30),
    bmi: 24,
    previousPreterm: false,
    previousCSection: false,
    preexistingConditions: [],
    substanceUse: "none",
    recentBpReadings: [
      { systolic: 110, diastolic: 68, recordedAt: daysAgo(7) },
    ],
    recentGlucoseReadings: [],
    recentWeightReadings: [],
    latestPhq9Score: 2,
    hasGdmDiagnosis: false,
    lastContactAt: daysAgo(3),
    now: NOW,
    appointmentAdherenceRate: 1.0,
    careTaskCompletionRate: 1.0,
    housingInstability: false,
    foodInsecurity: false,
    transportationBarrier: false,
    socialIsolation: false,
    intimatePartnerViolence: false,
  };

  it("has a risk score ≤ 25 (LOW)", () => {
    const result = calculateRiskScore(jennifer);
    expect(result.score).toBeLessThanOrEqual(25);
    expect(result.level).toBe(RiskLevel.LOW);
  });
});

// ---------------------------------------------------------------------------
// Test 12: Score is deterministic
// ---------------------------------------------------------------------------

describe("determinism", () => {
  it("returns identical scores when called twice with same input", () => {
    const r1 = calculateRiskScore(LOW_RISK_BASE);
    const r2 = calculateRiskScore(LOW_RISK_BASE);
    expect(r1.score).toBe(r2.score);
    expect(r1.level).toBe(r2.level);
  });

  it("score never exceeds 100", () => {
    const maxInput: RiskInput = {
      ...LOW_RISK_BASE,
      dateOfBirth: yearsAgo(42),
      bmi: 40,
      previousPreterm: true,
      previousCSection: true,
      preexistingConditions: ["condition1", "condition2", "condition3"],
      substanceUse: "active",
      recentBpReadings: [{ systolic: 160, diastolic: 100, recordedAt: daysAgo(1) }],
      latestPhq9Score: 20,
      hasGdmDiagnosis: true,
      lastContactAt: daysAgo(30),
      appointmentAdherenceRate: 0,
      careTaskCompletionRate: 0,
      housingInstability: true,
      foodInsecurity: true,
      transportationBarrier: true,
      socialIsolation: true,
      intimatePartnerViolence: true,
    };
    const result = calculateRiskScore(maxInput);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.level).toBe(RiskLevel.VERY_HIGH);
  });

  it("score is never negative", () => {
    const result = calculateRiskScore(LOW_RISK_BASE);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Test 13: Previous medical history
// ---------------------------------------------------------------------------

describe("medical history factors", () => {
  it("adds 8 pts for previous preterm birth", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, previousPreterm: true });
    const f = result.factors.find((f) => f.factor === "previousPreterm");
    expect(f?.score).toBe(8);
  });

  it("adds 4 pts for previous C-section", () => {
    const result = calculateRiskScore({ ...LOW_RISK_BASE, previousCSection: true });
    const f = result.factors.find((f) => f.factor === "previousCSection");
    expect(f?.score).toBe(4);
  });

  it("caps pre-existing conditions score at 8", () => {
    const result = calculateRiskScore({
      ...LOW_RISK_BASE,
      preexistingConditions: ["a", "b", "c", "d"], // 4 × 3 = 12, capped at 8
    });
    const f = result.factors.find((f) => f.factor === "preexistingConditions");
    expect(f?.score).toBe(8);
  });

  it("scores pre-existing conditions proportionally", () => {
    const result = calculateRiskScore({
      ...LOW_RISK_BASE,
      preexistingConditions: ["chronic_hypertension"],
    });
    const f = result.factors.find((f) => f.factor === "preexistingConditions");
    expect(f?.score).toBe(3); // 1 × 3
  });
});
