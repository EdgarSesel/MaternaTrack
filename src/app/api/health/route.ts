/**
 * GET /api/health
 *
 * Health check endpoint for uptime monitoring.
 * Checks: DB connectivity, AI provider config.
 * Never exposes sensitive data.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET() {
  const start = Date.now();
  const checks: Record<string, { status: "ok" | "error"; latencyMs?: number; detail?: string }> = {};

  // Database connectivity
  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    checks.database = { status: "ok", latencyMs: Date.now() - dbStart };
  } catch (err) {
    logger.error("Health check: DB error", { error: String(err) });
    checks.database = { status: "error", detail: "Cannot connect to database" };
  }

  // AI provider configuration
  const aiProvider = process.env.AI_PROVIDER ?? "groq";
  const hasApiKey =
    aiProvider === "anthropic"
      ? !!process.env.ANTHROPIC_API_KEY
      : !!process.env.GROQ_API_KEY;

  checks.ai = {
    status: hasApiKey ? "ok" : "error",
    detail: hasApiKey ? `${aiProvider} configured` : `${aiProvider} API key missing`,
  };

  const allOk = Object.values(checks).every((c) => c.status === "ok");
  const totalMs = Date.now() - start;

  return Response.json(
    {
      status: allOk ? "healthy" : "degraded",
      checks,
      totalMs,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "unknown",
    },
    { status: allOk ? 200 : 503 },
  );
}
