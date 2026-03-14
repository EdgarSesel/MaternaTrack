"use client";

import { useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAiStream } from "@/hooks/use-ai-stream";
import { saveAiSummary } from "@/app/actions/patient-actions";
import { formatDistanceToNow } from "date-fns";
import { Sparkles, RefreshCw, AlertCircle, Clock } from "lucide-react";

interface Props {
  patientId: string;
  initialSummary: string | null;
  summaryAt: Date | null;
  /** Reason why the summary may be outdated, or null if current */
  staleReason: string | null;
}

export function AiRiskSummary({
  patientId,
  initialSummary,
  summaryAt,
  staleReason,
}: Props) {
  const { text, isStreaming, error, start, reset } = useAiStream();
  const [, startSave] = useTransition();

  // After streaming finishes, persist the new summary to the database
  useEffect(() => {
    if (!isStreaming && text) {
      startSave(async () => {
        await saveAiSummary({ patientId, summary: text });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  function handleGenerate() {
    start("/api/ai/risk-summary", { patientId });
  }

  function handleRefresh() {
    reset();
    start("/api/ai/risk-summary", { patientId });
  }

  // What to show as the summary text
  const displayText = text || initialSummary;
  const isLive = !!text; // currently streamed or just streamed
  const hasExisting = !!initialSummary && !text;

  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            AI Clinical Summary
          </span>

          <div className="flex items-center gap-2">
            {/* Stale indicator */}
            {hasExisting && staleReason && !isStreaming && (
              <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3" />
                Update recommended
              </span>
            )}

            {/* Last updated */}
            {summaryAt && !text && (
              <span className="flex items-center gap-1 text-xs text-slate-400 font-normal">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(summaryAt, { addSuffix: true })}
              </span>
            )}

            {/* Refresh button */}
            {(displayText || staleReason) && !isStreaming && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                className="h-7 text-xs text-slate-400 hover:text-slate-600"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {staleReason ? "Update now" : "Refresh"}
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Stale reason detail */}
        {hasExisting && staleReason && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-3">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{staleReason} — consider refreshing the AI summary.</span>
          </div>
        )}

        {/* No summary yet */}
        {!displayText && !isStreaming && !error && (
          <div className="flex flex-col items-center justify-center py-6 gap-3">
            <p className="text-xs text-slate-400 text-center max-w-xs">
              Generate an AI-powered clinical summary based on this patient&apos;s
              current risk profile, vitals, and care plan status.
            </p>
            <Button
              size="sm"
              onClick={handleGenerate}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Generate Summary
            </Button>
          </div>
        )}

        {/* Streaming loading dots */}
        {isStreaming && !text && (
          <div className="flex items-center gap-2 py-4">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-slate-400">Analyzing patient data…</span>
          </div>
        )}

        {/* Summary text */}
        {displayText && (
          <div className="text-sm text-slate-700 leading-relaxed">
            {displayText}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-pulse align-middle" />
            )}
            {isLive && !isStreaming && (
              <span className="ml-2 text-xs text-violet-500 font-medium">
                ✓ Saved
              </span>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 text-xs text-slate-500 py-2">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
