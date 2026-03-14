"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { ProviderRole } from "@/generated/prisma/client";
import bcrypt from "bcryptjs";

const patientIdSchema = z.object({
  patientId: z.string().min(1),
});

const providerRoles = Object.values(ProviderRole) as [ProviderRole, ...ProviderRole[]];

const createStaffSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(providerRoles),
  password: z.string().min(8).max(100),
});

const updateStaffSchema = z.object({
  providerId: z.string().min(1),
  name: z.string().min(1).max(100),
  role: z.enum(providerRoles),
  password: z.string().min(8).max(100).optional().or(z.literal("")),
});

export async function softDeletePatient(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    requirePermission(session, PERMISSIONS.PATIENT_DELETE);

    const parsed = patientIdSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { patientId } = parsed.data;

    await db.patient.update({
      where: { id: patientId },
      data: { deletedAt: new Date() },
    });

    logAudit({
      actorId: session.user.id,
      action: "patient.soft_delete",
      resource: "Patient",
      resourceId: patientId,
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to delete patient" };
  }
}

export async function restorePatient(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    requirePermission(session, PERMISSIONS.PATIENT_DELETE);

    const parsed = patientIdSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { patientId } = parsed.data;

    await db.patient.update({
      where: { id: patientId },
      data: { deletedAt: null },
    });

    logAudit({
      actorId: session.user.id,
      action: "patient.restore",
      resource: "Patient",
      resourceId: patientId,
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to restore patient" };
  }
}

export async function createStaff(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    requirePermission(session as Parameters<typeof requirePermission>[0], PERMISSIONS.ADMIN_MANAGE_PROVIDERS);

    const parsed = createStaffSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

    const { name, email, role, password } = parsed.data;

    const existing = await db.provider.findUnique({ where: { email }, select: { id: true } });
    if (existing) return { success: false, error: "A staff member with this email already exists" };

    const passwordHash = await bcrypt.hash(password, 12);
    const provider = await db.provider.create({ data: { name, email, role, passwordHash } });

    logAudit({
      actorId: session.user.id,
      action: "admin.staff.create",
      resource: "Provider",
      resourceId: provider.id,
      metadata: { name, email, role },
    });

    revalidatePath("/dashboard/admin/users");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to create staff member" };
  }
}

export async function updateStaff(
  input: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    requirePermission(session as Parameters<typeof requirePermission>[0], PERMISSIONS.ADMIN_MANAGE_PROVIDERS);

    const parsed = updateStaffSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

    const { providerId, name, role, password } = parsed.data;

    const data: { name: string; role: ProviderRole; passwordHash?: string } = { name, role };
    if (password) data.passwordHash = await bcrypt.hash(password, 12);

    await db.provider.update({ where: { id: providerId }, data });

    logAudit({
      actorId: session.user.id,
      action: "admin.staff.update",
      resource: "Provider",
      resourceId: providerId,
      metadata: { name, role, passwordChanged: !!password },
    });

    revalidatePath("/dashboard/admin/users");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to update staff member" };
  }
}
