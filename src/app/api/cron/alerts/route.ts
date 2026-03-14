/**
 * GET /api/cron/alerts
 *
 * Periodic endpoint that evaluates alert rules across all active patients.
 * Call this via Vercel Cron (vercel.json) or a manual trigger.
 *
 * Protected by CRON_SECRET header — must match CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { runAlertRules } from "@/lib/alert-rules";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");

  if (secret && provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();

  try {
    const result = await runAlertRules();
    const duration = Date.now() - start;

    logger.info("Alert cron completed", { ...result, durationMs: duration });

    return NextResponse.json({
      ok: true,
      evaluated: result.evaluated,
      alertsFired: result.fired.length,
      errors: result.errors,
      durationMs: duration,
      alerts: result.fired.map((a) => ({
        ruleId: a.ruleId,
        severity: a.severity,
        patientId: a.patientId,
        title: a.title,
      })),
    });
  } catch (err) {
    logger.error("Alert cron failed", { error: err });
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
