"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAiStream } from "@/hooks/use-ai-stream";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import type { AnalyticsData } from "@/app/dashboard/analytics/page";

interface Props {
  data: AnalyticsData;
}

export function AiPanelSummary({ data }: Props) {
  const { text, isStreaming, error, start, reset } = useAiStream();

  const highRisk = data.riskDistribution.HIGH + data.riskDistribution.VERY_HIGH;
  const urgentContext =
    highRisk > 0 || data.overdueTasks > 0 || data.notContactedIn14Days > 3;

  function handleGenerate() {
    start("/api/ai/panel-summary", {});
  }

  function handleRefresh() {
    reset();
    start("/api/ai/panel-summary", {});
  }

  return (
    <Card className={urgentContext && !text ? "border-amber-200 bg-amber-50/30" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            AI Panel Intelligence
          </span>
          {text && !isStreaming && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="h-7 text-xs text-slate-400 hover:text-slate-600"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {!text && !isStreaming && !error && (
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              Get an AI-powered overview of your panel&apos;s health, engagement trends,
              and the most urgent actions to take across your {data.totalPatients} patients.
            </p>
            <Button
              size="sm"
              onClick={handleGenerate}
              className="bg-violet-600 hover:bg-violet-700 text-white shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Analyze Panel
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
            <span className="text-xs text-slate-400">Analyzing your panel…</span>
          </div>
        )}

        {(text || isStreaming) && (
          <div className="text-sm text-slate-700 leading-relaxed">
            {text}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-slate-500">
            <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
