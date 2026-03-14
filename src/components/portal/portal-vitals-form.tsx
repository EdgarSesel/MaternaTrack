"use client";

import { useRef, useState } from "react";
import { portalSubmitVital, type VitalType } from "@/app/portal/actions/portal-patient-actions";
import { VitalFields, getSmartWarning, type VitalFields as Fields, type LastReading } from "./portal-vitals-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Upload, Loader2, Sparkles, X, ImageIcon, FileText } from "lucide-react";

const VITAL_TABS: { type: VitalType; label: string }[] = [
  { type: "bp", label: "Blood Pressure" },
  { type: "weight", label: "Weight" },
  { type: "glucose", label: "Blood Glucose" },
  { type: "heart_rate", label: "Heart Rate" },
  { type: "temperature", label: "Temperature" },
  { type: "fetal_movement", label: "Fetal Kicks" },
  { type: "oxygen_saturation", label: "Oxygen (SpO₂)" },
  { type: "urine_protein", label: "Urine Protein" },
];

const DEFAULT_FIELDS: Fields = {
  systolic: "", diastolic: "",
  weight: "", weightUnit: "lbs",
  glucose: "", glucoseContext: "fasting",
  heartRate: "",
  temperature: "", tempUnit: "F",
  fetalCount: "", fetalHours: "1",
  spO2: "",
  urineProtein: "negative",
};

function buildInput(type: VitalType, fields: Fields, patientId: string): unknown {
  const base = { type, patientId };
  switch (type) {
    case "bp": return { ...base, systolic: fields.systolic, diastolic: fields.diastolic };
    case "weight": return { ...base, value: fields.weight, unit: fields.weightUnit };
    case "glucose": return { ...base, value: fields.glucose, context: fields.glucoseContext };
    case "heart_rate": return { ...base, value: fields.heartRate };
    case "temperature": return { ...base, value: fields.temperature, unit: fields.tempUnit };
    case "fetal_movement": return { ...base, count: fields.fetalCount, period_hours: fields.fetalHours };
    case "oxygen_saturation": return { ...base, value: fields.spO2 };
    case "urine_protein": return { ...base, result: fields.urineProtein };
  }
}

type ExtractedVitals = Record<string, Record<string, unknown>>;

function applyExtraction(extracted: ExtractedVitals, current: Fields): { fields: Fields; detectedType: VitalType | null } {
  const fields = { ...current };
  let detectedType: VitalType | null = null;

  if (extracted.bp?.systolic && extracted.bp?.diastolic) {
    fields.systolic = String(extracted.bp.systolic);
    fields.diastolic = String(extracted.bp.diastolic);
    detectedType = "bp";
  }
  if (extracted.weight?.value) {
    fields.weight = String(extracted.weight.value);
    if (extracted.weight.unit === "kg") fields.weightUnit = "kg";
    detectedType = detectedType ?? "weight";
  }
  if (extracted.glucose?.value) {
    fields.glucose = String(extracted.glucose.value);
    if (extracted.glucose.context) fields.glucoseContext = extracted.glucose.context as Fields["glucoseContext"];
    detectedType = detectedType ?? "glucose";
  }
  if (extracted.heart_rate?.value) { fields.heartRate = String(extracted.heart_rate.value); detectedType = detectedType ?? "heart_rate"; }
  if (extracted.temperature?.value) {
    fields.temperature = String(extracted.temperature.value);
    if (extracted.temperature.unit === "C") fields.tempUnit = "C";
    detectedType = detectedType ?? "temperature";
  }
  if (extracted.oxygen_saturation?.value) { fields.spO2 = String(extracted.oxygen_saturation.value); detectedType = detectedType ?? "oxygen_saturation"; }
  if (extracted.urine_protein?.result) { fields.urineProtein = extracted.urine_protein.result as Fields["urineProtein"]; detectedType = detectedType ?? "urine_protein"; }

  return { fields, detectedType };
}

function extractedSummary(extracted: ExtractedVitals): string[] {
  return Object.entries(extracted).flatMap(([k, v]) => {
    if (k === "bp") return [`BP: ${(v as {systolic:number}).systolic}/${(v as {diastolic:number}).diastolic} mmHg`];
    if (k === "glucose") return [`Glucose: ${(v as {value:number}).value} mg/dL`];
    if (k === "weight") return [`Weight: ${(v as {value:number}).value} ${(v as {unit:string}).unit}`];
    if (k === "heart_rate") return [`Heart rate: ${(v as {value:number}).value} bpm`];
    if (k === "temperature") return [`Temp: ${(v as {value:number}).value}°${(v as {unit:string}).unit}`];
    if (k === "oxygen_saturation") return [`SpO₂: ${(v as {value:number}).value}%`];
    if (k === "urine_protein") return [`Urine protein: ${(v as {result:string}).result}`];
    return [];
  });
}

interface Props {
  patientId: string;
  lastReadings: Record<string, LastReading | null>;
}

