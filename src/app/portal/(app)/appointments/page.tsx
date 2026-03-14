import { getPortalSession } from "@/lib/portal-session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AppointmentsClient } from "@/components/portal/appointments-client";

export const metadata = { title: "My Appointments" };

export default async function PortalAppointmentsPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const appointments = await db.appointment.findMany({
    where: { patientId: session.patientId },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      type: true,
      scheduledAt: true,
      duration: true,
      status: true,
      notes: true,
      seriesId: true,
    },
  });

  return <AppointmentsClient appointments={appointments} />;
}
