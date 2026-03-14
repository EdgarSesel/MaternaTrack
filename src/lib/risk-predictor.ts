/**
 * Predictive Risk Trend Analysis for MaternaTrack
 *
 * Uses simple linear regression on risk score history to project future scores
 * and detect escalating risk trajectories.
 */

const HIGH_THRESHOLD = 51;
const VERY_HIGH_THRESHOLD = 76;

export interface RiskTrend {
  direction: "rising" | "stable" | "falling";
  slope: number; // points per day
  projectedScore7d: number;
  projectedScore14d: number;
  alert: "critical_trajectory" | "rising_risk" | null;
}

/**
 * Simple linear regression: returns { slope, intercept } in units of score/day.
 * x = days since first data point, y = risk score
 */
function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n === 0) return { slope: 0, intercept: 0 };

  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumX2 = points.reduce((acc, p) => acc + p.x * p.x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Predicts risk trend from a series of historical risk scores.
 * Requires at least 3 data points for meaningful prediction.
 */
export function predictRiskTrend(
  history: { score: number; calculatedAt: Date }[]
): RiskTrend {
  // Need at least 3 data points
  if (history.length < 3) {
    const latestScore = history[history.length - 1]?.score ?? 0;
    return {
      direction: "stable",
      slope: 0,
      projectedScore7d: latestScore,
      projectedScore14d: latestScore,
      alert: null,
    };
  }

  // Sort ascending by date, take last 6 data points
  const sorted = [...history]
    .sort((a, b) => new Date(a.calculatedAt).getTime() - new Date(b.calculatedAt).getTime())
    .slice(-6);

  const firstTime = new Date(sorted[0].calculatedAt).getTime();
  const now = Date.now();
  const msToDays = 1000 * 60 * 60 * 24;

  // Build regression points
  const points = sorted.map((h) => ({
    x: (new Date(h.calculatedAt).getTime() - firstTime) / msToDays,
    y: h.score,
  }));

  const { slope, intercept } = linearRegression(points);

  // Current x = days from firstTime to now
  const currentX = (now - firstTime) / msToDays;
  const currentScore = intercept + slope * currentX;

  // Projected scores
  const projected7d = Math.round(Math.max(0, Math.min(100, intercept + slope * (currentX + 7))));
  const projected14d = Math.round(Math.max(0, Math.min(100, intercept + slope * (currentX + 14))));

  // Determine direction
  let direction: "rising" | "stable" | "falling";
  if (slope > 0.5) {
    direction = "rising";
  } else if (slope < -0.5) {
    direction = "falling";
  } else {
    direction = "stable";
  }

  // Determine alert
  let alert: "critical_trajectory" | "rising_risk" | null = null;
  const latestActualScore = sorted[sorted.length - 1].score;

  if (projected7d >= VERY_HIGH_THRESHOLD && latestActualScore < VERY_HIGH_THRESHOLD) {
    // Will cross VERY_HIGH threshold within 7 days
    alert = "critical_trajectory";
  } else if (projected14d >= HIGH_THRESHOLD && latestActualScore < HIGH_THRESHOLD) {
    // Will cross HIGH threshold within 14 days
    alert = "rising_risk";
  } else if (direction === "rising" && projected7d >= VERY_HIGH_THRESHOLD) {
    // Already in VERY_HIGH range and still rising fast
    alert = "critical_trajectory";
  } else if (direction === "rising" && slope > 1.0 && latestActualScore >= HIGH_THRESHOLD) {
    // In HIGH range and rising at > 1 pt/day
    alert = "rising_risk";
  }

  return {
    direction,
    slope: Math.round(slope * 100) / 100,
    projectedScore7d: projected7d,
    projectedScore14d: projected14d,
    alert,
  };
}
