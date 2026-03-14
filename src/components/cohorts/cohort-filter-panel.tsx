"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, SlidersHorizontal } from "lucide-react";

const RISK_LEVELS = ["LOW", "MODERATE", "HIGH", "VERY_HIGH"] as const;
const STATUSES = ["PREGNANT", "POSTPARTUM", "PRECONCEPTION", "INACTIVE"] as const;
const LAST_CONTACT_OPTIONS = [
  { label: "7 days", value: "7" },
  { label: "14 days", value: "14" },
  { label: "30 days", value: "30" },
  { label: "Never contacted", value: "never" },
];
const MISSING_SCREENING_OPTIONS = [
  { label: "PHQ-9 / EPDS (depression)", value: "phq9" },
  { label: "GDM screening", value: "gdm_screen" },
  { label: "SDOH screening", value: "sdoh" },
];
const DUE_SOON_OPTIONS = [
  { label: "Next 14 days", value: "14" },
  { label: "Next 30 days", value: "30" },
  { label: "Next 60 days", value: "60" },
];

export function CohortFilterPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "" || value === "any") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const toggleListParam = useCallback(
    (key: string, item: string) => {
      const current = searchParams.get(key)?.split(",").filter(Boolean) ?? [];
      const next = current.includes(item)
        ? current.filter((v) => v !== item)
        : [...current, item];
      updateParam(key, next.length > 0 ? next.join(",") : null);
    },
    [searchParams, updateParam],
  );

  const activeRiskLevels = searchParams.get("riskLevel")?.split(",").filter(Boolean) ?? [];
  const activeStatuses = searchParams.get("status")?.split(",").filter(Boolean) ?? [];
  const hasOverdueTasks = searchParams.get("hasOverdueTasks") === "1";
  const hasHousing = searchParams.get("housing") === "1";
  const hasFood = searchParams.get("food") === "1";
  const hasTransport = searchParams.get("transport") === "1";
  const hasIPV = searchParams.get("ipv") === "1";
  const lastContact = searchParams.get("lastContact") ?? "";
  const missingScreening = searchParams.get("missingScreening") ?? "";
  const dueSoon = searchParams.get("dueSoon") ?? "";

  const hasFilters = searchParams.toString().length > 0;

  function clearAll() {
    router.push(pathname);
  }

  return (
    <aside className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Filters</span>
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-7 px-2 text-slate-500">
            <X className="w-3 h-3 mr-1" />
            Clear all
          </Button>
        )}
      </div>

      {/* Risk Level */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          Risk Level
        </Label>
        <div className="space-y-1.5">
          {RISK_LEVELS.map((level) => (
            <label key={level} className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={activeRiskLevels.includes(level)}
                onCheckedChange={() => toggleListParam("riskLevel", level)}
              />
              <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
                {level.replace("_", " ")}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Patient Status */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          Patient Status
        </Label>
        <div className="space-y-1.5">
          {STATUSES.map((status) => (
            <label key={status} className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={activeStatuses.includes(status)}
                onCheckedChange={() => toggleListParam("status", status)}
              />
              <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100">
                {status.charAt(0) + status.slice(1).toLowerCase()}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Last Contact */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          Last Contact
        </Label>
        <Select value={lastContact || "any"} onValueChange={(v) => updateParam("lastContact", v)}>
          <SelectTrigger className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700">
            <SelectValue placeholder="Any time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any time</SelectItem>
            {LAST_CONTACT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                No contact in {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Missing Screening */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          Missing Screening (90 days)
        </Label>
        <Select
          value={missingScreening || "any"}
          onValueChange={(v) => updateParam("missingScreening", v)}
        >
          <SelectTrigger className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any / not filtered</SelectItem>
            {MISSING_SCREENING_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                Missing {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Due Date Soon */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          Due Date
        </Label>
        <Select value={dueSoon || "any"} onValueChange={(v) => updateParam("dueSoon", v)}>
          <SelectTrigger className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any / not filtered</SelectItem>
            {DUE_SOON_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Care & Engagement */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          Care & Engagement
        </Label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <Checkbox
            checked={hasOverdueTasks}
            onCheckedChange={(v) => updateParam("hasOverdueTasks", v ? "1" : null)}
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">Has overdue tasks</span>
        </label>
      </div>

      {/* SDOH Flags */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
          SDOH Flags
        </Label>
        <div className="space-y-1.5">
          {[
            { label: "Housing instability", key: "housing", active: hasHousing },
            { label: "Food insecurity", key: "food", active: hasFood },
            { label: "Transportation barrier", key: "transport", active: hasTransport },
            { label: "Intimate partner violence", key: "ipv", active: hasIPV },
          ].map(({ label, key, active }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer group">
              <Checkbox
                checked={active}
                onCheckedChange={(v) => updateParam(key, v ? "1" : null)}
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}
