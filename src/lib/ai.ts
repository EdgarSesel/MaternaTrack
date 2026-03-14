/**
 * Multi-provider AI abstraction.
 * Supports Groq (OpenAI-compatible, free) and Anthropic Claude.
 * Provider selected via AI_PROVIDER env var ("groq" | "anthropic").
 *
 * All streaming yields plain-text chunks. The API routes wrap them in SSE.
 */

// ---------------------------------------------------------------------------
// Rate limiter — simple in-memory counter, resets every 60 seconds
// ---------------------------------------------------------------------------

const rateCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit = 20): boolean {
  const now = Date.now();
  const entry = rateCounts.get(key);
  if (!entry || now > entry.resetAt) {
    rateCounts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Groq streaming (OpenAI-compatible SSE)
// ---------------------------------------------------------------------------

async function* streamGroq(
  system: string,
  userMessage: string,
  maxTokens: number,
): AsyncGenerator<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return;

  let response: Response;
  try {
    response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage },
        ],
        stream: true,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return;
  }

  if (!response.ok || !response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data) as {
            choices: { delta: { content?: string } }[];
          };
          const content = parsed.choices[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // ignore malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Anthropic streaming (Messages API SSE)
// ---------------------------------------------------------------------------

async function* streamAnthropic(
  system: string,
  userMessage: string,
  maxTokens: number,
): AsyncGenerator<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return;

  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
        system,
        messages: [{ role: "user", content: userMessage }],
        stream: true,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return;
  }

  if (!response.ok || !response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        try {
          const parsed = JSON.parse(data) as {
            type: string;
            delta?: { type: string; text: string };
          };
          if (
            parsed.type === "content_block_delta" &&
            parsed.delta?.type === "text_delta"
          ) {
            yield parsed.delta.text;
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GenerateStreamOptions {
  system: string;
  userMessage: string;
  maxTokens?: number;
}

/**
 * Returns a ReadableStream<string> of text chunks.
 * Returns null if AI is unavailable, not configured, or rate-limited.
 * Callers (API routes) wrap chunks in SSE format.
 */
export function generateStream(
  options: GenerateStreamOptions,
): ReadableStream<string> | null {
  const provider = process.env.AI_PROVIDER ?? "groq";

  const apiKey =
    provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : process.env.GROQ_API_KEY;

  if (!apiKey) return null;
  if (!checkRateLimit(provider)) return null;

  const { system, userMessage, maxTokens = 600 } = options;
  const gen =
    provider === "anthropic"
      ? streamAnthropic(system, userMessage, maxTokens)
      : streamGroq(system, userMessage, maxTokens);

  return new ReadableStream<string>({
    async pull(controller) {
      try {
        const { done, value } = await gen.next();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value ?? "");
        }
      } catch {
        controller.close();
      }
    },
  });
}

/**
 * Converts a ReadableStream<string> to an SSE Response.
 * Each chunk is sent as `data: <url-encoded-chunk>\n\n`.
 * Streams end with `data: [DONE]\n\n`.
 */
export function toSSEResponse(
  stream: ReadableStream<string>,
  onComplete?: (fullText: string) => void,
): Response {
  const encoder = new TextEncoder();
  let accumulated = "";

  const sseBody = new ReadableStream({
    async start(controller) {
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            onComplete?.(accumulated);
            controller.close();
            break;
          }
          accumulated += value;
          // JSON-encode the chunk so newlines and special chars survive SSE
          const encoded = JSON.stringify(value);
          controller.enqueue(encoder.encode(`data: ${encoded}\n\n`));
        }
      } catch {
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
  });

  return new Response(sseBody, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
