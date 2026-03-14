import { auth } from "@/lib/auth";
import { sseRegistry } from "@/lib/sse-registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE endpoint: GET /api/events/stream
 * Streams real-time notifications to the authenticated provider.
 * Each event: data: <JSON>\n\n
 * Keepalive ping every 25s to prevent proxy timeouts.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const recipientId = session.user.id;

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connected event
      const connected = `data: ${JSON.stringify({ type: "connected", recipientId })}\n\n`;
      controller.enqueue(new TextEncoder().encode(connected));

      // Register with SSE registry — push is called when a notification arrives
      const unregister = sseRegistry.register(recipientId, (payload) => {
        try {
          const line = `data: ${JSON.stringify(payload)}\n\n`;
          controller.enqueue(new TextEncoder().encode(line));
        } catch {
          // Stream closed
        }
      });

      // Keepalive every 25 seconds
      const ping = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(": ping\n\n"));
        } catch {
          clearInterval(ping);
          unregister();
        }
      }, 25_000);

      // Cleanup on close
      const cleanup = () => {
        clearInterval(ping);
        unregister();
      };

      // AbortSignal not directly available in ReadableStream start(), so we
      // attach cleanup to the controller's cancel hook instead.
      return cleanup;
    },
    cancel() {
      // Called when the client disconnects — cleanup is handled in start() return value
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
