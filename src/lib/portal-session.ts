/**
 * Helper to get the current portal (patient) session.
 * Returns the patientId from the JWT, or null if not authenticated.
 */
import { portalAuth } from "@/lib/portal-auth";

export async function getPortalSession() {
  const session = await portalAuth();
  if (!session?.user?.id) return null;
  const patientId = (session.user as { patientId?: string }).patientId;
  if (!patientId) return null;
  return { userId: session.user.id, patientId, name: session.user.name ?? "" };
}

export async function requirePortalSession() {
  const session = await getPortalSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}
