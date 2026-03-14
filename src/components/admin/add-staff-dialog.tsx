"use client";

import { useState } from "react";
import { createStaff } from "@/app/actions/admin-actions";
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
import { UserPlus, Loader2 } from "lucide-react";

const ROLES = ["NURSE", "MIDWIFE", "OBGYN", "DIETITIAN", "THERAPIST", "ADMIN"] as const;

export function AddStaffDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const result = await createStaff({
      name: fd.get("name") as string,
      email: fd.get("email") as string,
      role: fd.get("role") as string,
      password: fd.get("password") as string,
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
        <Button size="sm" className="bg-rose-600 hover:bg-rose-700">
          <UserPlus className="w-4 h-4 mr-2" />
          Add Staff
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Staff Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" placeholder="Jane Smith" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" name="email" type="email" placeholder="jane@clinic.org" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select name="role" defaultValue="NURSE" required>
              <SelectTrigger id="role">
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
            <Label htmlFor="password">Temporary password</Label>
            <Input id="password" name="password" type="password" placeholder="Min. 8 characters" required minLength={8} />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={loading} className="flex-1 bg-rose-600 hover:bg-rose-700">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : "Create Account"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
