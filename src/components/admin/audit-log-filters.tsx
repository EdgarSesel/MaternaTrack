"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface FilterParams {
  page?: string;
  action?: string;
  resource?: string;
  actorType?: string;
  dateFrom?: string;
  dateTo?: string;
  range?: string;
}

const RESOURCES = ["Patient", "CareTask", "Message", "Appointment", "CarePlan", "Screening", "Vital", "Provider", "VisitNote"];
const ACTOR_TYPES = ["provider", "patient", "system"];
const DATE_RANGES = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export function AuditLogFilters({ params }: { params: FilterParams }) {
  const router = useRouter();
  const pathname = usePathname();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams();
      // Preserve existing filters but reset page
      if (params.action && key !== "action") next.set("action", params.action);
      if (params.resource && key !== "resource") next.set("resource", params.resource);
      if (params.actorType && key !== "actorType") next.set("actorType", params.actorType);
      if (params.dateFrom && key !== "dateFrom" && key !== "range") next.set("dateFrom", params.dateFrom);
      if (params.dateTo && key !== "dateTo" && key !== "range") next.set("dateTo", params.dateTo);
      if (params.range && key !== "range" && key !== "dateFrom" && key !== "dateTo") next.set("range", params.range);
      if (value) next.set(key, value);
      // Clear date range if custom dates set and vice versa
      if (key === "range") { next.delete("dateFrom"); next.delete("dateTo"); }
      if (key === "dateFrom" || key === "dateTo") next.delete("range");
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router]
  );

  const hasFilters = !!(params.action || params.resource || params.actorType || params.dateFrom || params.dateTo || params.range);

  function clearAll() {
    router.push(pathname);
  }

  return (
    <div className="bg-white rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filters</span>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-slate-400" onClick={clearAll}>
            <X className="w-3 h-3" />
            Clear all
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {/* Action search */}
        <Input
          placeholder="Action (e.g. patient.view)"
          value={params.action ?? ""}
          onChange={(e) => update("action", e.target.value)}
          className="h-8 text-xs"
        />

        {/* Resource */}
        <Select
          value={params.resource ?? ""}
          onValueChange={(v) => update("resource", v === "_all" ? "" : v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All resources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All resources</SelectItem>
            {RESOURCES.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Actor type */}
        <Select
          value={params.actorType ?? ""}
          onValueChange={(v) => update("actorType", v === "_all" ? "" : v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="All actors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All actors</SelectItem>
            {ACTOR_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Quick date range */}
        <Select
          value={params.range ?? ""}
          onValueChange={(v) => update("range", v === "_all" ? "" : v)}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Any time" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Any time</SelectItem>
            {DATE_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Custom date range */}
        <div className="flex gap-1 col-span-2 md:col-span-1 lg:col-span-1">
          <Input
            type="date"
            value={params.dateFrom ?? ""}
            onChange={(e) => update("dateFrom", e.target.value)}
            className="h-8 text-xs"
            title="From date"
          />
          <Input
            type="date"
            value={params.dateTo ?? ""}
            onChange={(e) => update("dateTo", e.target.value)}
            className="h-8 text-xs"
            title="To date"
          />
        </div>
      </div>
    </div>
  );
}
