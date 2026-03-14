"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendMessage, markMessagesRead } from "@/app/actions/patient-actions";
import type { Message } from "@/generated/prisma/client";
import { Send, MessageSquare, User, Bot, Search, X, Circle, FileText } from "lucide-react";
import { AiMessageDraft } from "@/components/ai/ai-message-draft";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MESSAGE_TEMPLATES,
  applyTemplateVariables,
  CATEGORY_LABELS,
} from "@/lib/message-templates";

interface Props {
  messages: Message[];
  patientId: string;
  patientFirstName?: string;
}

function MessageBubble({ message, highlighted }: { message: Message; highlighted?: boolean }) {
  const isProvider = message.senderType === "PROVIDER";
  const isSystem = message.senderType === "SYSTEM";
  const isUnread = message.senderType === "PATIENT" && !message.readAt;

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1 rounded-full flex items-center gap-1.5">
          <Bot className="w-3 h-3" />
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 ${isProvider ? "flex-row-reverse" : "flex-row"}`}>
      <div className="relative">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
            isProvider ? "bg-rose-100" : "bg-slate-100"
          }`}
        >
          <User
            className={`w-3.5 h-3.5 ${isProvider ? "text-rose-600" : "text-slate-500"}`}
          />
        </div>
        {isUnread && (
          <Circle className="w-2.5 h-2.5 text-rose-500 fill-rose-500 absolute -top-0.5 -right-0.5" />
        )}
      </div>

      <div className={`max-w-[75%] ${isProvider ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed transition-colors ${
            highlighted
              ? "ring-2 ring-yellow-400"
              : ""
          } ${
            isProvider
              ? "bg-rose-600 text-white rounded-tr-sm"
              : isUnread
              ? "bg-white border-2 border-rose-200 text-slate-800 rounded-tl-sm"
              : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
          }`}
        >
          {message.content}
        </div>
        <div className={`flex items-center gap-1.5 mt-1 px-1 ${isProvider ? "flex-row-reverse" : ""}`}>
          <span className="text-xs text-slate-400">
            {format(new Date(message.createdAt), "MMM d, h:mm a")}
          </span>
          {isUnread && (
            <span className="text-xs font-medium text-rose-500">Unread</span>
          )}
        </div>
      </div>
    </div>
  );
}

const MESSAGES_PAGE_SIZE = 30;

// Group templates by category
const TEMPLATE_GROUPS = Object.entries(CATEGORY_LABELS).map(([cat, label]) => ({
  category: cat as keyof typeof CATEGORY_LABELS,
  label,
  templates: MESSAGE_TEMPLATES.filter((t) => t.category === cat),
})).filter((g) => g.templates.length > 0);

export function MessagesTab({ messages, patientId, patientFirstName }: Props) {
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [messageOffset, setMessageOffset] = useState(() =>
    Math.max(0, messages.length - MESSAGES_PAGE_SIZE)
  );

  const unreadCount = messages.filter(
    (m) => m.senderType === "PATIENT" && !m.readAt
  ).length;

  // Auto-mark messages as read when tab is opened
  useEffect(() => {
    if (unreadCount > 0) {
      markMessagesRead(patientId).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current && !searchQuery) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, searchQuery]);

  const filteredMessages = searchQuery.trim()
    ? messages.filter((m) =>
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  const highlightedIds = searchQuery.trim()
    ? new Set(filteredMessages.map((m) => m.id))
    : new Set<string>();

  // Paginated view: show messages from offset onward
  const visibleMessages = searchQuery.trim()
    ? filteredMessages
    : messages.slice(messageOffset);

  const hiddenCount = searchQuery.trim() ? 0 : messageOffset;

  function handleSend() {
    const content = draft.trim();
    if (!content) return;

    startTransition(async () => {
      const result = await sendMessage({ patientId, content });
      if (result.success) {
        setDraft("");
        toast.success("Message sent");
      } else {
        toast.error(result.error ?? "Failed to send message");
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className="flex flex-col bg-white border border-slate-200 rounded-lg overflow-hidden"
      style={{ height: "560px" }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Patient Messages</span>
          <span className="text-xs text-slate-400">({messages.length} total)</span>
          {unreadCount > 0 && (
            <span className="ml-auto text-xs font-medium bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>

        {/* Search bar */}
        {messages.length > 0 && (
          <div className="mt-2 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search messages…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-md pl-8 pr-7 py-1.5 focus:outline-none focus:ring-1 focus:ring-rose-400 focus:border-rose-400 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {searchQuery && (
          <p className="text-xs text-slate-400 mt-1">
            {filteredMessages.length} result{filteredMessages.length !== 1 ? "s" : ""} for &quot;{searchQuery}&quot;
          </p>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-slate-400 text-sm">No messages yet.</p>
            <p className="text-slate-400 text-xs mt-1">
              Send the first message to start the conversation.
            </p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Search className="w-8 h-8 text-slate-200 mb-2" />
            <p className="text-slate-400 text-sm">No messages match &quot;{searchQuery}&quot;</p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs text-rose-500 hover:text-rose-600 mt-1 underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <>
            {hiddenCount > 0 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() =>
                    setMessageOffset((o) => Math.max(0, o - MESSAGES_PAGE_SIZE))
                  }
                  className="text-xs text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-full px-3 py-1 hover:bg-slate-50 transition-colors"
                >
                  Load {Math.min(MESSAGES_PAGE_SIZE, hiddenCount)} earlier messages ({hiddenCount} hidden)
                </button>
              </div>
            )}
            {visibleMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                highlighted={searchQuery ? highlightedIds.has(msg.id) : false}
              />
            ))}
          </>
        )}
      </div>

      {/* Composer — hidden when searching */}
      {!searchQuery && (
        <div className="border-t border-slate-200 p-3 bg-white">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent placeholder:text-slate-400 leading-relaxed"
                rows={2}
                disabled={isPending}
                maxLength={2000}
              />
              <span className="absolute bottom-2 right-3 text-xs text-slate-300">
                {draft.length}/2000
              </span>
            </div>
            <Button
              onClick={handleSend}
              disabled={isPending || !draft.trim()}
              className="bg-rose-600 hover:bg-rose-700 self-end h-10 w-10 p-0 rounded-lg shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-slate-400">
              Messages are sent securely to the patient&apos;s portal.
            </p>
            <div className="flex items-center gap-2">
              {/* Template picker */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-slate-500">
                    <FileText className="w-3.5 h-3.5" />
                    Templates
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
                  {TEMPLATE_GROUPS.map((group, gi) => (
                    <div key={group.category}>
                      {gi > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel className="text-xs text-slate-400">{group.label}</DropdownMenuLabel>
                      <DropdownMenuGroup>
                        {group.templates.map((tmpl) => (
                          <DropdownMenuItem
                            key={tmpl.id}
                            className="text-xs cursor-pointer"
                            onClick={() => {
                              const filled = applyTemplateVariables(tmpl, {
                                firstName: patientFirstName ?? "there",
                              });
                              setDraft(filled);
                            }}
                          >
                            {tmpl.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <AiMessageDraft
                patientId={patientId}
                onUseDraft={(draftText) => setDraft(draftText)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
