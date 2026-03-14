"use client";

import { useState, useTransition } from "react";
import { recordVital, type VitalType } from "@/app/actions/vital-actions";
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
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";

const VITAL_TYPES: { type: VitalType; label: string }[] = [
  { type: "bp", label: "Blood Pressure" },
  { type: "weight", label: "Weight" },
  { type: "glucose", label: "Blood Glucose" },
  { type: "heart_rate", label: "Heart Rate" },
  { type: "temperature", label: "Temperature" },
  { type: "fetal_movement", label: "Fetal Kicks" },
  { type: "oxygen_saturation", label: "Oxygen (SpO₂)" },
  { type: "urine_protein", label: "Urine Protein" },
];

interface Props {
  patientId: string;
}

export function RecordVitalDialog({ patientId }: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<VitalType>("bp");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const fd = new FormData(e.currentTarget);
    const input: Record<string, unknown> = { type, patientId };

    switch (type) {
      case "bp":
        input.systolic = fd.get("systolic");
        input.diastolic = fd.get("diastolic");
        break;
      case "weight":
        input.value = fd.get("value");
        input.unit = fd.get("unit");
        break;
      case "glucose":
        input.value = fd.get("value");
        input.context = fd.get("context") || undefined;
        break;
      case "heart_rate":
      case "oxygen_saturation":
        input.value = fd.get("value");
        break;
      case "temperature":
        input.value = fd.get("value");
        input.unit = fd.get("unit");
        break;
      case "fetal_movement":
        input.count = fd.get("count");
        input.period_hours = fd.get("period_hours");
        break;
      case "urine_protein":
        input.result = fd.get("result");
        break;
    }

    startTransition(async () => {
      const result = await recordVital(input);
      if (result.success) {
        setOpen(false);
        toast.success("Vital recorded");
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(""); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Activity className="w-3.5 h-3.5 mr-1.5" />
          Record Vital
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Vital</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Vital type</Label>
            <div className="flex gap-1.5 flex-wrap">
              {VITAL_TYPES.map((vt) => (
                <button key={vt.type} type="button" onClick={() => setType(vt.type)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    type === vt.type ? "bg-rose-600 text-white border-rose-600" : "text-slate-600 border-slate-200 hover:border-rose-300"
                  }`}>
                  {vt.label}
                </button>
              ))}
            </div>
          </div>

          {type === "bp" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rv-sys">Systolic</Label>
                <Input id="rv-sys" name="systolic" type="number" min={50} max={300} placeholder="120" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rv-dia">Diastolic</Label>
                <Input id="rv-dia" name="diastolic" type="number" min={30} max={200} placeholder="80" required />
              </div>
            </div>
          )}

          {type === "weight" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rv-wt">Weight</Label>
                <Input id="rv-wt" name="value" type="number" step="0.1" min={0} placeholder="145" required />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select name="unit" defaultValue="lbs">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lbs">lbs</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {type === "glucose" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rv-gl">Glucose (mg/dL)</Label>
                <Input id="rv-gl" name="value" type="number" min={0} max={700} placeholder="95" required />
              </div>
              <div className="space-y-1.5">
                <Label>Context</Label>
                <Select name="context" defaultValue="fasting">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fasting">Fasting</SelectItem>
                    <SelectItem value="post_meal_1h">1h post-meal</SelectItem>
                    <SelectItem value="post_meal_2h">2h post-meal</SelectItem>
                    <SelectItem value="bedtime">Bedtime</SelectItem>
                    <SelectItem value="random">Random</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {type === "heart_rate" && (
            <div className="space-y-1.5">
              <Label htmlFor="rv-hr">Heart rate (bpm)</Label>
              <Input id="rv-hr" name="value" type="number" min={20} max={300} placeholder="72" required />
            </div>
          )}

          {type === "temperature" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rv-temp">Temperature</Label>
                <Input id="rv-temp" name="value" type="number" step="0.1" min={85} max={115} placeholder="98.6" required />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select name="unit" defaultValue="F">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">°F</SelectItem>
                    <SelectItem value="C">°C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {type === "fetal_movement" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rv-kicks">Kick count</Label>
                <Input id="rv-kicks" name="count" type="number" min={0} max={200} placeholder="10" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rv-hours">Period (hours)</Label>
                <Input id="rv-hours" name="period_hours" type="number" step="0.5" min={0.5} max={4} defaultValue="1" required />
              </div>
            </div>
          )}

          {type === "oxygen_saturation" && (
            <div className="space-y-1.5">
              <Label htmlFor="rv-spo2">SpO₂ (%)</Label>
              <Input id="rv-spo2" name="value" type="number" min={50} max={100} placeholder="98" required />
            </div>
          )}

          {type === "urine_protein" && (
            <div className="space-y-1.5">
              <Label>Result</Label>
              <Select name="result" defaultValue="negative">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="negative">Negative</SelectItem>
                  <SelectItem value="trace">Trace</SelectItem>
                  <SelectItem value="1+">1+</SelectItem>
                  <SelectItem value="2+">2+</SelectItem>
                  <SelectItem value="3+">3+</SelectItem>
                  <SelectItem value="4+">4+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={isPending} className="flex-1 bg-rose-600 hover:bg-rose-700">
              {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save Reading"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
