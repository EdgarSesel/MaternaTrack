/**
 * GET /api/cron/overdue-tasks
 *
 * Detects and marks overdue tasks system-wide.
 * Runs on a schedule (e.g. every hour via Vercel Cron or external scheduler).
 *
 * Protected by x-cron-secret header matching CRON_SECRET env var.
 */

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("x-cron-secret") === secret;
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const start = Date.now();

  try {
    const result = await db.careTask.updateMany({
      where: {
        status: "PENDING",
        dueDate: { lt: new Date() },
        deletedAt: null,
      },
      data: { status: "OVERDUE" },
    });

    const durationMs = Date.now() - start;
    logger.info("Cron: overdue-tasks", { marked: result.count, durationMs });

    return Response.json({
      ok: true,
      marked: result.count,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Cron: overdue-tasks failed", { error: String(err) });
    return Response.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
