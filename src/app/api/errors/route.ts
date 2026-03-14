/**
 * POST /api/errors
 *
 * Receives client-side error reports from global-error.tsx.
 * Logs them server-side for observability. In production, forward to Sentry
 * or a similar service via SENTRY_DSN env var.
 */

import { logger } from "@/lib/logger";
import { z } from "zod";

const errorSchema = z.object({
  message: z.string().max(500),
  digest: z.string().optional(),
  timestamp: z.string().optional(),
  url: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = errorSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(null, { status: 400 });
    }

    logger.error("Client-side error reported", parsed.data);

    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 400 });
  }
}
