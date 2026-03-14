"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Baby, Activity, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { recordNeonatalVital, recordBirth, updateBabyStatus } from "@/app/actions/baby-actions";
import type { Baby as BabyModel, NeonatalVital } from "@/generated/prisma/client";

type BabyWithVitals = BabyModel & { neonatalVitals: NeonatalVital[] };

const DELIVERY_LABELS: Record<string, string> = {
  vaginal: "Vaginal",
  cesarean: "Cesarean",
  vbac: "VBAC",
};

const FEEDING_LABELS: Record<string, string> = {
  breast: "Breastfeeding",
  formula: "Formula",
  mixed: "Mixed",
};

function weightGramsToLbsOz(grams: number) {
  const totalOz = grams / 28.3495;
  const lbs = Math.floor(totalOz / 16);
  const oz = Math.round(totalOz % 16);
  return `${lbs} lb ${oz} oz`;
}

// --- Record Birth Dialog ---
function RecordBirthDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    firstName: "",
    dateOfBirth: new Date().toISOString().slice(0, 16),
    birthWeightGrams: "",
    gestationalAgeAtBirth: "",
    apgarScore1Min: "",
    apgarScore5Min: "",
    deliveryType: "vaginal",
    nicuAdmission: false,
    nicuDays: "",
    feedingType: "breast",
    notes: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await recordBirth({
        patientId,
        firstName: form.firstName || undefined,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : undefined,
        birthWeightGrams: form.birthWeightGrams ? Number(form.birthWeightGrams) : undefined,
        gestationalAgeAtBirth: form.gestationalAgeAtBirth ? Number(form.gestationalAgeAtBirth) : undefined,
        apgarScore1Min: form.apgarScore1Min ? Number(form.apgarScore1Min) : undefined,
        apgarScore5Min: form.apgarScore5Min ? Number(form.apgarScore5Min) : undefined,
        deliveryType: form.deliveryType as "vaginal" | "cesarean" | "vbac",
        nicuAdmission: form.nicuAdmission,
        nicuDays: form.nicuDays ? Number(form.nicuDays) : undefined,
        feedingType: form.feedingType as "breast" | "formula" | "mixed",
        notes: form.notes || undefined,
      });
      if (result.success) {
        toast.success("Birth recorded");
        setOpen(false);
      } else {
        toast.error("Failed", { description: result.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Record Birth
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Birth</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Baby&apos;s First Name</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Date & Time of Birth</Label>
              <Input type="datetime-local" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Birth Weight (grams)</Label>
              <Input type="number" min={200} max={8000} value={form.birthWeightGrams} onChange={(e) => setForm({ ...form, birthWeightGrams: e.target.value })} placeholder="e.g. 3400" />
            </div>
            <div className="space-y-1.5">
              <Label>GA at Birth (weeks)</Label>
              <Input type="number" min={20} max={44} value={form.gestationalAgeAtBirth} onChange={(e) => setForm({ ...form, gestationalAgeAtBirth: e.target.value })} placeholder="e.g. 38" />
            </div>
            <div className="space-y-1.5">
              <Label>APGAR 1 min</Label>
              <Input type="number" min={0} max={10} value={form.apgarScore1Min} onChange={(e) => setForm({ ...form, apgarScore1Min: e.target.value })} placeholder="0–10" />
            </div>
            <div className="space-y-1.5">
              <Label>APGAR 5 min</Label>
              <Input type="number" min={0} max={10} value={form.apgarScore5Min} onChange={(e) => setForm({ ...form, apgarScore5Min: e.target.value })} placeholder="0–10" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Delivery Type</Label>
              <Select value={form.deliveryType} onValueChange={(v) => setForm({ ...form, deliveryType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vaginal">Vaginal</SelectItem>
                  <SelectItem value="cesarean">Cesarean</SelectItem>
                  <SelectItem value="vbac">VBAC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Feeding</Label>
              <Select value={form.feedingType} onValueChange={(v) => setForm({ ...form, feedingType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="breast">Breastfeeding</SelectItem>
                  <SelectItem value="formula">Formula</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="nicuAdmission"
              checked={form.nicuAdmission}
              onChange={(e) => setForm({ ...form, nicuAdmission: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300"
            />
            <Label htmlFor="nicuAdmission" className="font-normal cursor-pointer">NICU Admission</Label>
            {form.nicuAdmission && (
              <Input
                type="number"
                min={0}
                max={365}
                className="w-24 ml-2"
                placeholder="Days"
                value={form.nicuDays}
                onChange={(e) => setForm({ ...form, nicuDays: e.target.value })}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional delivery or neonatal notes…" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Saving…" : "Record Birth"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Add Neonatal Vital Dialog ---
function AddNeonatalVitalDialog({ babyId, patientId }: { babyId: string; patientId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [vitalType, setVitalType] = useState("weight");
  const [value, setValue] = useState("");
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().slice(0, 16));

  const UNIT_MAP: Record<string, string> = {
    weight: "grams",
    length: "cm",
    head_circumference: "cm",
    bilirubin: "mg/dL",
    temperature: "°F",
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await recordNeonatalVital({
        babyId,
        patientId,
        type: vitalType,
        value: Number(value),
        unit: UNIT_MAP[vitalType],
        recordedAt: new Date(recordedAt).toISOString(),
      });
      if (result.success) {
        toast.success("Vital recorded");
        setOpen(false);
        setValue("");
      } else {
        toast.error("Failed", { description: result.error });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          Add Vital
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Record Neonatal Vital</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Vital Type</Label>
            <Select value={vitalType} onValueChange={setVitalType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weight">Weight (grams)</SelectItem>
                <SelectItem value="length">Length (cm)</SelectItem>
                <SelectItem value="head_circumference">Head Circumference (cm)</SelectItem>
                <SelectItem value="bilirubin">Bilirubin (mg/dL)</SelectItem>
                <SelectItem value="temperature">Temperature (°F)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Value ({UNIT_MAP[vitalType]})</Label>
            <Input type="number" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Recorded At</Label>
            <Input type="datetime-local" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending || !value}>{isPending ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// --- Weight Chart ---
function WeightChart({ vitals }: { vitals: NeonatalVital[] }) {
  const weightData = vitals
    .filter((v) => v.type === "weight")
    .map((v) => {
      const val = v.value as { value: number; unit: string };
      return {
        date: format(new Date(v.recordedAt), "MMM d"),
        grams: val.value,
      };
    });

  if (weightData.length < 2) {
    return <p className="text-xs text-slate-400 py-4 text-center">Need at least 2 weight readings to show trend.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={weightData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
        <Tooltip formatter={(val) => [`${val}g`, "Weight"]} />
        <Line type="monotone" dataKey="grams" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// --- Main Component ---
interface BabyOverviewProps {
  patientId: string;
  babies: BabyWithVitals[];
}

export function BabyOverview({ patientId, babies }: BabyOverviewProps) {
  if (babies.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-lg">
        <Baby className="w-8 h-8 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 text-sm font-medium">No birth recorded yet</p>
        <p className="text-slate-400 text-xs mt-1 mb-4">Record birth outcome to track neonatal data</p>
        <RecordBirthDialog patientId={patientId} />
      </div>
    );
  }

  const baby = babies[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Neonatal Record</h3>
        <AddNeonatalVitalDialog babyId={baby.id} patientId={patientId} />
      </div>

      {/* Birth summary card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center">
                <Baby className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">
                  {baby.firstName ?? "Baby"}
                </p>
                {baby.dateOfBirth && (
                  <p className="text-xs text-slate-500">
                    Born {format(new Date(baby.dateOfBirth), "MMMM d, yyyy")}
                    {baby.gestationalAgeAtBirth ? ` at ${baby.gestationalAgeAtBirth} weeks` : ""}
                  </p>
                )}
              </div>
            </div>
            {baby.nicuAdmission && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                NICU{baby.nicuDays ? ` — ${baby.nicuDays}d` : ""}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
            {baby.birthWeightGrams && (
              <div>
                <p className="text-xs text-slate-400">Birth Weight</p>
                <p className="font-medium">{weightGramsToLbsOz(baby.birthWeightGrams)}</p>
                <p className="text-xs text-slate-400">({baby.birthWeightGrams}g)</p>
              </div>
            )}
            {baby.deliveryType && (
              <div>
                <p className="text-xs text-slate-400">Delivery</p>
                <p className="font-medium">{DELIVERY_LABELS[baby.deliveryType] ?? baby.deliveryType}</p>
              </div>
            )}
            {(baby.apgarScore1Min !== null || baby.apgarScore5Min !== null) && (
              <div>
                <p className="text-xs text-slate-400">APGAR</p>
                <p className="font-medium">
                  {baby.apgarScore1Min ?? "–"} / {baby.apgarScore5Min ?? "–"}
                  <span className="text-xs text-slate-400 ml-1">(1m / 5m)</span>
                </p>
              </div>
            )}
            {baby.feedingType && (
              <div>
                <p className="text-xs text-slate-400">Feeding</p>
                <p className="font-medium">{FEEDING_LABELS[baby.feedingType] ?? baby.feedingType}</p>
              </div>
            )}
          </div>

          {baby.notes && (
            <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100">{baby.notes}</p>
          )}
        </CardContent>
      </Card>

      {/* Weight growth chart */}
      {baby.neonatalVitals.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm">Weight Trend</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <WeightChart vitals={baby.neonatalVitals} />
          </CardContent>
        </Card>
      )}

      {/* Recent vitals table */}
      {baby.neonatalVitals.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-slate-700 mb-3">Recent Neonatal Vitals</p>
            <div className="space-y-2">
              {baby.neonatalVitals.slice(0, 10).map((v) => {
                const val = v.value as { value: number; unit: string };
                return (
                  <div key={v.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 capitalize">{v.type.replace(/_/g, " ")}</span>
                    <div className="text-right">
                      <span className="font-medium">{val.value} {val.unit}</span>
                      <span className="text-xs text-slate-400 ml-2">
                        {format(new Date(v.recordedAt), "MMM d")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
