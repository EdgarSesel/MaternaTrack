import { auth } from "@/lib/auth";
import { getRecentNotifications, markAllRead, markNotificationRead } from "@/lib/notifications";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notifications = await getRecentNotifications(session.user.id, 30);
  const unread = notifications.filter((n: { readAt: Date | null }) => !n.readAt).length;
  return Response.json({ notifications, unread });
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_all_read") }),
  z.object({ action: z.literal("mark_read"), id: z.string().min(1) }),
]);

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  if (parsed.data.action === "mark_all_read") {
    await markAllRead(session.user.id);
  } else {
    await markNotificationRead(parsed.data.id, session.user.id);
  }

  return Response.json({ success: true });
}
