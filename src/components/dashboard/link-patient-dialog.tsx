"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchPatientsForLinking, linkExistingPatient } from "@/app/actions/patient-actions";
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
import { Link2, Search, Loader2, UserCheck } from "lucide-react";
import { format, differenceInYears } from "date-fns";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  secondary: "Secondary Provider",
  consulting: "Consulting",
  covering: "Covering",
};

const STATUS_LABELS: Record<string, string> = {
  PRECONCEPTION: "Preconception",
  PREGNANT: "Pregnant",
  POSTPARTUM: "Postpartum",
  INACTIVE: "Inactive",
};

interface PatientResult {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  status: string;
  riskLevel: string;
  providerName: string;
}

export function LinkPatientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PatientResult | null>(null);
  const [role, setRole] = useState("secondary");
  const [isPending, startTransition] = useTransition();

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const found = await searchPatientsForLinking(value.trim());
    setResults(found);
    setSearching(false);
  }

  function handleSelect(patient: PatientResult) {
    setSelected(patient);
    setResults([]);
    setQuery(`${patient.firstName} ${patient.lastName}`);
  }

  function handleClose(v: boolean) {
    setOpen(v);
    if (!v) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setRole("secondary");
    }
  }

  function handleLink() {
    if (!selected) return;
    startTransition(async () => {
      const result = await linkExistingPatient({ patientId: selected.id, role });
      if (result.success) {
        toast.success(`${selected.firstName} ${selected.lastName} added to your panel`);
        handleClose(false);
        router.push(`/dashboard/patients/${selected.id}`);
      } else {
        toast.error(result.error ?? "Failed to link patient");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="w-4 h-4 mr-2" />
          Link Existing
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link Existing Patient</DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            Add a patient already in the system to your panel. You&apos;ll see all their existing records.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Search */}
          <div className="space-y-1.5">
            <Label>Search by name</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                className="pl-8"
                placeholder="Type at least 2 characters…"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {searching && (
                <Loader2 className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400 animate-spin" />
              )}
            </div>

            {/* Results dropdown */}
            {results.length > 0 && (
              <div className="border rounded-md bg-white shadow-sm divide-y max-h-52 overflow-y-auto">
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors"
                    onClick={() => handleSelect(p)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-medium text-sm text-slate-900">
                          {p.firstName} {p.lastName}
                        </span>
                        <span className="text-xs text-slate-500 ml-2">
                          Age {differenceInYears(new Date(), new Date(p.dateOfBirth))} ·{" "}
                          {STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{p.providerName}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {query.trim().length >= 2 && results.length === 0 && !searching && !selected && (
              <p className="text-xs text-slate-500 px-1">No patients found.</p>
            )}
          </div>

          {/* Selected patient card */}
          {selected && (
            <div className="border rounded-md bg-slate-50 px-3 py-3 flex items-start gap-3">
              <UserCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-sm text-slate-900">
                  {selected.firstName} {selected.lastName}
                </p>
                <p className="text-xs text-slate-500">
                  {STATUS_LABELS[selected.status] ?? selected.status} ·{" "}
                  DOB {format(new Date(selected.dateOfBirth), "MMM d, yyyy")} ·{" "}
                  Primary: {selected.providerName}
                </p>
              </div>
            </div>
          )}

          {/* Role */}
          <div className="space-y-1.5">
            <Label>Your role for this patient</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([v, label]) => (
                  <SelectItem key={v} value={v}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              You will have read and write access to all existing patient records.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              onClick={handleLink}
              disabled={!selected || isPending}
              className="flex-1 bg-rose-600 hover:bg-rose-700"
            >
              {isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Linking…</>
              ) : (
                "Link Patient"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
