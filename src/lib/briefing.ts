// Morning Briefing — computes prioritized action items from DB state
// Called server-side on dashboard load

import { db } from "@/lib/db";
import { differenceInDays, startOfDay, endOfDay, addDays } from "date-fns";
import { RiskLevel, TaskStatus } from "@/generated/prisma/client";

export type BriefingItem = {
  id: string;
  type:
    | "risk_escalation"
    | "overdue_task"
    | "overdue_screening"
    | "no_contact"
    | "upcoming_appointment"
    | "unread_messages"
    | "task_due_today";
  priority: "urgent" | "high" | "normal";
  patientId: string;
  patientName: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  actionHref: string;
};

export type MorningBriefing = {
  generatedAt: Date;
  items: BriefingItem[];
  summary: {
    urgent: number;
    high: number;
    normal: number;
    totalPatients: number;
  };
};

export async function computeMorningBriefing(
  providerFilter: { providerId?: string }
): Promise<MorningBriefing> {
  const patientWhere = { ...providerFilter, deletedAt: null };
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowEnd = endOfDay(addDays(now, 1));

  const [
    escalatedPatients,
    overdueTaskPatients,
    noContactPatients,
    screeningDuePatients,
    todayAppts,
    unreadMessagePatients,
    tasksDueToday,
  ] = await Promise.all([
    // Risk escalation: VERY_HIGH risk patients
    db.patient.findMany({
      where: { ...patientWhere, riskLevel: RiskLevel.VERY_HIGH },
      select: { id: true, firstName: true, lastName: true, riskScore: true, riskLevel: true },
      orderBy: { riskScore: "desc" },
      take: 5,
    }),

    // Patients with overdue tasks
    db.patient.findMany({
      where: {
        ...patientWhere,
        careTasks: {
          some: { status: TaskStatus.OVERDUE, deletedAt: null },
        },
      },
      include: {
        _count: { select: { careTasks: { where: { status: TaskStatus.OVERDUE, deletedAt: null } } } },
      },
      orderBy: { riskScore: "desc" },
      take: 8,
    }),

    // No contact in 10+ days
    db.patient.findMany({
      where: {
        ...patientWhere,
        status: { in: ["PREGNANT", "POSTPARTUM"] },
        OR: [
          { lastContactAt: null },
          { lastContactAt: { lt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, lastContactAt: true, riskLevel: true },
      orderBy: { riskScore: "desc" },
      take: 5,
    }),

    // Screenings overdue (depression screen required every 8 weeks; SDOH each trimester)
    // Patients with status PREGNANT and no screening in 60 days
    db.patient.findMany({
      where: {
        ...patientWhere,
        status: "PREGNANT",
        OR: [
          { screenings: { none: {} } },
          {
            screenings: {
              none: {
                administeredAt: { gte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        riskLevel: true,
        gestationalAgeWeeks: true,
        screenings: { orderBy: { administeredAt: "desc" }, take: 1 },
      },
      take: 5,
    }),

    // Today's appointments (upcoming)
    db.appointment.findMany({
      where: {
        ...providerFilter,
        scheduledAt: { gte: todayStart, lte: todayEnd },
        status: "scheduled",
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, riskLevel: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }),

    // Unread patient messages
    db.patient.findMany({
      where: {
        ...patientWhere,
        messages: {
          some: { senderType: "PATIENT", readAt: null, deletedAt: null },
        },
      },
      include: {
        _count: {
          select: { messages: { where: { senderType: "PATIENT", readAt: null, deletedAt: null } } },
        },
      },
      orderBy: { riskScore: "desc" },
      take: 8,
    }),

    // Tasks due today
    db.careTask.findMany({
      where: {
        deletedAt: null,
        patient: patientWhere,
        status: TaskStatus.PENDING,
        dueDate: { gte: todayStart, lte: tomorrowEnd },
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, riskLevel: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
  ]);

  const items: BriefingItem[] = [];

  // Risk escalations (urgent)
  for (const p of escalatedPatients) {
    items.push({
      id: `risk-${p.id}`,
      type: "risk_escalation",
      priority: "urgent",
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
      title: "Very high risk — immediate attention needed",
      subtitle: `Risk score: ${p.riskScore}/100`,
      actionLabel: "Review patient",
      actionHref: `/dashboard/patients/${p.id}`,
    });
  }

  // Unread messages (high — patient is trying to reach you)
  for (const p of unreadMessagePatients) {
    const count = p._count.messages;
    items.push({
      id: `msg-${p.id}`,
      type: "unread_messages",
      priority: p.riskLevel === "VERY_HIGH" || p.riskLevel === "HIGH" ? "urgent" : "high",
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
      title: `${count} unread message${count > 1 ? "s" : ""} from patient`,
      subtitle: "Patient has sent a message that hasn't been read",
      actionLabel: "Read messages",
      actionHref: `/dashboard/patients/${p.id}?tab=messages`,
    });
  }

  // Overdue tasks (high for high-risk patients, normal for others)
  for (const p of overdueTaskPatients) {
    const count = p._count.careTasks;
    items.push({
      id: `task-${p.id}`,
      type: "overdue_task",
      priority:
        p.riskLevel === "VERY_HIGH" || p.riskLevel === "HIGH" ? "high" : "normal",
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
      title: `${count} overdue care task${count > 1 ? "s" : ""}`,
      subtitle: `Review and complete outstanding care plan items`,
      actionLabel: "View care plan",
      actionHref: `/dashboard/patients/${p.id}?tab=careplan`,
    });
  }

  // No contact (high priority after 14 days, normal after 10)
  for (const p of noContactPatients) {
    const daysSince = p.lastContactAt
      ? differenceInDays(now, new Date(p.lastContactAt))
      : 999;
    items.push({
      id: `contact-${p.id}`,
      type: "no_contact",
      priority: daysSince > 14 ? "high" : "normal",
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
      title: `No contact in ${daysSince === 999 ? "30+" : daysSince} days`,
      subtitle: "Patient may need outreach or is disengaged",
      actionLabel: "Send message",
      actionHref: `/dashboard/patients/${p.id}?tab=messages`,
    });
  }

  // Overdue screenings (normal)
  for (const p of screeningDuePatients) {
    const lastScreen = p.screenings[0];
    const daysSince = lastScreen
      ? differenceInDays(now, new Date(lastScreen.administeredAt))
      : null;
    items.push({
      id: `screen-${p.id}`,
      type: "overdue_screening",
      priority: "normal",
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`,
      title: daysSince === null ? "No screenings on record" : `Last screened ${daysSince} days ago`,
      subtitle: "Depression + anxiety screening recommended every 8 weeks (ACOG)",
      actionLabel: "Administer screening",
      actionHref: `/dashboard/patients/${p.id}`,
    });
  }

  // Today's tasks due
  for (const task of tasksDueToday) {
    items.push({
      id: `taskdue-${task.id}`,
      type: "task_due_today",
      priority: task.priority === "urgent" ? "urgent" : task.priority === "high" ? "high" : "normal",
      patientId: task.patient.id,
      patientName: `${task.patient.firstName} ${task.patient.lastName}`,
      title: task.title,
      subtitle: "Due today",
      actionLabel: "View care plan",
      actionHref: `/dashboard/patients/${task.patient.id}?tab=careplan`,
    });
  }

  // Today's appointments (normal, informational)
  for (const appt of todayAppts) {
    const apptTime = new Date(appt.scheduledAt).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    items.push({
      id: `appt-${appt.id}`,
      type: "upcoming_appointment",
      priority: "normal",
      patientId: appt.patient.id,
      patientName: `${appt.patient.firstName} ${appt.patient.lastName}`,
      title: `${appt.type.replace(/_/g, " ")} at ${apptTime}`,
      subtitle: `${appt.duration} min · Check patient overview before visit`,
      actionLabel: "Prepare for visit",
      actionHref: `/dashboard/patients/${appt.patient.id}`,
    });
  }

  // Deduplicate by patientId + type (keep highest priority)
  const seen = new Map<string, BriefingItem>();
  for (const item of items) {
    const key = `${item.type}-${item.patientId}`;
    const existing = seen.get(key);
    if (!existing || priorityRank(item.priority) > priorityRank(existing.priority)) {
      seen.set(key, item);
    }
  }

  const deduped = Array.from(seen.values()).sort(
    (a, b) => priorityRank(b.priority) - priorityRank(a.priority)
  );

  const urgent = deduped.filter((i) => i.priority === "urgent").length;
  const high = deduped.filter((i) => i.priority === "high").length;
  const normal = deduped.filter((i) => i.priority === "normal").length;

  return {
    generatedAt: now,
    items: deduped.slice(0, 20), // cap at 20 items
    summary: {
      urgent,
      high,
      normal,
      totalPatients: escalatedPatients.length + overdueTaskPatients.length,
    },
  };
}

function priorityRank(p: BriefingItem["priority"]): number {
  return p === "urgent" ? 3 : p === "high" ? 2 : 1;
}
