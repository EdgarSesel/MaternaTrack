"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MorningBriefing, BriefingItem } from "@/lib/briefing";
import {
  AlertTriangle,
  MessageSquare,
  Calendar,
  ClipboardList,
  FileText,
  Phone,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Sunrise,
} from "lucide-react";

const TYPE_CONFIG: Record<
  BriefingItem["type"],
  { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }
> = {
  risk_escalation: { icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-50" },
  unread_messages: { icon: MessageSquare, color: "text-teal-600", bgColor: "bg-teal-50" },
  overdue_task: { icon: ClipboardList, color: "text-orange-600", bgColor: "bg-orange-50" },
  no_contact: { icon: Phone, color: "text-purple-600", bgColor: "bg-purple-50" },
  overdue_screening: { icon: FileText, color: "text-blue-600", bgColor: "bg-blue-50" },
  upcoming_appointment: { icon: Calendar, color: "text-indigo-600", bgColor: "bg-indigo-50" },
  task_due_today: { icon: CheckSquare, color: "text-slate-600", bgColor: "bg-slate-50" },
};

const PRIORITY_BADGE: Record<BriefingItem["priority"], string> = {
  urgent: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  high: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  normal: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
};

interface Props {
  briefing: MorningBriefing;
}

export function MorningBriefingPanel({ briefing }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const { items, summary } = briefing;
  const urgentItems = items.filter((i) => i.priority === "urgent");
  const otherItems = items.filter((i) => i.priority !== "urgent");
  const displayItems = showAll ? items : items.slice(0, 6);
  const hasMore = items.length > 6;

  if (items.length === 0) {
    return (
      <Card className="border-green-200 dark:border-green-900/40">
        <CardContent className="p-4 flex items-center gap-3">
          <Sunrise className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-300">All caught up!</p>
            <p className="text-xs text-green-600 dark:text-green-500">No urgent actions needed. Great work keeping up with your panel.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sunrise className="w-4 h-4 text-amber-500" />
            <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Today&apos;s Priorities
            </CardTitle>
            <div className="flex items-center gap-1.5 ml-1">
              {summary.urgent > 0 && (
                <span className="text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded-full border border-red-200 dark:border-red-800">
                  {summary.urgent} urgent
                </span>
              )}
              {summary.high > 0 && (
                <span className="text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded-full">
                  {summary.high} high
                </span>
              )}
              {summary.normal > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {summary.normal} routine
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="space-y-1.5">
            {displayItems.map((item) => {
              const cfg = TYPE_CONFIG[item.type];
              const Icon = cfg.icon;
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 rounded-lg p-2.5 border ${
                    item.priority === "urgent"
                      ? "border-red-100 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10"
                      : item.priority === "high"
                      ? "border-orange-100 dark:border-orange-900/50 bg-orange-50/30 dark:bg-orange-900/10"
                      : "border-slate-100 dark:border-slate-700"
                  }`}
                >
                  <div className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${cfg.bgColor}`}>
                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.patientName}
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug mt-0.5">
                          {item.title}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                          {item.subtitle}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.priority !== "normal" && (
                          <Badge
                            className={`text-xs px-1.5 py-0 h-5 border capitalize ${PRIORITY_BADGE[item.priority]}`}
                          >
                            {item.priority}
                          </Badge>
                        )}
                        <Button asChild size="sm" variant="ghost" className="h-6 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 px-2">
                          <Link href={item.actionHref}>{item.actionLabel} →</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="w-full text-center text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 py-1.5 border border-dashed border-slate-200 dark:border-slate-700 rounded-md mt-1 transition-colors"
              >
                {showAll ? "Show less" : `Show ${items.length - 6} more items`}
              </button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
