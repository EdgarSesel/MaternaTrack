"use client";

import { useState, useRef } from "react";

export interface UseAiStreamResult {
  text: string;
  isStreaming: boolean;
  error: string | null;
  start: (url: string, body: Record<string, unknown>) => Promise<void>;
  reset: () => void;
}

/**
 * Consumes a server-sent events stream from an AI API route.
 * Each event is `data: <JSON-encoded-string>\n\n` or `data: [DONE]\n\n`.
 */
export function useAiStream(): UseAiStreamResult {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function reset() {
    abortRef.current?.abort();
    setText("");
    setIsStreaming(false);
    setError(null);
  }

  async function start(url: string, body: Record<string, unknown>) {
    reset();
    abortRef.current = new AbortController();
    setIsStreaming(true);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setError("AI service unavailable. Try again later.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE blocks are separated by double newlines
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          for (const line of block.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              setIsStreaming(false);
              return;
            }
            try {
              const chunk = JSON.parse(data) as string;
              setText((prev) => prev + chunk);
            } catch {
              // ignore malformed chunk
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Connection failed. Please try again.");
      }
    } finally {
      setIsStreaming(false);
    }
  }

  return { text, isStreaming, error, start, reset };
}
