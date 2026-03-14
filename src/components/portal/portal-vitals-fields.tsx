"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, XCircle } from "lucide-react";
import type { VitalType } from "@/app/portal/actions/portal-patient-actions";

export interface VitalFields {
  systolic: string; diastolic: string;
  weight: string; weightUnit: "lbs" | "kg";
  glucose: string; glucoseContext: "fasting" | "post_meal_1h" | "post_meal_2h" | "bedtime" | "random";
  heartRate: string;
  temperature: string; tempUnit: "F" | "C";
  fetalCount: string; fetalHours: string;
  spO2: string;
  urineProtein: "negative" | "trace" | "1+" | "2+" | "3+" | "4+";
}

export interface LastReading { value: Record<string, unknown>; recordedAt: string; }

export interface SmartWarning { message: string; severity: "warning" | "error"; }

const toLbs = (v: number, u: string) => u === "kg" ? v * 2.205 : v;
const toF = (v: number, u: string) => u === "C" ? v * 9 / 5 + 32 : v;

export function getSmartWarning(type: VitalType, fields: VitalFields, last: LastReading | null): SmartWarning | null {
  if (!last) return null;
  const daysDiff = (Date.now() - new Date(last.recordedAt).getTime()) / 86400000;

  if (type === "weight" && fields.weight && daysDiff < 7) {
    const prev = last.value as { value: number; unit: string };
    const diff = Math.abs(toLbs(Number(fields.weight), fields.weightUnit) - toLbs(prev.value, prev.unit));
    if (diff > 20) return { severity: "error", message: `This is ${diff.toFixed(0)} lbs different from your last reading (${prev.value} ${prev.unit}). That change is physically impossible in ${daysDiff < 1 ? "one day" : `${Math.round(daysDiff)} days`}. Please recheck your scale.` };
    if (diff > 7) return { severity: "warning", message: `This is ${diff.toFixed(0)} lbs different from your last reading (${prev.value} ${prev.unit}). Please confirm this is correct.` };
  }

  if (type === "bp" && fields.systolic && daysDiff < 1) {
    const prev = last.value as { systolic: number };
    const diff = Math.abs(Number(fields.systolic) - prev.systolic);
    if (diff > 40) return { severity: "warning", message: `Systolic is ${diff} mmHg different from your reading earlier today. Please retake the measurement if this seems wrong.` };
  }

  if (type === "oxygen_saturation" && fields.spO2) {
    const v = Number(fields.spO2);
    if (v < 80) return { severity: "error", message: "SpO₂ below 80% is critically low. If this is accurate, contact your care team immediately." };
    if (v < 90) return { severity: "warning", message: "SpO₂ below 90% is concerning during pregnancy. Please retake the reading and contact your care team if it stays low." };
  }

  if (type === "temperature" && fields.temperature) {
    const f = toF(Number(fields.temperature), fields.tempUnit);
    if (f > 104) return { severity: "error", message: "A temperature above 104°F is a medical emergency. Please seek care immediately." };
    if (f > 100.4) return { severity: "warning", message: "A fever above 100.4°F during pregnancy should be evaluated by your care team promptly." };
  }

  if (type === "heart_rate" && fields.heartRate) {
    const v = Number(fields.heartRate);
    if (v > 150 || v < 40) return { severity: "warning", message: "This heart rate is outside the expected resting range. Please retake your measurement." };
  }

  return null;
}

interface Props {
  type: VitalType;
  fields: VitalFields;
  onChange: (patch: Partial<VitalFields>) => void;
  warning: SmartWarning | null;
}

