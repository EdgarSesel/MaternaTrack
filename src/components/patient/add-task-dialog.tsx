"use client";

import { useState, useTransition } from "react";
import { createAdHocTask } from "@/app/actions/patient-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

interface Props {
  patientId: string;
}

export function AddTaskDialog({ patientId }: Props) {
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState("normal");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const fd = new FormData(e.currentTarget);
    const title = fd.get("title") as string;
    const description = (fd.get("description") as string) || undefined;
    const dueDate = fd.get("dueDate") as string;

    startTransition(async () => {
      const result = await createAdHocTask({ patientId, title, description, dueDate, priority });
      if (result.success) {
        setOpen(false);
        toast.success("Task created");
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  const defaultDue = format(addDays(new Date(), 7), "yyyy-MM-dd");

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(""); setPriority("normal"); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs h-7">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="at-title">Task title</Label>
            <Input id="at-title" name="title" placeholder="e.g. Follow up on lab results" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="at-desc">Description <span className="text-slate-400 font-normal">(optional)</span></Label>
            <Textarea id="at-desc" name="description" placeholder="Additional context..." rows={2} className="text-sm resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="at-due">Due date</Label>
              <Input id="at-due" name="dueDate" type="date" defaultValue={defaultDue} required />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={isPending} className="flex-1 bg-rose-600 hover:bg-rose-700">
              {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : "Create Task"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
