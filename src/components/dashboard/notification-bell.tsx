"use client";

import { useNotifications } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import { useState } from "react";

const TYPE_ICONS: Record<string, string> = {
  new_message: "💬",
  risk_escalation: "🔴",
  critical_vital_alert: "🚨",
  appointment_reminder: "📅",
  appointment_scheduled: "📅",
  care_gap: "⚠️",
  task_overdue: "⏰",
  no_show_followup: "🚫",
};

const TYPE_COLORS: Record<string, string> = {
  new_message: "border-l-blue-400",
  risk_escalation: "border-l-red-500",
  critical_vital_alert: "border-l-red-600",
  appointment_reminder: "border-l-purple-400",
  appointment_scheduled: "border-l-purple-400",
  care_gap: "border-l-amber-400",
  task_overdue: "border-l-orange-400",
  no_show_followup: "border-l-slate-400",
};

export function NotificationBell() {
  const { notifications, unread, loading, markAllRead, markOneRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  function handleOpen(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) setShowAll(false);
  }

  const unreadItems = notifications.filter((n) => !n.readAt);
  const readItems = notifications.filter((n) => n.readAt);
  const visibleItems = showAll ? notifications : unreadItems;
  const hiddenReadCount = readItems.length;

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative p-2">
          <Bell className="w-4 h-4 text-slate-400" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-85 p-0 shadow-xl" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Notifications
            </h3>
            {unread > 0 && (
              <span className="text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full px-1.5 py-0.5">
                {unread} new
              </span>
            )}
          </div>
          {unreadItems.length > 0 && (
            <button
              onClick={() => markAllRead()}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-105 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : visibleItems.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {showAll ? "No notifications" : "You're all caught up"}
              </p>
              {!showAll && hiddenReadCount > 0 && (
                <button
                  onClick={() => setShowAll(true)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                >
                  View {hiddenReadCount} read notification{hiddenReadCount !== 1 ? "s" : ""}
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {visibleItems.map((n) => {
                const isUnread = !n.readAt;

                const dismissBtn = isUnread ? (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markOneRead(n.id);
                    }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                    aria-label="Dismiss"
                  >
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                ) : null;

                const inner = (
                  <div
                    className={cn(
                      "group flex gap-3 px-4 py-3 border-l-4 transition-colors",
                      TYPE_COLORS[n.type] ?? "border-l-slate-200",
                      isUnread
                        ? "bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800",
                    )}
                  >
                    <span className="text-base shrink-0 mt-0.5 leading-none">
                      {TYPE_ICONS[n.type] ?? "🔔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "text-sm leading-snug",
                          isUnread
                            ? "font-semibold text-slate-900 dark:text-slate-100"
                            : "font-normal text-slate-500 dark:text-slate-400",
                        )}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                        {format(new Date(n.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                    {dismissBtn}
                  </div>
                );

                return n.patientId ? (
                  <Link
                    key={n.id}
                    href={`/dashboard/patients/${n.patientId}`}
                    onClick={() => setOpen(false)}
                  >
                    {inner}
                  </Link>
                ) : (
                  <div key={n.id}>{inner}</div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — toggle read/unread */}
        {!loading && visibleItems.length > 0 && hiddenReadCount > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2.5">
            {!showAll ? (
              <button
                onClick={() => setShowAll(true)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                + {hiddenReadCount} read notification{hiddenReadCount !== 1 ? "s" : ""}
              </button>
            ) : (
              <button
                onClick={() => setShowAll(false)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                Hide read notifications
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
