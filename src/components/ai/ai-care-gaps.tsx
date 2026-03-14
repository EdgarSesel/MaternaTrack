"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAiStream } from "@/hooks/use-ai-stream";
import { Sparkles, AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  patientId: string;
}

export function AiCareGaps({ patientId }: Props) {
  const { text, isStreaming, error, start, reset } = useAiStream();

  function handleAnalyze() {
    start("/api/ai/care-gaps", { patientId });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            AI Care Gap Analysis
          </span>
          {text && !isStreaming && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { reset(); start("/api/ai/care-gaps", { patientId }); }}
              className="h-7 text-xs text-slate-400 hover:text-slate-600"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Re-analyze
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!text && !isStreaming && !error && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Identify missing screenings, overdue tasks, and protocol gaps using
              evidence-based guidelines (ACOG, USPSTF, SMFM).
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleAnalyze}
              className="border-violet-200 text-violet-700 hover:bg-violet-50 flex-shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Analyze Gaps
            </Button>
          </div>
        )}

        {isStreaming && !text && (
          <div className="flex items-center gap-2 py-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-xs text-slate-400">Reviewing care plan…</span>
          </div>
        )}

        {(text || isStreaming) && (
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {text}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-slate-500">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
