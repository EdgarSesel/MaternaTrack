"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPatient } from "@/app/actions/patient-actions";
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

interface Provider {
  id: string;
  name: string;
  role: string;
}

interface Props {
  isAdmin?: boolean;
  providers?: Provider[];
}

export function AddPatientDialog({ isAdmin, providers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("PREGNANT");
  const [assignTo, setAssignTo] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const result = await createPatient({
      firstName: fd.get("firstName") as string,
      lastName: fd.get("lastName") as string,
      dateOfBirth: fd.get("dateOfBirth") as string,
      status,
      gestationalAgeWeeks: fd.get("gestationalAgeWeeks") ? Number(fd.get("gestationalAgeWeeks")) : undefined,
      insuranceType: (fd.get("insuranceType") as string) || undefined,
      assignToProviderId: assignTo || undefined,
    });

    if (result.success && result.patientId) {
      setOpen(false);
      router.push(`/dashboard/patients/${result.patientId}`);
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
          Add Patient
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Patient</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" placeholder="Maria" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" placeholder="Garcia" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dateOfBirth">Date of birth</Label>
            <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PREGNANT">Pregnant</SelectItem>
                <SelectItem value="PRECONCEPTION">Preconception</SelectItem>
                <SelectItem value="POSTPARTUM">Postpartum</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(status === "PREGNANT" || status === "POSTPARTUM") && (
            <div className="space-y-1.5">
              <Label htmlFor="gestationalAgeWeeks">
                {status === "PREGNANT" ? "Gestational age (weeks)" : "Weeks at delivery"}
                <span className="text-slate-400 font-normal ml-1">(optional)</span>
              </Label>
              <Input id="gestationalAgeWeeks" name="gestationalAgeWeeks" type="number" min={0} max={45} placeholder="e.g. 28" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="insuranceType">
              Insurance type <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Input id="insuranceType" name="insuranceType" placeholder="e.g. Medicaid, Private" />
          </div>
          {isAdmin && providers && providers.length > 0 && (
            <div className="space-y-1.5">
              <Label>Assign to provider</Label>
              <Select value={assignTo} onValueChange={setAssignTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.role.charAt(0) + p.role.slice(1).toLowerCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={loading} className="flex-1 bg-rose-600 hover:bg-rose-700">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : "Create Patient"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
