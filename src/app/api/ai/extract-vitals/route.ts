import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedMimeType = (typeof ALLOWED_IMAGE_TYPES)[number];

const JSON_SHAPE = `{
  "bp": { "systolic": number, "diastolic": number },
  "glucose": { "value": number, "context": "fasting"|"post_meal_1h"|"post_meal_2h"|"bedtime"|"random" },
  "weight": { "value": number, "unit": "lbs"|"kg" },
  "heart_rate": { "value": number },
  "temperature": { "value": number, "unit": "F"|"C" },
  "oxygen_saturation": { "value": number },
  "urine_protein": { "result": "negative"|"trace"|"1+"|"2+"|"3+"|"4+" }
}`;

const EXTRACTION_INSTRUCTIONS = `You are a clinical data extraction assistant. Extract any vital sign values clearly present in this content.
Return ONLY valid JSON (no markdown) matching this shape — include ONLY fields you can confidently identify:
${JSON_SHAPE}
Rules: glucose in mg/dL (mmol/L × 18), omit anything unclear, return {} if nothing found.`;

function parseJsonResponse(raw: string): Record<string, unknown> {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned) as Record<string, unknown>; } catch { return {}; }
}

async function extractWithAnthropicVision(base64: string, mediaType: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set — add it to your .env to use image extraction");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: EXTRACTION_INSTRUCTIONS },
      ]}],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const body = await res.json() as { content?: { text?: string }[] };
  return parseJsonResponse(body.content?.[0]?.text ?? "{}");
}

async function extractWithGroqVision(base64: string, mediaType: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");
  const model = process.env.GROQ_VISION_MODEL ?? "llama-3.2-90b-vision-preview";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model, max_tokens: 512,
      messages: [{ role: "user", content: [
        { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
        { type: "text", text: EXTRACTION_INSTRUCTIONS },
      ]}],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Groq vision error ${res.status}`);
  const body = await res.json() as { choices?: { message?: { content?: string } }[] };
  return parseJsonResponse(body.choices?.[0]?.message?.content ?? "{}");
}

async function extractFromTextGroq(text: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not set");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      max_tokens: 512,
      messages: [{ role: "user", content: `${EXTRACTION_INSTRUCTIONS}\n\nDocument:\n${text}` }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const body = await res.json() as { choices?: { message?: { content?: string } }[] };
  return parseJsonResponse(body.choices?.[0]?.message?.content ?? "{}");
}

async function extractFromTextAnthropic(text: string): Promise<Record<string, unknown>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: `${EXTRACTION_INSTRUCTIONS}\n\nDocument:\n${text}` }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Anthropic error ${res.status}`);
  const body = await res.json() as { content?: { text?: string }[] };
  return parseJsonResponse(body.content?.[0]?.text ?? "{}");
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return Response.json({ error: "Invalid form data" }, { status: 400 }); }

  const file = formData.get("file");
  const text = formData.get("text");
  const provider = process.env.AI_PROVIDER ?? "groq";

  try {
    // ── Text extraction (works with either provider) ─────────────────────
    if (text && typeof text === "string" && text.trim().length > 0) {
      const extracted = provider === "anthropic"
        ? await extractFromTextAnthropic(text.trim())
        : await extractFromTextGroq(text.trim());
      return Response.json({ data: extracted });
    }

    // ── Image extraction (vision model required) ─────────────────────────
    if (!(file instanceof File)) {
      return Response.json({ error: "Provide a file or paste text" }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedMimeType)) {
      return Response.json({ error: "Only JPEG, PNG, WEBP or GIF images are supported" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return Response.json({ error: "File too large (max 5 MB)" }, { status: 400 });
    }

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const extracted = provider === "anthropic"
      ? await extractWithAnthropicVision(base64, file.type)
      : await extractWithGroqVision(base64, file.type);

    return Response.json({ data: extracted });
  } catch (err) {
    logger.error("extract-vitals error", { error: err });
    const msg = err instanceof Error ? err.message : "Extraction failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
