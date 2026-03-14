"use client";

import { useState, useTransition } from "react";
import { format, isPast, differenceInHours } from "date-fns";
import { Calendar, Clock, CheckCircle, XCircle, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  confirmAppointment,
  requestReschedule,
  cancelAppointmentPortal,
} from "@/app/portal/actions/portal-appointment-actions";

export interface PortalAppointment {
  id: string;
  type: string;
  scheduledAt: Date;
  duration: number;
  status: string;
  notes: string | null;
  seriesId: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  initial_intake: "Initial Intake",
  routine_prenatal: "Routine Prenatal",
  follow_up: "Follow-up",
  urgent: "Urgent Visit",
  postpartum: "Postpartum Visit",
};

function AppointmentCard({ appt }: { appt: PortalAppointment }) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const past = isPast(new Date(appt.scheduledAt));
  const hoursUntil = differenceInHours(new Date(appt.scheduledAt), new Date());
  const canCancel = hoursUntil >= 24 && appt.status === "scheduled";
  const isCancelled = appt.status === "cancelled";

  function handleConfirm() {
    startTransition(async () => {
      const r = await confirmAppointment(appt.id);
      if (r.success) toast.success("Appointment confirmed!");
      else toast.error(r.error ?? "Failed to confirm");
    });
  }

  function handleRescheduleSubmit() {
    if (!reason.trim()) return;
    startTransition(async () => {
      const r = await requestReschedule({ appointmentId: appt.id, reason: reason.trim() });
      if (r.success) {
        toast.success("Reschedule request sent to your care team.");
        setShowReschedule(false);
        setReason("");
      } else {
        toast.error(r.error ?? "Failed to send request");
      }
    });
  }

  function handleCancelSubmit() {
    startTransition(async () => {
      const r = await cancelAppointmentPortal({ appointmentId: appt.id, reason: reason.trim() || undefined });
      if (r.success) {
        toast.success("Appointment cancelled.");
        setShowCancel(false);
      } else {
        toast.error(r.error ?? "Failed to cancel");
      }
    });
  }

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isCancelled ? "opacity-60" : ""}`}>
      <div className={`h-1.5 ${past || isCancelled ? "bg-slate-300" : "bg-rose-500"}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">
                {TYPE_LABELS[appt.type] ?? appt.type}
              </span>
              {appt.seriesId && (
                <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                  Recurring
                </span>
              )}
              {isCancelled && (
                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                  Cancelled
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-slate-500 text-sm flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(appt.scheduledAt), "EEEE, MMMM d, yyyy")}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {format(new Date(appt.scheduledAt), "h:mm a")} ({appt.duration} min)
              </span>
            </div>
            {appt.notes && (
              <p className="text-xs text-slate-400 mt-1.5 italic">{appt.notes}</p>
            )}
          </div>
        </div>

        {!past && !isCancelled && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
              onClick={handleConfirm}
              disabled={isPending}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Confirm
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 gap-1.5"
              onClick={() => { setShowReschedule(true); setShowCancel(false); setReason(""); }}
              disabled={isPending}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Request Reschedule
            </Button>
            {canCancel && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => { setShowCancel(true); setShowReschedule(false); setReason(""); }}
                disabled={isPending}
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel
              </Button>
            )}
          </div>
        )}

        {showReschedule && (
          <div className="mt-3 bg-slate-50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-slate-700">Why do you need to reschedule?</p>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Work conflict, transportation issue…"
              rows={2}
              className="text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" className="text-xs h-7" onClick={handleRescheduleSubmit} disabled={isPending || !reason.trim()}>
                {isPending ? "Sending…" : "Send Request"}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowReschedule(false)}>
                Back
              </Button>
            </div>
          </div>
        )}

        {showCancel && (
          <div className="mt-3 bg-red-50 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">
                Are you sure you want to cancel? You can add an optional reason below.
              </p>
            </div>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)…"
              rows={2}
              className="text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" className="text-xs h-7" onClick={handleCancelSubmit} disabled={isPending}>
                {isPending ? "Cancelling…" : "Yes, Cancel"}
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowCancel(false)}>
                Keep Appointment
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AppointmentsClient({ appointments }: { appointments: PortalAppointment[] }) {
  const upcoming = appointments.filter((a) => !isPast(new Date(a.scheduledAt)) && a.status !== "cancelled");
  const past = appointments.filter((a) => isPast(new Date(a.scheduledAt)) || a.status === "cancelled");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My Appointments</h1>
        <p className="text-sm text-slate-500 mt-0.5">View, confirm, or manage your upcoming visits.</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="bg-white rounded-xl border p-6 text-center">
            <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No upcoming appointments.</p>
            <p className="text-slate-400 text-xs mt-1">Your care team will schedule your next visit.</p>
          </div>
        ) : (
          upcoming.map((a) => <AppointmentCard key={a.id} appt={a} />)
        )}
      </div>

      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Past & Cancelled</h2>
          {past.slice(0, 5).map((a) => <AppointmentCard key={a.id} appt={a} />)}
        </div>
      )}
    </div>
  );
}
