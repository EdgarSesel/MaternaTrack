"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAiStream } from "@/hooks/use-ai-stream";
import { Sparkles, Check, X } from "lucide-react";

interface Props {
  patientId: string;
  onUseDraft: (text: string) => void;
}

export function AiMessageDraft({ patientId, onUseDraft }: Props) {
  const [context, setContext] = useState("");
  const [showContext, setShowContext] = useState(false);
  const { text, isStreaming, error, start, reset } = useAiStream();

  function handleDraft() {
    start("/api/ai/message-draft", {
      patientId,
      context: context.trim() || undefined,
    });
    setShowContext(false);
  }

  function handleUseDraft() {
    onUseDraft(text);
    reset();
    setContext("");
  }

  function handleDiscard() {
    reset();
    setContext("");
    setShowContext(false);
  }

  // Idle state — show the draft button
  if (!text && !isStreaming && !error && !showContext) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowContext(true)}
        className="h-7 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
        type="button"
      >
        <Sparkles className="w-3.5 h-3.5 mr-1" />
        Draft with AI
      </Button>
    );
  }

  // Context input
  if (showContext && !text && !isStreaming) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Reason for outreach (optional)…"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleDraft();
            if (e.key === "Escape") setShowContext(false);
          }}
          className="flex-1 min-w-0 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400"
          maxLength={200}
          autoFocus
        />
        <Button
          size="sm"
          onClick={handleDraft}
          className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
          type="button"
        >
          <Sparkles className="w-3 h-3 mr-1" />
          Draft
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowContext(false)}
          className="h-7 text-xs text-slate-400"
          type="button"
        >
          Cancel
        </Button>
      </div>
    );
  }

  // Streaming state
  if (isStreaming || text) {
    return (
      <div className="border border-violet-200 rounded-lg p-3 bg-violet-50 space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-xs font-medium text-violet-700">AI Draft</span>
          {isStreaming && (
            <div className="flex gap-0.5 ml-1">
              <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-1 h-1 bg-violet-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          )}
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">
          {text}
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-pulse align-middle" />
          )}
        </p>
        {!isStreaming && text && (
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              onClick={handleUseDraft}
              className="h-7 text-xs bg-violet-600 hover:bg-violet-700"
              type="button"
            >
              <Check className="w-3 h-3 mr-1" />
              Use this draft
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDiscard}
              className="h-7 text-xs text-slate-400"
              type="button"
            >
              <X className="w-3 h-3 mr-1" />
              Discard
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">{error}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDiscard}
          className="h-6 text-xs text-slate-400"
          type="button"
        >
          Dismiss
        </Button>
      </div>
    );
  }

  return null;
}
