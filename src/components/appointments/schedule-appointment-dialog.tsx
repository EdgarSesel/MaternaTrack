"use client";

import { useState } from "react";
import { createAppointment } from "@/app/actions/appointment-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CalendarPlus, RefreshCw } from "lucide-react";

const APPOINTMENT_TYPES = [
  { value: "initial_intake", label: "Initial Intake" },
  { value: "routine_prenatal", label: "Routine Prenatal" },
  { value: "follow_up", label: "Follow-up" },
  { value: "urgent", label: "Urgent" },
  { value: "postpartum", label: "Postpartum" },
] as const;

const DURATIONS = [15, 20, 30, 45, 60, 90] as const;

const RECURRENCE_OPTIONS = [
  { value: "none", label: "No recurrence (one-time)" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
] as const;

const RECURRENCE_COUNTS = [2, 3, 4, 6, 8, 10, 12] as const;

interface ScheduleAppointmentDialogProps {
  patientId: string;
  patientName: string;
}

export function ScheduleAppointmentDialog({
  patientId,
  patientName,
}: ScheduleAppointmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>("routine_prenatal");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("30");
  const [notes, setNotes] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState("none");
  const [recurrenceCount, setRecurrenceCount] = useState("4");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function buildDatetime(): string {
    if (!date || !time) return "";
    return new Date(`${date}T${time}:00`).toISOString();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const scheduledAt = buildDatetime();
    if (!scheduledAt) { setError("Please enter a date and time."); return; }

    setLoading(true);
    setError("");

    const result = await createAppointment({
      patientId,
      type,
      scheduledAt,
      duration: Number(duration),
      notes: notes.trim() || undefined,
      ...(recurrenceRule && recurrenceRule !== "none"
        ? { recurrenceRule, recurrenceCount: Number(recurrenceCount) }
        : {}),
    });

    if (result.success) {
      setOpen(false);
      setDate("");
      setTime("09:00");
      setNotes("");
      setRecurrenceRule("none");
    } else {
      setError(result.error ?? "Failed to schedule appointment.");
    }
    setLoading(false);
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarPlus className="w-3.5 h-3.5 mr-1.5" />
          Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Appointment</DialogTitle>
          <p className="text-sm text-slate-500">For {patientName}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Appointment type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="appt-date">Date</Label>
              <Input
                id="appt-date"
                type="date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-time">Time</Label>
              <Input
                id="appt-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} minutes
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recurrence */}
          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm font-medium text-slate-700">Recurrence</span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Repeat</Label>
              <Select value={recurrenceRule} onValueChange={setRecurrenceRule}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {recurrenceRule && recurrenceRule !== "none" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500">Number of appointments</Label>
                <Select value={recurrenceCount} onValueChange={setRecurrenceCount}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_COUNTS.map((c) => (
                      <SelectItem key={c} value={String(c)}>
                        {c} appointments
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-400">
                  Creates {recurrenceCount} appointments starting on the selected date.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appt-notes">Notes (optional)</Label>
            <Textarea
              id="appt-notes"
              placeholder="Any preparation instructions or context…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !date}>
              {loading
                ? "Scheduling…"
                : recurrenceRule && recurrenceRule !== "none"
                ? `Schedule ${recurrenceCount} Appointments`
                : "Schedule Appointment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
