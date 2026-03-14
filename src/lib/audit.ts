import { db } from "@/lib/db";

interface AuditParams {
  actorId: string;
  actorType?: "provider" | "patient" | "system";
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event. Fire-and-forget — does not block the caller.
 * Failures are silently caught to avoid disrupting business logic.
 */
export function logAudit(params: AuditParams): void {
  const {
    actorId,
    actorType = "provider",
    action,
    resource,
    resourceId,
    metadata = {},
    ipAddress,
    userAgent,
  } = params;

  // Fire and forget — don't await
  db.auditLog
    .create({
      data: {
        actorId,
        actorType,
        action,
        resource,
        resourceId: resourceId ?? null,
        metadata: metadata as Parameters<typeof db.auditLog.create>[0]["data"]["metadata"],
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
      },
    })
    .catch(() => {
      // Silently fail — audit logging should never break business logic
    });
}
