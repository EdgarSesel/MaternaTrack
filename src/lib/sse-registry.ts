/**
 * In-memory SSE connection registry.
 * Maps recipientId → set of writer callbacks.
 *
 * Note: This is per-instance. For multi-instance deployments, replace with Redis pub/sub.
 */

type SSEPayload = {
  id: string;
  type: string;
  title: string;
  body?: string;
  patientId?: string;
  createdAt: string;
};

type WriterFn = (payload: SSEPayload) => void;

class SSERegistry {
  private connections = new Map<string, Set<WriterFn>>();

  register(recipientId: string, writer: WriterFn): () => void {
    if (!this.connections.has(recipientId)) {
      this.connections.set(recipientId, new Set());
    }
    this.connections.get(recipientId)!.add(writer);

    // Return cleanup function
    return () => {
      const writers = this.connections.get(recipientId);
      if (writers) {
        writers.delete(writer);
        if (writers.size === 0) this.connections.delete(recipientId);
      }
    };
  }

  push(recipientId: string, payload: SSEPayload): void {
    const writers = this.connections.get(recipientId);
    if (!writers) return;
    for (const write of writers) {
      try {
        write(payload);
      } catch {
        // Connection may be closed — ignore
      }
    }
  }

  connectionCount(recipientId: string): number {
    return this.connections.get(recipientId)?.size ?? 0;
  }
}

// Singleton — lives for the lifetime of the Node.js process
export const sseRegistry = new SSERegistry();
