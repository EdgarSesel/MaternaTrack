"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { createHandoff } from "@/app/actions/handoff-actions";

interface Provider {
  id: string;
  name: string;
  role: string;
}

interface HandoffDialogProps {
  patientId: string;
  patientName: string;
  providers: Provider[];
  /** The current provider's ID — exclude from target list */
  currentProviderId: string;
  /** Pre-filled AI or risk summary text */
  riskSummary?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  NURSE: "Nurse",
  MIDWIFE: "Midwife",
  OBGYN: "OB-GYN",
  DIETITIAN: "Dietitian",
  THERAPIST: "Therapist",
  ADMIN: "Admin",
};

export function HandoffDialog({
  patientId,
  patientName,
  providers,
  currentProviderId,
  riskSummary,
}: HandoffDialogProps) {
  const [open, setOpen] = useState(false);
  const [toProviderId, setToProviderId] = useState("");
  const [summary, setSummary] = useState(
    riskSummary ?? `Handing off care for ${patientName}. Please review the patient's current risk profile and open tasks.`
  );
  const [openConcerns, setOpenConcerns] = useState("");
  const [isPending, startTransition] = useTransition();

  const eligibleProviders = providers.filter((p) => p.id !== currentProviderId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!toProviderId) return;

    startTransition(async () => {
      const result = await createHandoff({ patientId, toProviderId, summary, openConcerns });
      if (result.success) {
        toast.success("Handoff created", {
          description: `${patientName} will appear in the recipient's incoming handoffs.`,
        });
        setOpen(false);
      } else {
        toast.error("Handoff failed", { description: result.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ArrowRightLeft className="w-3.5 h-3.5" />
          Handoff
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Handoff Patient</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-md text-sm text-slate-600 dark:text-slate-300">
            <span className="font-medium">Patient:</span> {patientName}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="toProvider">Transfer to</Label>
            <Select value={toProviderId} onValueChange={setToProviderId}>
              <SelectTrigger id="toProvider">
                <SelectValue placeholder="Select provider…" />
              </SelectTrigger>
              <SelectContent>
                {eligibleProviders.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {ROLE_LABELS[p.role] ?? p.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="summary">Handoff Summary</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="Current status, recent changes, ongoing management plan…"
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="concerns">Open Concerns</Label>
            <Textarea
              id="concerns"
              value={openConcerns}
              onChange={(e) => setOpenConcerns(e.target.value)}
              rows={3}
              placeholder="Pending results, unresolved issues, things to watch…"
              className="resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !toProviderId || !summary.trim()}>
              {isPending ? "Creating handoff…" : "Create Handoff"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
