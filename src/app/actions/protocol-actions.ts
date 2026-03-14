"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  PROTOCOL_TYPES,
  generateProtocolTasks,
  type ProtocolType,
} from "@/lib/protocols";
import { requirePermission, PERMISSIONS, isAdmin } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

const activateProtocolSchema = z.object({
  patientId: z.string().min(1),
  protocolType: z.enum(PROTOCOL_TYPES),
});

export async function activateProtocol(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    requirePermission(session, PERMISSIONS.PROTOCOL_ACTIVATE);

    const parsed = activateProtocolSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { patientId, protocolType } = parsed.data;

    // Verify ownership (admin can access any patient)
    const ownerWhere = isAdmin(session)
      ? { id: patientId, deletedAt: null }
      : { id: patientId, providerId: session.user.id, deletedAt: null };
    const patient = await db.patient.findFirst({
      where: ownerWhere,
      select: { id: true },
    });
    if (!patient) return { success: false, error: "Patient not found" };

    // Prevent duplicate active protocols
    const existing = await db.carePlan.findFirst({
      where: { patientId, protocolType, status: "active" },
    });
    if (existing) {
      return { success: false, error: "This protocol is already active for this patient" };
    }

    const now = new Date();

    // Create the care plan and its tasks in a transaction
    await db.$transaction(async (tx) => {
      const carePlan = await tx.carePlan.create({
        data: {
          patientId,
          protocolType,
          status: "active",
          activatedAt: now,
        },
      });

      const taskData = generateProtocolTasks(
        protocolType as ProtocolType,
        patientId,
        carePlan.id,
        now,
      );

      await tx.careTask.createMany({ data: taskData });

      await tx.timelineEvent.create({
        data: {
          patientId,
          eventType: "care_plan_update",
          title: `Care protocol activated`,
          description: `${protocolType.replace(/_/g, " ")} protocol started`,
          metadata: { protocolType, carePlanId: carePlan.id },
        },
      });
    });

    logAudit({ actorId: session.user.id, action: "protocol.activate", resource: "CarePlan", metadata: { patientId, protocolType } });

    revalidatePath(`/dashboard/patients/${patientId}`);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to activate protocol" };
  }
}

export async function deactivateProtocol(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };
    requirePermission(session, PERMISSIONS.PROTOCOL_DEACTIVATE);

    const parsed = z
      .object({ patientId: z.string().min(1), carePlanId: z.string().min(1) })
      .safeParse(input);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const { patientId, carePlanId } = parsed.data;

    // Verify ownership (admin can access any patient)
    const ownerFilter = isAdmin(session)
      ? {}
      : { patient: { providerId: session.user.id } };
    const plan = await db.carePlan.findFirst({
      where: { id: carePlanId, patientId, ...ownerFilter },
    });
    if (!plan) return { success: false, error: "Care plan not found" };

    await db.carePlan.update({
      where: { id: carePlanId },
      data: { status: "discontinued", completedAt: new Date() },
    });

    logAudit({ actorId: session.user.id, action: "protocol.deactivate", resource: "CarePlan", resourceId: carePlanId, metadata: { patientId } });

    revalidatePath(`/dashboard/patients/${patientId}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Forbidden")) return { success: false, error: msg };
    return { success: false, error: "Failed to deactivate protocol" };
  }
}
