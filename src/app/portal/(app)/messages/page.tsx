import { getPortalSession } from "@/lib/portal-session";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { PortalMessages } from "@/components/portal/portal-messages";

export const metadata = { title: "Messages" };

export default async function PortalMessagesPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  // Mark provider messages as read
  await db.message.updateMany({
    where: {
      patientId: session.patientId,
      senderType: "PROVIDER",
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  const messages = await db.message.findMany({
    where: { patientId: session.patientId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const patient = await db.patient.findUnique({
    where: { id: session.patientId },
    select: { firstName: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Messages</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Your conversation with your care team
        </p>
      </div>
      <PortalMessages
        messages={messages}
        patientId={session.patientId}
        patientUserId={session.userId}
        patientFirstName={patient?.firstName ?? ""}
      />
    </div>
  );
}
