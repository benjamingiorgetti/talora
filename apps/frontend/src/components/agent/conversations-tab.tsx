"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useSWR from "swr";
import type { Conversation, Message } from "@talora/shared";
import { fetcher } from "@/lib/api";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ErrorCard } from "@/components/ui/error-card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";
import { Search, User, Bot, Wrench, MessageSquare } from "lucide-react";

const PAGE_LIMIT = 50;

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitial(name: string | null | undefined, phone: string) {
  if (name && name.length > 0) return name[0].toUpperCase();
  return phone.slice(-2);
}

// Dark-mode safe avatar palette
const avatarColors = [
  "bg-blue-500/15 text-blue-400",
  "bg-indigo-500/15 text-indigo-400",
  "bg-sky-500/15 text-sky-400",
  "bg-violet-500/15 text-violet-400",
  "bg-teal-500/15 text-teal-400",
  "bg-cyan-500/15 text-cyan-400",
  "bg-slate-500/15 text-slate-400",
];

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function ToolCallCard({ message }: { message: Message }) {
  let toolInfo = { name: "Herramienta", result: message.content ?? "" };
  if (message.tool_calls && message.tool_calls.length > 0) {
    const call = message.tool_calls[0] as Record<string, unknown>;
    toolInfo.name = (call.name as string) ?? "Herramienta";
  }

  return (
    <div className="mx-auto my-3 max-w-md">
      <Card className="rounded-xl border border-dashed border-primary/20 bg-primary/5">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Wrench className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs font-semibold text-primary">
              {toolInfo.name}
            </span>
          </div>
          {toolInfo.result && (
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
              {toolInfo.result}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === "tool") {
    return <ToolCallCard message={message} />;
  }

  const isUser = message.role === "user";

  if (message.role === "assistant" && message.tool_calls && message.tool_calls.length > 0 && !message.content) {
    return (
      <div className="mx-auto my-3 max-w-md">
        <Card className="rounded-xl border border-dashed border-primary/30 bg-primary/5">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                <Wrench className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-primary">
                Llamada a herramienta
              </span>
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
              {JSON.stringify(message.tool_calls, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2.5 my-2.5", isUser ? "justify-start" : "justify-end")}>
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-xl px-4 py-2.5 text-sm",
          isUser
            ? "bg-accent border border-border text-foreground"
            : "bg-primary/15 text-foreground border border-primary/20"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatTime(message.created_at)}
        </p>
      </div>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
    </div>
  );
}

export function ConversationsTab() {
  const [page, setPage] = useState(1);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const {
    data: conversations,
    error,
    isLoading,
    mutate,
  } = useSWR<Conversation[]>(
    `/conversations?page=${page}&limit=${PAGE_LIMIT}`,
    fetcher
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Accumulate paginated conversations
  useEffect(() => {
    if (conversations) {
      setAllConversations((prev) => {
        if (page === 1) return conversations;
        const existingIds = new Set(prev.map((c) => c.id));
        const newItems = conversations.filter((c) => !existingIds.has(c.id));
        return [...prev, ...newItems];
      });
    }
  }, [conversations, page]);

  const { data: messages } = useSWR<Message[]>(
    selectedId ? `/conversations/${selectedId}/messages` : null,
    fetcher
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filtered = useMemo(() => allConversations.filter((c) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      c.contact_name?.toLowerCase().includes(q) ||
      c.phone_number.toLowerCase().includes(q)
    );
  }), [allConversations, debouncedSearch]);

  const handleLoadMore = useCallback(() => {
    setPage((prev) => prev + 1);
  }, []);

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Conversaciones</h2>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">
            Revisa las conversaciones del bot con los clientes
          </p>
        </div>
        <ErrorCard onRetry={() => mutate()} />
      </div>
    );
  }

  if (isLoading && allConversations.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Conversaciones</h2>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">
            Revisa las conversaciones del bot con los clientes
          </p>
        </div>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Conversaciones</h2>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground">
          Revisa las conversaciones del bot con los clientes
        </p>
      </div>

      <div className="flex h-[600px] rounded-lg border border-border overflow-hidden">
        {/* Left panel */}
        <div className="w-72 shrink-0 border-r border-border bg-card flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o telefono..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-md border border-border bg-background pl-9 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {filtered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={cn(
                    "w-full text-left rounded-md px-3 py-3 transition-colors duration-150 flex items-center gap-2.5",
                    selectedId === conv.id
                      ? "bg-accent border-l-2 border-l-primary"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div
                    className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center shrink-0 font-semibold text-xs",
                      getAvatarColor(conv.id)
                    )}
                  >
                    {getInitial(conv.contact_name, conv.phone_number)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold truncate">
                        {conv.contact_name ?? conv.phone_number}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">
                        {conv.phone_number}
                      </span>
                      {conv.last_message_at && (
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {formatTime(conv.last_message_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="py-10 text-center text-sm font-medium text-muted-foreground">
                  No hay conversaciones
                </p>
              )}
              {conversations && conversations.length === PAGE_LIMIT && !debouncedSearch && (
                <div className="py-3 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    className="h-9 rounded-lg text-sm font-medium"
                  >
                    Cargar mas
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right panel */}
        <div className="flex-1 flex flex-col bg-background">
          {selectedId ? (
            <>
              <div className="p-4 border-b border-border">
                <span className="text-sm font-semibold">
                  {(() => {
                    const conv = allConversations.find((c) => c.id === selectedId);
                    return conv?.contact_name ?? conv?.phone_number ?? "";
                  })()}
                </span>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-5">
                  {messages?.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center">
                <MessageSquare className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Selecciona una conversacion para ver los mensajes
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
