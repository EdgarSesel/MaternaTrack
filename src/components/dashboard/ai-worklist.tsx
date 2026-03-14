"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useAiStream } from "@/hooks/use-ai-stream";

export function AiDailyWorklist() {
  const [expanded, setExpanded] = useState(false);
  const { text, isStreaming, error, start, reset } = useAiStream();

  async function generate() {
    setExpanded(true);
    reset();
    await start("/api/ai/daily-worklist", {});
  }

  const hasContent = text.length > 0;

  // Parse urgency lines for color coding
  function renderLine(line: string, idx: number) {
    const isUrgent = line.includes("🔴") || line.toLowerCase().includes("urgent");
    const isToday = line.includes("🟡") || line.toLowerCase().includes("today:");
    const borderColor = isUrgent
      ? "border-l-red-400"
      : isToday
        ? "border-l-amber-400"
        : "border-l-slate-300 dark:border-l-slate-600";

    if (!line.trim()) return <div key={idx} className="h-1" />;

    return (
      <p
        key={idx}
        className={`text-sm text-slate-700 dark:text-slate-300 leading-relaxed pl-3 border-l-2 ${borderColor} py-0.5`}
      >
        {line}
      </p>
    );
  }

  return (
    <Card className="border-purple-100 dark:border-purple-900/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI Daily Worklist
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasContent && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? (
                  <><ChevronUp className="w-3 h-3 mr-1" /> Collapse</>
                ) : (
                  <><ChevronDown className="w-3 h-3 mr-1" /> Expand</>
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30"
              onClick={generate}
              disabled={isStreaming}
            >
              {isStreaming ? (
                <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Analyzing…</>
              ) : hasContent ? (
                <><RefreshCw className="w-3 h-3 mr-1.5" /> Refresh</>
              ) : (
                <><Sparkles className="w-3 h-3 mr-1.5" /> Generate</>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!hasContent && !isStreaming && (
        <CardContent className="pt-0">
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-3">
            Click Generate to get AI-powered daily priorities for your panel.
          </p>
        </CardContent>
      )}

      {error && (
        <CardContent className="pt-0">
          <p className="text-xs text-red-500">{error}</p>
        </CardContent>
      )}

      {(hasContent || isStreaming) && expanded && (
        <CardContent className="pt-0">
          <div className="space-y-1.5">
            {text
              .split("\n")
              .map((line, idx) => renderLine(line, idx))}
            {isStreaming && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 pt-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Analyzing panel…
              </div>
            )}
          </div>
        </CardContent>
      )}

      {hasContent && !expanded && !isStreaming && (
        <CardContent className="pt-0">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {text.split("\n").filter(Boolean).length} action items generated.{" "}
            <button
              className="text-purple-600 dark:text-purple-400 hover:underline"
              onClick={() => setExpanded(true)}
            >
              Show all
            </button>
          </p>
        </CardContent>
      )}
    </Card>
  );
}
