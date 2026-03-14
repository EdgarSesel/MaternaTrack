"use server";

import { portalSignOut } from "@/lib/portal-auth";

export async function portalSignOutAction() {
  await portalSignOut({ redirectTo: "/portal/login" });
}
