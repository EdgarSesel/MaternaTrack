"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, Sheet } from "lucide-react";
import { toast } from "sonner";

interface ExportButtonProps {
  patientId: string;
}

export function ExportButton({ patientId }: ExportButtonProps) {
  const [loading, setLoading] = useState<"pdf" | "csv" | null>(null);

  async function handleExport(type: "pdf" | "csv") {
    setLoading(type);
    try {
      const url =
        type === "pdf"
          ? `/api/export/patient-summary/${patientId}`
          : `/api/export/vitals/${patientId}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const ext = type === "pdf" ? "pdf" : "csv";
      const filename = `patient-summary.${ext}`;

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      toast.success(`${type.toUpperCase()} exported`);
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading !== null} className="gap-1.5">
          <Download className="w-3.5 h-3.5" />
          {loading ? "Exporting…" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleExport("pdf")}>
          <FileText className="w-3.5 h-3.5 text-rose-500" />
          PDF Clinical Summary
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleExport("csv")}>
          <Sheet className="w-3.5 h-3.5 text-green-600" />
          CSV Vitals Data
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
