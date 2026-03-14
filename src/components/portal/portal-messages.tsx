"use client";

import { useState, useRef, useEffect } from "react";
import { portalSendMessage } from "@/app/portal/actions/portal-patient-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Message } from "@/generated/prisma/client";

interface PortalMessagesProps {
  messages: Message[];
  patientId: string;
  patientUserId: string;
  patientFirstName: string;
}

export function PortalMessages({
  messages,
  patientId,
  patientFirstName,
}: PortalMessagesProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!content.trim()) return;
    setSending(true);
    setError("");

    const result = await portalSendMessage({ patientId, content: content.trim() });
    if (result.success) {
      setContent("");
    } else {
      setError(result.error ?? "Failed to send.");
    }
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="space-y-4">
      {/* Message thread */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="max-h-96 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">
              No messages yet. Say hello to your care team!
            </p>
          ) : (
            messages.map((msg) => {
              const isFromPatient = msg.senderType === "PATIENT";
              return (
                <div
                  key={msg.id}
                  className={cn("flex", isFromPatient ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-xs sm:max-w-sm rounded-2xl px-4 py-2.5 text-sm",
                      isFromPatient
                        ? "bg-rose-600 text-white rounded-br-sm"
                        : "bg-slate-100 text-slate-800 rounded-bl-sm"
                    )}
                  >
                    <p className="leading-snug">{msg.content}</p>
                    <p
                      className={cn(
                        "text-xs mt-1",
                        isFromPatient ? "text-rose-200" : "text-slate-400"
                      )}
                    >
                      {isFromPatient ? patientFirstName : "Care team"} ·{" "}
                      {format(new Date(msg.createdAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Compose */}
        <div className="border-t border-slate-100 p-3 flex gap-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            rows={2}
            className="resize-none text-sm"
            disabled={sending}
          />
          <Button
            onClick={handleSend}
            disabled={sending || !content.trim()}
            className="bg-rose-600 hover:bg-rose-700 self-end shrink-0"
            size="sm"
          >
            Send
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
