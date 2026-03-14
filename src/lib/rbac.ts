import type { ProviderRole } from "@/generated/prisma/client";

/**
 * Permission-based RBAC system for MaternaTrack.
 * Each ProviderRole maps to a set of permissions.
 * ADMIN gets all permissions plus cross-provider access.
 */

export const PERMISSIONS = {
  // Patient data
  PATIENT_READ: "patient:read",
  PATIENT_WRITE: "patient:write",
  PATIENT_DELETE: "patient:delete",

  // Care tasks
  TASK_COMPLETE: "task:complete",
  TASK_SNOOZE: "task:snooze",

  // Protocols
  PROTOCOL_ACTIVATE: "protocol:activate",
  PROTOCOL_DEACTIVATE: "protocol:deactivate",

  // Messaging
  MESSAGE_SEND: "message:send",

  // AI features
  AI_RISK_SUMMARY: "ai:risk_summary",
  AI_CARE_GAPS: "ai:care_gaps",
  AI_MESSAGE_DRAFT: "ai:message_draft",
  AI_PANEL_SUMMARY: "ai:panel_summary",

  // Appointments
  APPOINTMENT_CREATE: "appointment:create",
  APPOINTMENT_UPDATE: "appointment:update",
  APPOINTMENT_VIEW: "appointment:view",

  // Analytics
  ANALYTICS_VIEW: "analytics:view",

  // Admin
  ADMIN_MANAGE_PROVIDERS: "admin:manage_providers",
  ADMIN_VIEW_ALL_PATIENTS: "admin:view_all_patients",
  ADMIN_VIEW_AUDIT_LOG: "admin:view_audit_log",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<ProviderRole, Permission[]> = {
  NURSE: [
    PERMISSIONS.PATIENT_READ,
    PERMISSIONS.PATIENT_WRITE,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.TASK_SNOOZE,
    PERMISSIONS.PROTOCOL_ACTIVATE,
    PERMISSIONS.PROTOCOL_DEACTIVATE,
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.APPOINTMENT_CREATE,
    PERMISSIONS.APPOINTMENT_UPDATE,
    PERMISSIONS.APPOINTMENT_VIEW,
    PERMISSIONS.AI_RISK_SUMMARY,
    PERMISSIONS.AI_CARE_GAPS,
    PERMISSIONS.AI_MESSAGE_DRAFT,
    PERMISSIONS.AI_PANEL_SUMMARY,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  MIDWIFE: [
    PERMISSIONS.PATIENT_READ,
    PERMISSIONS.PATIENT_WRITE,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.TASK_SNOOZE,
    PERMISSIONS.PROTOCOL_ACTIVATE,
    PERMISSIONS.PROTOCOL_DEACTIVATE,
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.APPOINTMENT_CREATE,
    PERMISSIONS.APPOINTMENT_UPDATE,
    PERMISSIONS.APPOINTMENT_VIEW,
    PERMISSIONS.AI_RISK_SUMMARY,
    PERMISSIONS.AI_CARE_GAPS,
    PERMISSIONS.AI_MESSAGE_DRAFT,
    PERMISSIONS.AI_PANEL_SUMMARY,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  OBGYN: [
    PERMISSIONS.PATIENT_READ,
    PERMISSIONS.PATIENT_WRITE,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.TASK_SNOOZE,
    PERMISSIONS.PROTOCOL_ACTIVATE,
    PERMISSIONS.PROTOCOL_DEACTIVATE,
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.APPOINTMENT_CREATE,
    PERMISSIONS.APPOINTMENT_UPDATE,
    PERMISSIONS.APPOINTMENT_VIEW,
    PERMISSIONS.AI_RISK_SUMMARY,
    PERMISSIONS.AI_CARE_GAPS,
    PERMISSIONS.AI_MESSAGE_DRAFT,
    PERMISSIONS.AI_PANEL_SUMMARY,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  DIETITIAN: [
    PERMISSIONS.PATIENT_READ,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.TASK_SNOOZE,
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.APPOINTMENT_VIEW,
    PERMISSIONS.AI_RISK_SUMMARY,
    PERMISSIONS.AI_MESSAGE_DRAFT,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  THERAPIST: [
    PERMISSIONS.PATIENT_READ,
    PERMISSIONS.TASK_COMPLETE,
    PERMISSIONS.TASK_SNOOZE,
    PERMISSIONS.MESSAGE_SEND,
    PERMISSIONS.APPOINTMENT_VIEW,
    PERMISSIONS.AI_RISK_SUMMARY,
    PERMISSIONS.AI_MESSAGE_DRAFT,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  ADMIN: Object.values(PERMISSIONS),
};

export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export function hasPermission(session: AuthSession, permission: Permission): boolean {
  const role = session.user.role as ProviderRole;
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function requirePermission(session: AuthSession, permission: Permission): void {
  if (!hasPermission(session, permission)) {
    throw new Error(`Forbidden: missing permission ${permission}`);
  }
}

export function isAdmin(session: AuthSession): boolean {
  return session.user.role === "ADMIN";
}

/**
 * Returns the providerId filter for database queries.
 * ADMIN sees all patients (returns undefined).
 * Other roles see only their own patients.
 */
export function getProviderScope(session: AuthSession): string | undefined {
  if (isAdmin(session)) return undefined;
  return session.user.id;
}
