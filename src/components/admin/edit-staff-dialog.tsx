"use client";

import { useState } from "react";
import { updateStaff } from "@/app/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Pencil, Loader2 } from "lucide-react";

const ROLES = ["NURSE", "MIDWIFE", "OBGYN", "DIETITIAN", "THERAPIST", "ADMIN"] as const;

interface Provider {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Props {
  provider: Provider;
}

export function EditStaffDialog({ provider }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const result = await updateStaff({
      providerId: provider.id,
      name: fd.get("name") as string,
      role: fd.get("role") as string,
      password: (fd.get("password") as string) || undefined,
    });

    if (result.success) {
      setOpen(false);
    } else {
      setError(result.error ?? "Something went wrong.");
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(""); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-700 h-8 w-8 p-0">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Staff Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Full name</Label>
            <Input id="edit-name" name="name" defaultValue={provider.name} required />
          </div>
          <div className="space-y-1.5">
            <Label>Email address</Label>
            <Input value={provider.email} disabled className="text-slate-400" />
            <p className="text-xs text-slate-400">Email cannot be changed.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-role">Role</Label>
            <Select name="role" defaultValue={provider.role} required>
              <SelectTrigger id="edit-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-password">New password <span className="text-slate-400 font-normal">(leave blank to keep current)</span></Label>
            <Input id="edit-password" name="password" type="password" placeholder="Min. 8 characters" minLength={8} />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={loading} className="flex-1 bg-rose-600 hover:bg-rose-700">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
