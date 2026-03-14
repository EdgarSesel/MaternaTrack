import { getPortalSession } from "@/lib/portal-session";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isPast } from "date-fns";
import { CheckCircle, Clock, AlertCircle } from "lucide-react";

export const metadata = { title: "Care Plan" };

const STATUS_ICONS = {
  COMPLETED: CheckCircle,
  PENDING: Clock,
  OVERDUE: AlertCircle,
  SNOOZED: Clock,
  NOT_APPLICABLE: CheckCircle,
};

const STATUS_COLORS = {
  COMPLETED: "text-green-600",
  PENDING: "text-amber-600",
  OVERDUE: "text-red-600",
  SNOOZED: "text-slate-400",
  NOT_APPLICABLE: "text-slate-400",
};

const PROTOCOL_LABELS: Record<string, string> = {
  standard_prenatal: "Standard Prenatal Care",
  preeclampsia_prevention: "Preeclampsia Prevention",
  gdm_management: "Gestational Diabetes Management",
  perinatal_depression: "Perinatal Depression Support",
};

export default async function PortalCarePlanPage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");

  const carePlans = await db.carePlan.findMany({
    where: { patientId: session.patientId, deletedAt: null, status: "active" },
    include: {
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      },
    },
  });

  const allTasks = await db.careTask.findMany({
    where: {
      patientId: session.patientId,
      deletedAt: null,
      carePlanId: null,
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  const totalTasks = carePlans.flatMap((p) => p.tasks).length + allTasks.length;
  const completedTasks = [
    ...carePlans.flatMap((p) => p.tasks),
    ...allTasks,
  ].filter((t) => t.status === "COMPLETED").length;

  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Your Care Plan</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {completedTasks} of {totalTasks} tasks complete ({completionPct}%)
        </p>
      </div>

      {carePlans.length === 0 && allTasks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-slate-400 text-sm">
              No active care plans yet. Your care team will set one up for you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {carePlans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-800">
                    {PROTOCOL_LABELS[plan.protocolType] ?? plan.protocolType}
                  </CardTitle>
                  <Badge variant="outline" className="text-green-700 border-green-300 text-xs">
                    Active
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">
                  Started {format(new Date(plan.activatedAt), "MMMM d, yyyy")}
                </p>
              </CardHeader>
              <CardContent>
                {plan.tasks.length === 0 ? (
                  <p className="text-sm text-slate-400">No tasks in this plan.</p>
                ) : (
                  <div className="space-y-2">
                    {plan.tasks.map((task) => {
                      const Icon = STATUS_ICONS[task.status] ?? Clock;
                      const color = STATUS_COLORS[task.status] ?? "text-slate-500";
                      const overdue = task.status === "PENDING" && isPast(new Date(task.dueDate));
                      return (
                        <div key={task.id} className="flex items-start gap-3 py-1">
                          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${overdue ? "text-red-500" : color}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${task.status === "COMPLETED" || task.status === "NOT_APPLICABLE" ? "line-through text-slate-400" : "text-slate-700"}`}>
                              {task.title}
                            </p>
                            {task.description && task.status !== "COMPLETED" && (
                              <p className="text-xs text-slate-400 mt-0.5">{task.description}</p>
                            )}
                          </div>
                          <span className={`text-xs whitespace-nowrap ${overdue ? "text-red-500" : "text-slate-400"}`}>
                            {task.status === "COMPLETED"
                              ? `Done ${task.completedAt ? format(new Date(task.completedAt), "MMM d") : ""}`
                              : `Due ${format(new Date(task.dueDate), "MMM d")}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {allTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800">Additional Tasks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {allTasks.map((task) => {
                    const Icon = STATUS_ICONS[task.status] ?? Clock;
                    const color = STATUS_COLORS[task.status] ?? "text-slate-500";
                    return (
                      <div key={task.id} className="flex items-center gap-3 py-1">
                        <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                        <p className={`text-sm flex-1 ${task.status === "COMPLETED" ? "line-through text-slate-400" : "text-slate-700"}`}>
                          {task.title}
                        </p>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          {format(new Date(task.dueDate), "MMM d")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
