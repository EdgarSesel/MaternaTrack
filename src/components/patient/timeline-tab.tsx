"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import type { TimelineEvent } from "@/generated/prisma/client";
import {
  Activity,
  MessageSquare,
  Calendar,
  AlertTriangle,
  CheckCircle,
  FileText,
  TrendingUp,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const EVENT_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    bgClass: string;
  }
> = {
  vital_recorded: {
    label: "Vital Recorded",
    icon: Activity,
    iconClass: "text-blue-600",
    bgClass: "bg-blue-50",
  },
  screening_completed: {
    label: "Screening",
    icon: FileText,
    iconClass: "text-purple-600",
    bgClass: "bg-purple-50",
  },
  message_sent: {
    label: "Message",
    icon: MessageSquare,
    iconClass: "text-teal-600",
    bgClass: "bg-teal-50",
  },
  appointment_scheduled: {
    label: "Appointment",
    icon: Calendar,
    iconClass: "text-indigo-600",
    bgClass: "bg-indigo-50",
  },
  risk_change: {
    label: "Risk Update",
    icon: TrendingUp,
    iconClass: "text-orange-600",
    bgClass: "bg-orange-50",
  },
  care_plan_update: {
    label: "Care Plan",
    icon: FileText,
    iconClass: "text-slate-600",
    bgClass: "bg-slate-100",
  },
  task_completed: {
    label: "Task Done",
    icon: CheckCircle,
    iconClass: "text-green-600",
    bgClass: "bg-green-50",
  },
  escalation: {
    label: "Escalation",
    icon: AlertTriangle,
    iconClass: "text-red-600",
    bgClass: "bg-red-50",
  },
};

const FILTER_TYPES = [
  { value: "all", label: "All" },
  { value: "vital_recorded", label: "Vitals" },
  { value: "screening_completed", label: "Screenings" },
  { value: "message_sent", label: "Messages" },
  { value: "risk_change", label: "Risk" },
  { value: "task_completed", label: "Tasks" },
  { value: "escalation", label: "Escalations" },
];

const TIMELINE_PAGE_SIZE = 20;

export function TimelineTab({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(TIMELINE_PAGE_SIZE);

  const filtered =
    filter === "all"
      ? events
      : events.filter((e) => e.eventType === filter);

  const visible = filtered.slice(0, visibleCount);

  if (events.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg">
        <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-400 text-sm">No timeline events yet.</p>
        <p className="text-slate-400 text-xs mt-1">
          Events will appear here as care activities occur.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
        {FILTER_TYPES.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.value)}
            className={`h-7 text-xs px-2.5 ${filter === f.value ? "bg-rose-600 hover:bg-rose-700" : ""}`}
          >
            {f.label}
          </Button>
        ))}
        <span className="text-xs text-slate-400 ml-1">
          {Math.min(visibleCount, filtered.length)}/{filtered.length} events
        </span>
      </div>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <p className="text-slate-400 text-sm py-8 text-center">
          No {filter.replace("_", " ")} events found.
        </p>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />

          <div className="space-y-3">
            {visible.map((event) => {
              const config =
                EVENT_CONFIG[event.eventType] ?? EVENT_CONFIG.care_plan_update;
              const Icon = config.icon;

              return (
                <div key={event.id} className="flex gap-4 relative">
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center z-10 ${config.bgClass}`}
                  >
                    <Icon className={`w-4 h-4 ${config.iconClass}`} />
                  </div>
                  <div className="flex-1 bg-white border border-slate-200 rounded-lg p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {event.title}
                        </p>
                        {event.description && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {event.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-slate-400">
                          {formatDistanceToNow(new Date(event.createdAt), {
                            addSuffix: true,
                          })}
                        </p>
                        <p className="text-xs text-slate-400">
                          {format(new Date(event.createdAt), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {visibleCount < filtered.length && (
            <div className="flex justify-center pt-2 pl-14">
              <button
                onClick={() => setVisibleCount((n) => n + TIMELINE_PAGE_SIZE)}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium py-2 px-4 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Load {Math.min(TIMELINE_PAGE_SIZE, filtered.length - visibleCount)} more events
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
