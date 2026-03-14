"use client";

import { useState, useTransition } from "react";
import { format, isPast } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  completeTask,
  snoozeTask,
  markTaskNotApplicable,
  bulkCompleteTasks,
  bulkMarkTasksNotApplicable,
} from "@/app/actions/patient-actions";
import type { CareTask, CarePlan } from "@/generated/prisma/client";
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Minus,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Square,
  CheckSquare,
  Loader2,
} from "lucide-react";
import { AiCareGaps } from "@/components/ai/ai-care-gaps";
import { ActivateProtocolDialog } from "@/components/patient/activate-protocol-dialog";
import { AddTaskDialog } from "@/components/patient/add-task-dialog";

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: {
    label: "Pending",
    badgeClass: "bg-slate-100 text-slate-600",
    icon: Clock,
  },
  OVERDUE: {
    label: "Overdue",
    badgeClass: "bg-red-100 text-red-700",
    icon: AlertCircle,
  },
  COMPLETED: {
    label: "Completed",
    badgeClass: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  SNOOZED: {
    label: "Snoozed",
    badgeClass: "bg-yellow-100 text-yellow-700",
    icon: Clock,
  },
  NOT_APPLICABLE: {
    label: "N/A",
    badgeClass: "bg-slate-100 text-slate-400",
    icon: Minus,
  },
};

const PRIORITY_CLASSES: Record<string, string> = {
  urgent: "border-l-4 border-l-red-500",
  high: "border-l-4 border-l-orange-400",
  normal: "",
  low: "",
};

const SNOOZE_OPTIONS = [
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
];

interface SnoozeDialogProps {
  taskId: string;
  patientId: string;
  open: boolean;
  onClose: () => void;
}

