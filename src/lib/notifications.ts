import { db } from "@/lib/db";
import { sseRegistry } from "@/lib/sse-registry";

export type NotificationType =
  | "new_message"
  | "risk_escalation"
  | "appointment_reminder"
  | "appointment_scheduled"
  | "care_gap"
  | "task_overdue"
  | "no_show_followup"
  | "critical_vital_alert";

interface CreateNotificationParams {
  recipientId: string;
  recipientType: "provider" | "patient";
  type: NotificationType;
  title: string;
  body?: string;
  patientId?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification in the DB and push it to any open SSE connections.
 * Fire-and-forget safe — errors are caught internally.
 */
export function createNotification(params: CreateNotificationParams): void {
  const {
    recipientId,
    recipientType,
    type,
    title,
    body,
    patientId,
    resourceId,
    metadata = {},
  } = params;

  db.notification
    .create({
      data: {
        recipientId,
        recipientType,
        type,
        title,
        body: body ?? null,
        patientId: patientId ?? null,
        resourceId: resourceId ?? null,
        metadata: metadata as Parameters<typeof db.notification.create>[0]["data"]["metadata"],
      },
    })
    .then((notification) => {
      // Push real-time event to any open SSE connections for this recipient
      sseRegistry.push(recipientId, {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body ?? undefined,
        patientId: notification.patientId ?? undefined,
        createdAt: notification.createdAt.toISOString(),
      });
    })
    .catch(() => {
      // Notification failure must never break business logic
    });
}

export async function getUnreadCount(recipientId: string): Promise<number> {
  return db.notification.count({
    where: { recipientId, readAt: null },
  });
}

export async function getRecentNotifications(recipientId: string, limit = 20) {
  return db.notification.findMany({
    where: { recipientId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markNotificationRead(id: string, recipientId: string) {
  await db.notification.updateMany({
    where: { id, recipientId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(recipientId: string) {
  await db.notification.updateMany({
    where: { recipientId, readAt: null },
    data: { readAt: new Date() },
  });
}
