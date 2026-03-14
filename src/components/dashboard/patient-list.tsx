"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PatientCard } from "@/components/dashboard/patient-card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, SlidersHorizontal } from "lucide-react";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import type { Patient, CareTask } from "@/generated/prisma/client";

type PatientData = Pick<
  Patient,
  | "id"
  | "firstName"
  | "lastName"
  | "dateOfBirth"
  | "gestationalAgeWeeks"
  | "dueDate"
  | "status"
  | "riskScore"
  | "riskLevel"
  | "lastContactAt"
  | "lastContactChannel"
  | "insuranceType"
> & {
  _count: { messages: number };
  careTasks: Pick<CareTask, "id" | "status" | "dueDate">[];
};

const SORT_OPTIONS = [
  { value: "riskScore_desc", label: "Risk: Highest first" },
  { value: "riskScore_asc", label: "Risk: Lowest first" },
  { value: "lastContact_asc", label: "Last contact: Oldest first" },
  { value: "dueDate_asc", label: "Due date: Soonest first" },
  { value: "name_asc", label: "Name: A–Z" },
];

const RISK_FILTER_OPTIONS = [
  { value: "all", label: "All risk levels" },
  { value: "VERY_HIGH", label: "Very High" },
  { value: "HIGH", label: "High" },
  { value: "MODERATE", label: "Moderate" },
  { value: "LOW", label: "Low" },
];

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "PREGNANT", label: "Pregnant" },
  { value: "POSTPARTUM", label: "Postpartum" },
  { value: "PRECONCEPTION", label: "Preconception" },
];

const PAGE_SIZE = 20;

export function PatientList({ patients }: { patients: PatientData[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("riskScore_desc");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [activeIndex, setActiveIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo<typeof patients>(() => {
    let list = [...patients];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.firstName.toLowerCase().includes(q) ||
          p.lastName.toLowerCase().includes(q)
      );
    }

    if (riskFilter !== "all") {
      list = list.filter((p) => p.riskLevel === riskFilter);
    }

    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }

    const [field, dir] = sortBy.split("_");
    list.sort((a, b) => {
      if (field === "riskScore") {
        return dir === "desc"
          ? b.riskScore - a.riskScore
          : a.riskScore - b.riskScore;
      }
      if (field === "lastContact") {
        const at = (a.lastContactAt?.getTime() ?? 0);
        const bt = (b.lastContactAt?.getTime() ?? 0);
        return dir === "asc" ? at - bt : bt - at;
      }
      if (field === "dueDate") {
        const ad = a.dueDate?.getTime() ?? Infinity;
        const bd = b.dueDate?.getTime() ?? Infinity;
        return ad - bd;
      }
      if (field === "name") {
        return `${a.lastName}${a.firstName}`.localeCompare(
          `${b.lastName}${b.firstName}`
        );
      }
      return 0;
    });

    return list;
  }, [patients, search, riskFilter, statusFilter, sortBy]);

  // Reset pagination + active index when filters change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setActiveIndex(-1);
  }, [search, riskFilter, statusFilter, sortBy]);

  const visiblePatients = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount]
  );

  const handleKeyJ = useCallback(() => {
    setActiveIndex((i) => Math.min(i + 1, visiblePatients.length - 1));
  }, [visiblePatients.length]);

  const handleKeyK = useCallback(() => {
    setActiveIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleEnter = useCallback(() => {
    if (activeIndex >= 0 && activeIndex < visiblePatients.length) {
      router.push(`/dashboard/patients/${visiblePatients[activeIndex].id}`);
    }
  }, [activeIndex, visiblePatients, router]);

  const handleSlash = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    searchRef.current?.focus();
  }, []);

  useKeyboardShortcuts([
    { key: "j", handler: handleKeyJ },
    { key: "ArrowDown", handler: handleKeyJ },
    { key: "k", handler: handleKeyK },
    { key: "ArrowUp", handler: handleKeyK },
    { key: "Enter", handler: handleEnter },
    { key: "/", handler: handleSlash },
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            ref={searchRef}
            placeholder="Search patients… (press / to focus)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-40">
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RISK_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-sm text-slate-500">
        Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} patients
        {filtered.length !== patients.length && ` (${patients.length} total)`}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">No patients match your filters.</p>
          <button
            onClick={() => {
              setSearch("");
              setRiskFilter("all");
              setStatusFilter("all");
            }}
            className="mt-2 text-sm text-rose-600 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {activeIndex >= 0 && (
            <p className="text-xs text-slate-400">
              Use <kbd className="px-1 bg-slate-100 border border-slate-200 rounded text-xs">j/k</kbd> to navigate,{" "}
              <kbd className="px-1 bg-slate-100 border border-slate-200 rounded text-xs">Enter</kbd> to open.
              Patient {activeIndex + 1} of {visiblePatients.length} selected.
            </p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {visiblePatients.map((patient, idx) => (
              <div
                key={patient.id}
                className={activeIndex === idx ? "ring-2 ring-rose-500 rounded-lg" : ""}
              >
                <PatientCard patient={patient} />
              </div>
            ))}
          </div>
          {visibleCount < filtered.length && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="text-sm text-rose-600 hover:text-rose-700 font-medium py-2 px-4 rounded-lg hover:bg-rose-50 transition-colors"
              >
                Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more patients
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
