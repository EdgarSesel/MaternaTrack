"use client";

import { useState, useEffect, useCallback } from "react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  patientId: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unread: number;
  loading: boolean;
  markAllRead: () => Promise<void>;
  markOneRead: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: Notification[]; unread: number };
      setNotifications(data.notifications);
      setUnread(data.unread);
    } catch {
      // Network error — silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Subscribe to SSE stream for real-time pushes
    const eventSource = new EventSource("/api/events/stream");

    eventSource.onmessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data as string) as { type: string };
        if (payload.type === "connected") return;
        // New notification arrived — re-fetch to get full list
        fetchNotifications();
      } catch {
        // Malformed event
      }
    };

    eventSource.onerror = () => {
      // SSE disconnected — will auto-reconnect; no action needed
    };

    return () => eventSource.close();
  }, [fetchNotifications]);

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_all_read" }),
    });
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })));
  }, []);

  const markOneRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnread((prev) => Math.max(0, prev - 1));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_read", id }),
    });
  }, []);

  return {
    notifications,
    unread,
    loading,
    markAllRead,
    markOneRead,
    refresh: fetchNotifications,
  };
}

