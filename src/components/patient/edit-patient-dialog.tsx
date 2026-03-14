"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePatient } from "@/app/actions/patient-actions";
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
import { format } from "date-fns";

interface PatientData {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  dueDate: Date | null;
  status: string;
  gestationalAgeWeeks: number | null;
  insuranceType: string | null;
}

interface Props {
  patient: PatientData;
}

export function EditPatientDialog({ patient }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(patient.status);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fd = new FormData(e.currentTarget);
    const result = await updatePatient({
      patientId: patient.id,
      firstName: fd.get("firstName") as string,
      lastName: fd.get("lastName") as string,
      dateOfBirth: fd.get("dateOfBirth") as string,
      dueDate: (fd.get("dueDate") as string) || null,
      status,
      gestationalAgeWeeks: fd.get("gestationalAgeWeeks") ? Number(fd.get("gestationalAgeWeeks")) : null,
      insuranceType: (fd.get("insuranceType") as string) || null,
    });

    if (result.success) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error ?? "Something went wrong.");
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(""); setStatus(patient.status); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="w-3.5 h-3.5 mr-1.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Patient</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-firstName">First name</Label>
              <Input id="ep-firstName" name="firstName" defaultValue={patient.firstName} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-lastName">Last name</Label>
              <Input id="ep-lastName" name="lastName" defaultValue={patient.lastName} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-dob">Date of birth</Label>
            <Input id="ep-dob" name="dateOfBirth" type="date" defaultValue={format(new Date(patient.dateOfBirth), "yyyy-MM-dd")} required />
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
            <>
              <div className="space-y-1.5">
                <Label htmlFor="ep-ga">Gestational age (weeks)</Label>
                <Input id="ep-ga" name="gestationalAgeWeeks" type="number" min={0} max={45}
                  defaultValue={patient.gestationalAgeWeeks ?? ""} placeholder="e.g. 28" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ep-edd">Estimated due date</Label>
                <Input id="ep-edd" name="dueDate" type="date"
                  defaultValue={patient.dueDate ? format(new Date(patient.dueDate), "yyyy-MM-dd") : ""} />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ep-insurance">Insurance type</Label>
            <Input id="ep-insurance" name="insuranceType" defaultValue={patient.insuranceType ?? ""} placeholder="e.g. Medicaid, Private" />
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
