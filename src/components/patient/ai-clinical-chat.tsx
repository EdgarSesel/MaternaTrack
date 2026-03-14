"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAiStream } from "@/hooks/use-ai-stream";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  patientId: string;
  patientName: string;
}

export function AiClinicalChat({ patientId, patientName }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [isWaitingForStream, setIsWaitingForStream] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const aiStream = useAiStream();

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Track streaming state
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setStreamingContent(aiStream.text);
  }, [aiStream.text]);

  // When streaming is done, commit message to history
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (!aiStream.isStreaming && isWaitingForStream && aiStream.text) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: aiStream.text },
      ]);
      setStreamingContent("");
      setIsWaitingForStream(false);
      aiStream.reset();
    }
  }, [aiStream.isStreaming, isWaitingForStream, aiStream.text, aiStream]);

  async function handleSend() {
    const question = inputValue.trim();
    if (!question || aiStream.isStreaming || isWaitingForStream) return;

    const newUserMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, newUserMessage]);
    setInputValue("");
    setIsWaitingForStream(true);

    await aiStream.start("/api/ai/clinical-chat", {
      patientId,
      messages,
      question,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleClose() {
    setIsOpen(false);
    // Keep conversation history when closing
  }

  function handleClear() {
    setMessages([]);
    setStreamingContent("");
    setIsWaitingForStream(false);
    aiStream.reset();
  }

  const isLoading = aiStream.isStreaming || isWaitingForStream;

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-sm font-medium rounded-full shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
        aria-label="Open AI Clinical Copilot"
      >
        <Sparkles className="w-4 h-4" />
        AI Copilot
        {messages.length > 0 && (
          <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-500 rounded-full">
            {messages.filter((m) => m.role === "assistant").length}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-6 z-50 w-[380px] max-h-[480px] flex flex-col bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
          role="dialog"
          aria-label="AI Clinical Copilot"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-purple-600 text-white shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <div>
                <p className="text-sm font-semibold leading-tight">AI Clinical Copilot</p>
                <p className="text-xs text-purple-200 leading-tight">{patientName}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  className="text-xs text-purple-200 hover:text-white px-2 py-1 rounded hover:bg-purple-700 transition-colors"
                  title="Clear conversation"
                >
                  Clear
                </button>
              )}
              <button
                onClick={handleClose}
                className="p-1 rounded hover:bg-purple-700 transition-colors"
                aria-label="Close AI Copilot"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {/* Empty state */}
            {messages.length === 0 && !streamingContent && (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <Sparkles className="w-8 h-8 text-purple-300 mb-3" />
                <p className="text-sm font-medium text-slate-600">Ask me anything about this patient&apos;s clinical data</p>
                <p className="text-xs text-slate-400 mt-1">Vitals, screenings, risk factors, care tasks</p>
                <div className="mt-4 flex flex-col gap-1.5 w-full">
                  {[
                    "What's the current BP trend?",
                    "Any overdue screenings?",
                    "What are the top risk factors?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInputValue(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="text-xs text-left px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-purple-300 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message history */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-purple-600 text-white rounded-br-sm"
                      : "bg-slate-100 text-slate-800 rounded-bl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Streaming response bubble */}
            {(streamingContent || (isLoading && !streamingContent)) && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-3 py-2 rounded-lg rounded-bl-sm bg-slate-100 text-slate-800 text-sm leading-relaxed">
                  {streamingContent || (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Thinking&hellip;
                    </span>
                  )}
                  {aiStream.isStreaming && (
                    <span className="inline-block w-0.5 h-3.5 bg-purple-500 animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              </div>
            )}

            {/* Error message */}
            {aiStream.error && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200">
                  {aiStream.error}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="px-3 py-3 border-t border-slate-100 bg-white shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about this patient…"
                disabled={isLoading}
                className="flex-1 text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <Button
                size="sm"
                onClick={() => void handleSend()}
                disabled={!inputValue.trim() || isLoading}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