export function PortalVitalsForm({ patientId, lastReadings }: Props) {
  const [type, setType] = useState<VitalType>("bp");
  const [fields, setFields] = useState<Fields>(DEFAULT_FIELDS);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedVitals | null>(null);
  const [extractError, setExtractError] = useState("");
  const [importMode, setImportMode] = useState<"image" | "text">("image");
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const warning = getSmartWarning(type, fields, lastReadings[type] ?? null);
  const isBlocked = warning?.severity === "error";

  function resetForm() {
    setFields(DEFAULT_FIELDS);
    setError("");
    setSuccess(false);
    setExtracted(null);
    setExtractError("");
    setPasteText("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isBlocked) return;
    setLoading(true);
    setError("");
    setSuccess(false);

    const result = await portalSubmitVital(buildInput(type, fields, patientId));
    if (result.success) {
      setSuccess(true);
      setFields(DEFAULT_FIELDS);
      setExtracted(null);
      setTimeout(() => setSuccess(false), 5000);
    } else {
      setError(result.error ?? "Something went wrong.");
    }
    setLoading(false);
  }

  async function handleFileExtract(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    setExtractError("");
    setExtracted(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/ai/extract-vitals", { method: "POST", body: fd });
      const json = await res.json() as { data?: ExtractedVitals; error?: string };
      if (!res.ok || json.error) {
        setExtractError(json.error ?? "Extraction failed.");
      } else if (json.data && Object.keys(json.data).length > 0) {
        setExtracted(json.data);
        const { fields: newFields, detectedType } = applyExtraction(json.data, fields);
        setFields(newFields);
        if (detectedType) setType(detectedType);
      } else {
        setExtractError("No vital signs found in this image. Try a clearer photo of your lab results.");
      }
    } catch {
      setExtractError("Could not read the file. Please try again.");
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleTextExtract() {
    if (!pasteText.trim()) return;
    setExtracting(true);
    setExtractError("");
    setExtracted(null);

    const fd = new FormData();
    fd.append("text", pasteText.trim());

    try {
      const res = await fetch("/api/ai/extract-vitals", { method: "POST", body: fd });
      const json = await res.json() as { data?: ExtractedVitals; error?: string };
      if (!res.ok || json.error) {
        setExtractError(json.error ?? "Extraction failed.");
      } else if (json.data && Object.keys(json.data).length > 0) {
        setExtracted(json.data);
        const { fields: newFields, detectedType } = applyExtraction(json.data, fields);
        setFields(newFields);
        if (detectedType) setType(detectedType);
      } else {
        setExtractError("No vital signs found in the text. Try pasting more of your report.");
      }
    } catch {
      setExtractError("Could not process the text. Please try again.");
    } finally {
      setExtracting(false);
    }
  }

  const summary = extracted ? extractedSummary(extracted) : [];

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        {/* AI Lab Import */}
        <div className="space-y-2 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-rose-500" />
              <span className="text-sm font-medium text-slate-700">Import from Lab Report</span>
            </div>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
              <button type="button"
                onClick={() => { setImportMode("image"); setExtractError(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${importMode === "image" ? "bg-rose-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                <ImageIcon className="w-3.5 h-3.5" />Image
              </button>
              <button type="button"
                onClick={() => { setImportMode("text"); setExtractError(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${importMode === "text" ? "bg-rose-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}>
                <FileText className="w-3.5 h-3.5" />Paste Text
              </button>
            </div>
          </div>

          {importMode === "image" ? (
            <label htmlFor="labfile" className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-dashed cursor-pointer transition-colors w-full ${
              extracting ? "opacity-50 pointer-events-none border-slate-200 text-slate-400" : "border-slate-200 text-slate-500 hover:border-rose-300 hover:text-rose-600"
            }`}>
              {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {extracting ? "Extracting…" : "Choose a photo of your lab results"}
              <input ref={fileRef} id="labfile" type="file" accept="image/jpeg,image/png,image/webp"
                className="hidden" onChange={handleFileExtract} disabled={extracting} />
            </label>
          ) : (
            <div className="space-y-2">
              <Textarea
                placeholder={"Paste text from your lab report, e.g.:\nBlood Pressure: 122/78 mmHg\nWeight: 158 lbs\nBlood Glucose: 95 mg/dL"}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={4}
                disabled={extracting}
                className="text-sm resize-none"
              />
              <Button type="button" variant="outline" size="sm"
                onClick={handleTextExtract}
                disabled={extracting || !pasteText.trim()}
                className="w-full border-rose-200 text-rose-700 hover:bg-rose-50">
                {extracting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Extracting…</> : <><Sparkles className="w-4 h-4 mr-2" />Extract Vitals</>}
              </Button>
            </div>
          )}
        </div>

        {extractError && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">{extractError}</p>
        )}

        {extracted && summary.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-800 mb-0.5">Found in your report:</p>
              <p className="text-sm text-emerald-700">{summary.join(" · ")}</p>
              <p className="text-xs text-emerald-600 mt-1">Fields are pre-filled below. Review, then save each reading.</p>
            </div>
            <button type="button" onClick={resetForm} className="text-emerald-500 hover:text-emerald-700 mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Vital type selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">What are you logging?</p>
            <div className="flex gap-2 flex-wrap">
              {VITAL_TABS.map((tab) => (
                <button key={tab.type} type="button"
                  onClick={() => { setType(tab.type); setError(""); setSuccess(false); }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    type === tab.type
                      ? "bg-rose-600 text-white border-rose-600"
                      : "text-slate-600 border-slate-200 hover:border-rose-300"
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <VitalFields type={type} fields={fields}
            onChange={(patch) => setFields((f) => ({ ...f, ...patch }))}
            warning={warning} />

          {error && <p className="text-sm text-red-600">{error}</p>}

          {success && (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4" />
              <p className="text-sm font-medium">Reading saved — your care team can see it.</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading || isBlocked} className="flex-1 bg-rose-600 hover:bg-rose-700">
              {loading
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                : <><Upload className="w-4 h-4 mr-2" />Save Reading</>}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>Clear</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
