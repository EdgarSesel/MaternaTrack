"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function markOnboarded(): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  await db.provider.update({
    where: { id: session.user.id },
    data: { onboardedAt: new Date() },
  });

  return { success: true };
}