export function VitalFields({ type, fields, onChange, warning }: Props) {
  return (
    <div className="space-y-3">
      {type === "bp" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="systolic">Systolic (top)</Label>
            <Input id="systolic" type="number" min={50} max={300} placeholder="e.g. 120" value={fields.systolic} onChange={(e) => onChange({ systolic: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="diastolic">Diastolic (bottom)</Label>
            <Input id="diastolic" type="number" min={30} max={200} placeholder="e.g. 80" value={fields.diastolic} onChange={(e) => onChange({ diastolic: e.target.value })} required />
          </div>
          <p className="col-span-2 text-xs text-slate-400">Enter the two numbers from your blood pressure cuff (e.g. 120/80).</p>
        </div>
      )}

      {type === "weight" && (
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="weight">Weight</Label>
            <Input id="weight" type="number" step="0.1" min={50} max={1000} placeholder="e.g. 160" value={fields.weight} onChange={(e) => onChange({ weight: e.target.value })} required />
          </div>
          <div className="w-24 space-y-1.5">
            <Label>Unit</Label>
            <Select value={fields.weightUnit} onValueChange={(v) => onChange({ weightUnit: v as "lbs" | "kg" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="lbs">lbs</SelectItem><SelectItem value="kg">kg</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      )}

      {type === "glucose" && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="glucose">Blood glucose (mg/dL)</Label>
            <Input id="glucose" type="number" min={20} max={700} placeholder="e.g. 95" value={fields.glucose} onChange={(e) => onChange({ glucose: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>When was this taken?</Label>
            <Select value={fields.glucoseContext} onValueChange={(v) => onChange({ glucoseContext: v as VitalFields["glucoseContext"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fasting">Fasting (8+ hours since eating)</SelectItem>
                <SelectItem value="post_meal_1h">1 hour after a meal</SelectItem>
                <SelectItem value="post_meal_2h">2 hours after a meal</SelectItem>
                <SelectItem value="bedtime">Bedtime</SelectItem>
                <SelectItem value="random">Random / unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {type === "heart_rate" && (
        <div className="space-y-1.5">
          <Label htmlFor="hr">Resting heart rate (bpm)</Label>
          <Input id="hr" type="number" min={20} max={300} placeholder="e.g. 72" value={fields.heartRate} onChange={(e) => onChange({ heartRate: e.target.value })} required />
          <p className="text-xs text-slate-400">Measure after sitting quietly for at least 5 minutes.</p>
        </div>
      )}

      {type === "temperature" && (
        <div className="flex gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="temp">Temperature</Label>
            <Input id="temp" type="number" step="0.1" min={85} max={115} placeholder={fields.tempUnit === "F" ? "e.g. 98.6" : "e.g. 37.0"} value={fields.temperature} onChange={(e) => onChange({ temperature: e.target.value })} required />
          </div>
          <div className="w-20 space-y-1.5">
            <Label>Unit</Label>
            <Select value={fields.tempUnit} onValueChange={(v) => onChange({ tempUnit: v as "F" | "C" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="F">°F</SelectItem><SelectItem value="C">°C</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      )}

      {type === "fetal_movement" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="kicks">Number of kicks felt</Label>
            <Input id="kicks" type="number" min={0} max={200} placeholder="e.g. 10" value={fields.fetalCount} onChange={(e) => onChange({ fetalCount: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Over how many hours?</Label>
            <Select value={fields.fetalHours} onValueChange={(v) => onChange({ fetalHours: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">30 minutes</SelectItem>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="2">2 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="col-span-2 text-xs text-slate-400">ACOG recommends at least 10 kicks in 2 hours after 28 weeks.</p>
        </div>
      )}

      {type === "oxygen_saturation" && (
        <div className="space-y-1.5">
          <Label htmlFor="spo2">Oxygen saturation (%)</Label>
          <Input id="spo2" type="number" min={50} max={100} placeholder="e.g. 98" value={fields.spO2} onChange={(e) => onChange({ spO2: e.target.value })} required />
          <p className="text-xs text-slate-400">Read from a pulse oximeter. Normal range during pregnancy is 95–100%.</p>
        </div>
      )}

      {type === "urine_protein" && (
        <div className="space-y-1.5">
          <Label>Dipstick result</Label>
          <div className="flex flex-wrap gap-2">
            {(["negative", "trace", "1+", "2+", "3+", "4+"] as const).map((opt) => (
              <button key={opt} type="button" onClick={() => onChange({ urineProtein: opt })}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  fields.urineProtein === opt
                    ? opt === "negative" ? "bg-green-600 text-white border-green-600"
                      : opt === "trace" || opt === "1+" ? "bg-yellow-500 text-white border-yellow-500"
                      : "bg-red-600 text-white border-red-600"
                    : "text-slate-600 border-slate-200 hover:border-slate-400"
                }`}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400">From a urine dipstick test strip. Higher values (2+ or above) should be reported to your care team.</p>
        </div>
      )}

      {warning && (
        <div className={`flex gap-2.5 rounded-lg px-3 py-2.5 text-sm ${
          warning.severity === "error" ? "bg-red-50 border border-red-200 text-red-700" : "bg-amber-50 border border-amber-200 text-amber-700"
        }`}>
          {warning.severity === "error" ? <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{warning.message}</span>
        </div>
      )}
    </div>
  );
}