function SnoozeDialog({ taskId, patientId, open, onClose }: SnoozeDialogProps) {
  const [reason, setReason] = useState("");
  const [selectedDays, setSelectedDays] = useState(3);
  const [isPending, startTransition] = useTransition();

  function handleSnooze() {
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + selectedDays);

    startTransition(async () => {
      const result = await snoozeTask({
        taskId,
        patientId,
        snoozeUntil: snoozeUntil.toISOString(),
        snoozeReason: reason || undefined,
      });
      if (result.success) {
        toast.success("Task snoozed");
        onClose();
      } else {
        toast.error(result.error ?? "Failed to snooze task");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Snooze Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-slate-600 mb-2 block">
              Snooze for
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {SNOOZE_OPTIONS.map((opt) => (
                <Button
                  key={opt.days}
                  variant={selectedDays === opt.days ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDays(opt.days)}
                  className={selectedDays === opt.days ? "bg-rose-600 hover:bg-rose-700" : ""}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs text-slate-600">
              Reason (optional)
            </Label>
            <Input
              id="reason"
              placeholder="Patient traveling, will follow up..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSnooze}
            disabled={isPending}
            className="bg-rose-600 hover:bg-rose-700"
          >
            {isPending ? "Snoozing…" : "Snooze"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TaskItemProps {
  task: CareTask;
  patientId: string;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

function TaskItem({ task, patientId, selected = false, onToggleSelect }: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const config = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.PENDING;
  const StatusIcon = config.icon;
  const isActive = task.status === "PENDING" || task.status === "OVERDUE";
  const isOverdue = task.status === "OVERDUE" || (task.status === "PENDING" && isPast(new Date(task.dueDate)));

  function handleComplete() {
    startTransition(async () => {
      const result = await completeTask({ taskId: task.id, patientId });
      if (result.success) {
        toast.success("Task completed");
      } else {
        toast.error(result.error ?? "Failed to complete task");
      }
    });
  }

  function handleMarkNA() {
    startTransition(async () => {
      const result = await markTaskNotApplicable({ taskId: task.id, patientId });
      if (result.success) {
        toast.info("Task marked as N/A");
      } else {
        toast.error(result.error ?? "Failed to update task");
      }
    });
  }

  return (
    <>
      <div
        className={`bg-white border rounded-lg p-3 transition-colors ${PRIORITY_CLASSES[task.priority] ?? ""} ${
          !isActive ? "opacity-60" : ""
        } ${selected ? "border-rose-300 bg-rose-50/30" : "border-slate-200"}`}
      >
        <div className="flex items-start gap-3">
          {isActive && onToggleSelect && (
            <button
              type="button"
              onClick={() => onToggleSelect(task.id)}
              className="mt-0.5 shrink-0 text-slate-400 hover:text-rose-600 transition-colors"
              aria-label={selected ? "Deselect task" : "Select task"}
            >
              {selected ? (
                <CheckSquare className="w-4 h-4 text-rose-600" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
          )}
          <StatusIcon
            className={`w-4 h-4 mt-0.5 shrink-0 ${
              task.status === "OVERDUE" || isOverdue
                ? "text-red-500"
                : task.status === "COMPLETED"
                ? "text-green-500"
                : task.status === "SNOOZED"
                ? "text-yellow-500"
                : "text-slate-400"
            }`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-slate-800 leading-snug">
                {task.title}
              </p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {task.priority === "urgent" && (
                  <span className="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                    Urgent
                  </span>
                )}
                {task.priority === "high" && (
                  <span className="text-xs font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                    High
                  </span>
                )}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded font-medium ${config.badgeClass}`}
                >
                  {config.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-1">
              <span
                className={`text-xs ${
                  isOverdue ? "text-red-500 font-medium" : "text-slate-400"
                }`}
              >
                {isOverdue ? "Overdue — " : "Due "}
                {format(new Date(task.dueDate), "MMM d, yyyy")}
              </span>
              {task.snoozeUntil && task.status === "SNOOZED" && (
                <span className="text-xs text-yellow-600">
                  Until {format(new Date(task.snoozeUntil), "MMM d")}
                </span>
              )}
            </div>

            {task.description && (
              <div>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mt-1"
                >
                  {expanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                  {expanded ? "Less" : "Details"}
                </button>
                {expanded && (
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {task.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions for active tasks */}
        {isActive && (
          <div className={`flex gap-2 mt-3 ${onToggleSelect ? "pl-11" : "pl-7"}`}>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
              onClick={handleComplete}
              disabled={isPending}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Complete
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setSnoozeOpen(true)}
              disabled={isPending}
            >
              <Clock className="w-3 h-3 mr-1" />
              Snooze
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-slate-400"
              onClick={handleMarkNA}
              disabled={isPending}
            >
              <Minus className="w-3 h-3 mr-1" />
              N/A
            </Button>
          </div>
        )}
      </div>

      <SnoozeDialog
        taskId={task.id}
        patientId={patientId}
        open={snoozeOpen}
        onClose={() => setSnoozeOpen(false)}
      />
    </>
  );
}

interface Props {
  tasks: CareTask[];
  carePlans: (CarePlan & { tasks: CareTask[] })[];
  patientId: string;
}


const PROTOCOL_LABELS: Record<string, string> = {
  standard_prenatal: "Standard Prenatal Protocol",
  preeclampsia_prevention: "Preeclampsia Prevention",
  gdm_management: "GDM Management",
  perinatal_depression: "Perinatal Depression",
};

export function CarePlanTab({ tasks, carePlans, patientId }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();

  const overdue = tasks.filter(
    (t) => t.status === "OVERDUE" || (t.status === "PENDING" && isPast(new Date(t.dueDate)))
  );
  const pending = tasks.filter(
    (t) => t.status === "PENDING" && !isPast(new Date(t.dueDate))
  );
  const snoozed = tasks.filter((t) => t.status === "SNOOZED");
  const done = tasks.filter(
    (t) => t.status === "COMPLETED" || t.status === "NOT_APPLICABLE"
  );

  const activeTasks = [...overdue, ...pending];

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === activeTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeTasks.map((t) => t.id)));
    }
  }

  function handleBulkComplete() {
    startBulkTransition(async () => {
      const result = await bulkCompleteTasks({ taskIds: [...selectedIds], patientId });
      if (result.success) {
        toast.success(`${result.updatedCount} task${result.updatedCount !== 1 ? "s" : ""} completed`);
        setSelectedIds(new Set());
      } else {
        toast.error(result.error ?? "Bulk complete failed");
      }
    });
  }

  function handleBulkMarkNA() {
    startBulkTransition(async () => {
      const result = await bulkMarkTasksNotApplicable({ taskIds: [...selectedIds], patientId });
      if (result.success) {
        toast.info(`${result.updatedCount} task${result.updatedCount !== 1 ? "s" : ""} marked N/A`);
        setSelectedIds(new Set());
      } else {
        toast.error(result.error ?? "Bulk update failed");
      }
    });
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-slate-200 rounded-lg space-y-3">
        <ClipboardList className="w-8 h-8 text-slate-300 mx-auto" />
        <div>
          <p className="text-slate-400 text-sm">No care tasks assigned.</p>
          <p className="text-slate-400 text-xs mt-1">
            Activate a protocol below to generate tasks automatically.
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <ActivateProtocolDialog
            patientId={patientId}
            activeProtocolTypes={carePlans.map((p) => p.protocolType)}
          />
          <AddTaskDialog patientId={patientId} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Active protocols summary + Add Protocol button */}
      <div className="flex items-center gap-2 flex-wrap">
        {carePlans.length > 0 && (
          <>
            <span className="text-xs text-slate-500">Active protocols:</span>
            {carePlans.map((plan) => (
              <Badge key={plan.id} variant="secondary" className="text-xs">
                {PROTOCOL_LABELS[plan.protocolType] ?? plan.protocolType}
              </Badge>
            ))}
          </>
        )}
        <ActivateProtocolDialog
          patientId={patientId}
          activeProtocolTypes={carePlans.map((p) => p.protocolType)}
        />
        <AddTaskDialog patientId={patientId} />
      </div>

      {/* AI Care Gap Analysis */}
      <AiCareGaps patientId={patientId} />

      {/* Bulk actions toolbar */}
      {activeTasks.length > 0 && (
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 transition-colors"
          >
            {selectedIds.size === activeTasks.length && activeTasks.length > 0 ? (
              <CheckSquare className="w-3.5 h-3.5 text-rose-600" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
            {selectedIds.size === 0
              ? "Select all"
              : selectedIds.size === activeTasks.length
              ? "Deselect all"
              : `${selectedIds.size} selected`}
          </button>

          {selectedIds.size > 0 && (
            <>
              <div className="w-px h-4 bg-slate-200" />
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                onClick={handleBulkComplete}
                disabled={isBulkPending}
              >
                {isBulkPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <CheckCircle className="w-3 h-3 mr-1" />
                )}
                Complete ({selectedIds.size})
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-slate-500"
                onClick={handleBulkMarkNA}
                disabled={isBulkPending}
              >
                <Minus className="w-3 h-3 mr-1" />
                Mark N/A ({selectedIds.size})
              </Button>
            </>
          )}
        </div>
      )}

      {/* Overdue tasks */}
      {overdue.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Overdue ({overdue.length})
          </h3>
          <div className="space-y-2">
            {overdue.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                patientId={patientId}
                selected={selectedIds.has(t.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        </section>
      )}

      {/* Upcoming tasks */}
      {pending.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Upcoming ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map((t) => (
              <TaskItem
                key={t.id}
                task={t}
                patientId={patientId}
                selected={selectedIds.has(t.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        </section>
      )}

      {/* Snoozed */}
      {snoozed.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Snoozed ({snoozed.length})
          </h3>
          <div className="space-y-2">
            {snoozed.map((t) => (
              <TaskItem key={t.id} task={t} patientId={patientId} />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {done.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Completed ({done.length})
          </h3>
          <div className="space-y-2">
            {done.map((t) => (
              <TaskItem key={t.id} task={t} patientId={patientId} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
