"use client";

import { useTransition } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowRightLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { acceptHandoff } from "@/app/actions/handoff-actions";

interface HandoffItem {
  id: string;
  patientId: string;
  patientName: string;
  fromProviderName: string;
  summary: string;
  openConcerns: string | null;
  createdAt: Date;
}

interface IncomingHandoffsBannerProps {
  handoffs: HandoffItem[];
}

function HandoffCard({ h }: { h: HandoffItem }) {
  const [isPending, startTransition] = useTransition();

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptHandoff(h.id);
      if (result.success) {
        toast.success("Handoff accepted", {
          description: `${h.patientName} is now in your panel.`,
        });
      } else {
        toast.error("Failed to accept handoff", { description: result.error });
      }
    });
  }

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-b-0">
      <ArrowRightLeft className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/dashboard/patients/${h.patientId}`}
            className="font-medium text-sm text-slate-900 hover:text-rose-700"
          >
            {h.patientName}
          </Link>
          <span className="text-xs text-slate-400">
            from {h.fromProviderName} · {format(new Date(h.createdAt), "MMM d")}
          </span>
        </div>
        <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{h.summary}</p>
        {h.openConcerns && (
          <p className="text-xs text-amber-700 mt-0.5 line-clamp-1">
            ⚠ {h.openConcerns}
          </p>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 gap-1.5"
        onClick={handleAccept}
        disabled={isPending}
      >
        <CheckCircle className="w-3.5 h-3.5" />
        {isPending ? "Accepting…" : "Accept"}
      </Button>
    </div>
  );
}

export function IncomingHandoffsBanner({ handoffs }: IncomingHandoffsBannerProps) {
  if (handoffs.length === 0) return null;

  return (
    <Card className="border-rose-200 bg-rose-50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ArrowRightLeft className="w-4 h-4 text-rose-600" />
          <h3 className="text-sm font-semibold text-rose-900">
            Incoming Handoffs ({handoffs.length})
          </h3>
        </div>
        <div className="divide-y divide-rose-100">
          {handoffs.map((h) => (
            <HandoffCard key={h.id} h={h} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
