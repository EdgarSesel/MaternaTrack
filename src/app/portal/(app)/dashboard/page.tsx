import { getPortalSession } from "@/lib/portal-session";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, differenceInWeeks } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PortalEducationalContent } from "@/components/portal/educational-content";
import { getEducationalContent } from "@/lib/educational-content";

export const metadata = { title: "Overview" };

export default async function PortalDashboardPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const patient = await db.patient.findUnique({
    where: { id: session.patientId, deletedAt: null },
    include: {
      careTasks: {
        where: { deletedAt: null, status: { in: ["PENDING", "OVERDUE"] } },
        orderBy: { dueDate: "asc" },
        take: 5,
      },
      appointments: {
        where: {
          scheduledAt: { gte: new Date() },
          status: { in: ["scheduled"] },
        },
        orderBy: { scheduledAt: "asc" },
        take: 3,
        include: { provider: { select: { name: true, role: true } } },
      },
      messages: {
        where: { deletedAt: null, readAt: null, senderType: "PROVIDER" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!patient) redirect("/portal/login");

  const firstName = patient.firstName;
  const dueDate = patient.dueDate;
  const weeksUntilDue = dueDate ? differenceInWeeks(new Date(dueDate), new Date()) : null;
  const ga = patient.gestationalAgeWeeks;
  const unreadCount = patient.messages.length;
  const overdueTasks = patient.careTasks.filter((t) => t.status === "OVERDUE");
  const educationalContent = getEducationalContent(ga, patient.status);

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Hi, {firstName} 👋</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {ga ? `You are ${ga} weeks along.` : "Welcome to your care portal."}
          {dueDate && weeksUntilDue !== null && weeksUntilDue > 0
            ? ` Your due date is ${format(new Date(dueDate), "MMMM d, yyyy")} — ${weeksUntilDue} weeks away.`
            : ""}
        </p>
      </div>

      {/* Alerts */}
      {(unreadCount > 0 || overdueTasks.length > 0) && (
        <div className="space-y-2">
          {unreadCount > 0 && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <p className="text-sm text-blue-800 font-medium">
                You have {unreadCount} unread message{unreadCount > 1 ? "s" : ""} from your care team.
              </p>
              <Button asChild size="sm" variant="outline" className="text-blue-700 border-blue-300 hover:bg-blue-100">
                <Link href="/portal/messages">View</Link>
              </Button>
            </div>
          )}
          {overdueTasks.length > 0 && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              <p className="text-sm text-amber-800 font-medium">
                You have {overdueTasks.length} overdue care task{overdueTasks.length > 1 ? "s" : ""}.
              </p>
              <Button asChild size="sm" variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-100">
                <Link href="/portal/care-plan">View</Link>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Upcoming appointments */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Upcoming Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {patient.appointments.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">No upcoming appointments scheduled.</p>
          ) : (
            <div className="space-y-3">
              {patient.appointments.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {appt.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </p>
                    <p className="text-xs text-slate-500">
                      with {appt.provider.name} · {appt.duration} min
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">
                      {format(new Date(appt.scheduledAt), "MMM d")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(new Date(appt.scheduledAt), "h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending tasks */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-700">Your Care Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          {patient.careTasks.length === 0 ? (
            <p className="text-sm text-slate-400 py-2">All caught up! No pending tasks.</p>
          ) : (
            <div className="space-y-2">
              {patient.careTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between py-1">
                  <p className="text-sm text-slate-700">{task.title}</p>
                  <Badge
                    variant="outline"
                    className={
                      task.status === "OVERDUE"
                        ? "text-red-600 border-red-300"
                        : "text-amber-600 border-amber-300"
                    }
                  >
                    {task.status === "OVERDUE"
                      ? `Overdue (${format(new Date(task.dueDate), "MMM d")})`
                      : `Due ${format(new Date(task.dueDate), "MMM d")}`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Educational content */}
      {educationalContent && (
        <PortalEducationalContent content={educationalContent} />
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/portal/messages"
          className="block bg-white rounded-xl border border-slate-200 px-4 py-4 hover:border-rose-300 hover:shadow-sm transition-all"
        >
          <p className="text-sm font-medium text-slate-800">Messages</p>
          <p className="text-xs text-slate-400 mt-0.5">Talk to your care team</p>
        </Link>
        <Link
          href="/portal/vitals"
          className="block bg-white rounded-xl border border-slate-200 px-4 py-4 hover:border-rose-300 hover:shadow-sm transition-all"
        >
          <p className="text-sm font-medium text-slate-800">Log a Vital</p>
          <p className="text-xs text-slate-400 mt-0.5">Blood pressure, weight, glucose</p>
        </Link>
      </div>
    </div>
  );
}
