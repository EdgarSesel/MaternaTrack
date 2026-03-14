"use client";

import { useState, useTransition } from "react";
import { rescheduleAppointment } from "@/app/actions/appointment-actions";
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
import { CalendarClock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DURATIONS = [15, 20, 30, 45, 60, 90] as const;

interface Props {
  appointmentId: string;
  patientId: string;
  currentScheduledAt: Date;
  currentDuration: number;
  trigger?: React.ReactNode;
}

export function RescheduleAppointmentDialog({
  appointmentId,
  patientId,
  currentScheduledAt,
  currentDuration,
  trigger,
}: Props) {
  const current = new Date(currentScheduledAt);
  const defaultDate = current.toISOString().split("T")[0];
  const defaultTime = current.toTimeString().slice(0, 5);

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [duration, setDuration] = useState(String(currentDuration));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isConflict, setIsConflict] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleOpen(v: boolean) {
    setOpen(v);
    if (!v) {
      setError("");
      setIsConflict(false);
      setDate(defaultDate);
      setTime(defaultTime);
      setDuration(String(currentDuration));
      setNotes("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsConflict(false);

    if (!date || !time) {
      setError("Please enter a date and time.");
      return;
    }

    const scheduledAt = new Date(`${date}T${time}:00`).toISOString();

    startTransition(async () => {
      const result = await rescheduleAppointment({
        appointmentId,
        patientId,
        scheduledAt,
        duration: Number(duration),
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        setOpen(false);
        toast.success("Appointment rescheduled");
      } else {
        setError(result.error ?? "Failed to reschedule.");
        setIsConflict(result.conflict ?? false);
      }
    });
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="text-xs h-7 text-slate-600">
            <CalendarClock className="w-3.5 h-3.5 mr-1" />
            Reschedule
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rs-date">New date</Label>
              <Input
                id="rs-date"
                type="date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rs-time">New time</Label>
              <Input
                id="rs-time"
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

          <div className="space-y-1.5">
            <Label htmlFor="rs-notes">Notes (optional)</Label>
            <Textarea
              id="rs-notes"
              placeholder="Reason for rescheduling or updated instructions…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {error && (
            <div
              className={`flex gap-2 text-sm rounded-md px-3 py-2 border ${
                isConflict
                  ? "bg-orange-50 border-orange-200 text-orange-800"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              {isConflict && <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <span>{error} {isConflict && "Please choose a different time."}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !date} className="bg-rose-600 hover:bg-rose-700">
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save New Time"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
