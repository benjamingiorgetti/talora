"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import type { AgentMessageTrace, AgentToolExecutionTrace, Conversation, Message } from "@talora/shared";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  Search,
  Settings,
  User,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ErrorCard } from "@/components/ui/error-card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

function formatConversationLabel(conversation: Conversation) {
  return conversation.contact_name?.trim() || conversation.phone_number;
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function SystemPromptBlock({ prompt }: { prompt: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-[24px] border border-[#d8dce8] bg-white">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#dfe3eb] bg-[#f0f2f8] text-slate-600">
            <Settings className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-950">System Prompt</span>
            <span className="block text-xs text-slate-500">{prompt.length.toLocaleString()} caracteres</span>
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="border-t border-[#e6e8ef] px-5 py-4">
          <pre className="max-h-[400px] overflow-y-auto whitespace-pre-wrap break-words text-xs leading-6 text-slate-700">
            {prompt}
          </pre>
        </div>
      )}
    </div>
  );
}

function ToolCallChip({ tool }: { tool: AgentToolExecutionTrace }) {
  const [isOpen, setIsOpen] = useState(false);
  const isError = tool.status === "error";

  return (
    <div className="flex justify-end">
      <div className="max-w-[84%] sm:max-w-[72%]">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className={cn(
            "flex items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-colors",
            isError
              ? "border-red-200 bg-red-50 hover:bg-red-100"
              : "border-[#d8e4d8] bg-[#eef5ee] hover:bg-[#e4ede4]"
          )}
        >
          <Wrench className={cn("h-3.5 w-3.5 shrink-0", isError ? "text-red-500" : "text-emerald-600")} />
          <span className={cn("text-xs font-semibold", isError ? "text-red-700" : "text-emerald-800")}>
            {tool.name}
          </span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
              isError ? "bg-red-200 text-red-700" : "bg-emerald-200 text-emerald-800"
            )}
          >
            {isError ? "error" : "ok"}
          </span>
          <ChevronDown className={cn("h-3 w-3 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")} />
        </button>

        {isOpen && (
          <div className="mt-1.5 rounded-2xl border border-[#e2e5ec] bg-white p-3">
            {Object.keys(tool.input).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Argumentos</p>
                <pre className="mt-1.5 whitespace-pre-wrap break-words rounded-xl border border-[#eceef4] bg-[#fafbfe] p-2.5 text-[11px] leading-5 text-slate-700">
                  {formatJson(tool.input)}
                </pre>
              </div>
            )}
            {tool.output !== null && tool.output !== undefined && (
              <div className={Object.keys(tool.input).length > 0 ? "mt-2.5" : ""}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Resultado</p>
                <pre className="mt-1.5 whitespace-pre-wrap break-words rounded-xl border border-[#eceef4] bg-[#fafbfe] p-2.5 text-[11px] leading-5 text-slate-700">
                  {typeof tool.output === "string" ? tool.output : formatJson(tool.output)}
                </pre>
              </div>
            )}
            {tool.error && (
              <p className="mt-2.5 text-xs font-medium text-red-600">{tool.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-start" : "justify-end")}>
      {isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#e2e5ec] bg-white text-slate-500">
          <User className="h-4 w-4" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[84%] rounded-[24px] px-4 py-3 shadow-[0_14px_28px_rgba(15,23,42,0.06)] sm:max-w-[72%]",
          isUser ? "rounded-bl-md border border-[#e4e7ee] bg-white text-slate-900" : "rounded-br-md bg-[#1c1d22] text-white"
        )}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-7">{message.content}</p>
        <p className={cn("mt-2 text-[11px]", isUser ? "text-slate-400" : "text-white/55")}>{formatTime(message.created_at)}</p>
      </div>
      {!isUser && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#23242b] bg-[#1c1d22] text-white/70">
          <Bot className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

export function MessagesObservabilityPanel() {
  const { activeCompanyId } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const conversationsKey = companyScopedKey("/conversations?page=1&limit=50&state=all", activeCompanyId);
  const { data: conversations, error: conversationsError, isLoading: conversationsLoading, mutate: mutateConversations } = useSWR(
    conversationsKey,
    companyScopedFetcher<Conversation[]>,
  );

  const filteredConversations = useMemo(() => {
    return (conversations ?? []).filter((conversation) => {
      const query = search.trim().toLowerCase();
      if (!query) return true;

      return (
        formatConversationLabel(conversation).toLowerCase().includes(query) ||
        conversation.phone_number.toLowerCase().includes(query)
      );
    });
  }, [conversations, search]);

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.id === selectedId) ??
    filteredConversations[0] ??
    null;

  const messagesKey = selectedConversation
    ? companyScopedKey(`/conversations/${selectedConversation.id}/messages?limit=200`, activeCompanyId)
    : null;
  const tracesKey = selectedConversation
    ? companyScopedKey(`/conversations/${selectedConversation.id}/traces`, activeCompanyId)
    : null;

  const { data: messages, error: messagesError, isLoading: messagesLoading, mutate: mutateMessages } = useSWR(
    messagesKey,
    companyScopedFetcher<Message[]>,
  );
  const { data: traces, error: tracesError, isLoading: tracesLoading, mutate: mutateTraces } = useSWR(
    tracesKey,
    companyScopedFetcher<AgentMessageTrace[]>,
  );

  const visibleMessages = useMemo(
    () =>
      (messages ?? []).filter((message) => {
        if (message.role === "user") return true;
        if (message.role === "assistant") return Boolean(message.content?.trim());
        return false;
      }),
    [messages],
  );

  const traceByAssistantMessageId = useMemo(() => {
    const map = new Map<string, AgentMessageTrace>();
    for (const trace of traces ?? []) {
      if (trace.assistant_message_id) {
        map.set(trace.assistant_message_id, trace);
      }
    }
    return map;
  }, [traces]);

  const latestPrompt = useMemo(() => {
    const allTraces = traces ?? [];
    for (let i = allTraces.length - 1; i >= 0; i--) {
      if (allTraces[i].system_prompt_resolved) {
        return allTraces[i].system_prompt_resolved;
      }
    }
    return null;
  }, [traces]);

  const unmatchedTraces = useMemo(() => {
    const messageIds = new Set((messages ?? []).map((message) => message.id));
    return (traces ?? []).filter(
      (trace) => trace.status === "error" && (!trace.assistant_message_id || !messageIds.has(trace.assistant_message_id))
    );
  }, [messages, traces]);

  if (conversationsError) {
    return <ErrorCard onRetry={() => void mutateConversations()} />;
  }

  if (conversationsLoading && !conversations) {
    return <LoadingSpinner className="min-h-[40vh]" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Conversaciones</h2>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground">
          Timeline real del cliente con observabilidad del agente.
        </p>
      </div>

      <Card className="overflow-hidden rounded-[28px] border-[#e6e7ec] bg-white shadow-none">
        <CardContent className="grid h-[760px] min-h-0 grid-cols-[320px_minmax(0,1fr)] p-0">
          <aside className="flex min-h-0 flex-col border-r border-[#e6e7ec] bg-[linear-gradient(180deg,#fbfbfd_0%,#f5f6fa_100%)]">
            <div className="border-b border-[#e6e7ec] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Admin mensajes</p>
                  <h3 className="mt-2 font-display text-[1.9rem] leading-none text-slate-950">Observabilidad</h3>
                </div>
                <div className="rounded-full border border-[#dfe3eb] bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {filteredConversations.length} conversaciones
                </div>
              </div>
              <div className="relative mt-4">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre o telefono..."
                  className="h-11 rounded-2xl border-[#dde1ea] bg-white pl-11 shadow-none"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-2 px-3 py-3">
                {filteredConversations.map((conversation) => {
                  const isActive = selectedConversation?.id === conversation.id;

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedId(conversation.id)}
                      className={cn(
                        "interactive-soft w-full rounded-[22px] border px-4 py-3.5 text-left",
                        isActive
                          ? "border-[#dfe1e9] bg-white shadow-[0_16px_30px_rgba(15,23,42,0.08)]"
                          : "border-transparent bg-transparent hover:border-[#e6e7ec] hover:bg-white"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{formatConversationLabel(conversation)}</p>
                          <p className="mt-1 truncate text-sm text-slate-500">{conversation.phone_number}</p>
                        </div>
                        <span className="text-xs text-slate-400">
                          {conversation.last_message_at ? formatTime(conversation.last_message_at) : "--:--"}
                        </span>
                      </div>
                    </button>
                  );
                })}

                {filteredConversations.length === 0 && (
                  <div className="rounded-[22px] border border-dashed border-[#d7dbe5] bg-white px-4 py-10 text-center text-sm text-slate-500">
                    No encontramos conversaciones con ese criterio.
                  </div>
                )}
              </div>
            </ScrollArea>
          </aside>

          <section className="flex min-h-0 flex-col bg-[linear-gradient(180deg,#fbfcff_0%,#f5f6fa_100%)]">
            {selectedConversation ? (
              <>
                <div className="border-b border-[#e6e7ec] px-5 py-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Inspección</p>
                  <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                    {formatConversationLabel(selectedConversation)}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">{selectedConversation.phone_number}</p>
                </div>

                {(messagesError || tracesError) ? (
                  <div className="flex flex-1 items-center justify-center px-6">
                    <ErrorCard
                      onRetry={() => {
                        void Promise.all([mutateMessages(), mutateTraces()]);
                      }}
                    />
                  </div>
                ) : messagesLoading || tracesLoading ? (
                  <LoadingSpinner className="min-h-[40vh]" />
                ) : (
                  <ScrollArea className="flex-1">
                    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-5">
                      {latestPrompt && <SystemPromptBlock prompt={latestPrompt} />}

                      {unmatchedTraces.length > 0 && (
                        <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                            <p className="text-sm font-semibold text-slate-950">
                              {unmatchedTraces.length} incidencia{unmatchedTraces.length > 1 ? "s" : ""} sin respuesta
                            </p>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {unmatchedTraces.map((trace) => (
                              <p key={trace.id} className="text-xs text-slate-600">
                                <span className="text-slate-400">{formatTime(trace.created_at)}</span>
                                {" — "}
                                {trace.error_message ?? "Ejecución sin mensaje assistant asociado"}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {visibleMessages.length > 0 ? (
                        visibleMessages.map((message) => {
                          const trace = message.role === "assistant"
                            ? traceByAssistantMessageId.get(message.id) ?? null
                            : null;

                          return (
                            <div key={message.id} className="flex flex-col gap-2">
                              <MessageBubble message={message} />
                              {trace && trace.executed_tools.length > 0 && (
                                <div className="flex flex-col gap-1.5">
                                  {trace.executed_tools.map((tool) => (
                                    <ToolCallChip key={tool.tool_call_id} tool={tool} />
                                  ))}
                                </div>
                              )}
                              {trace?.error_message && (
                                <div className="flex justify-end">
                                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                    {trace.error_message}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-[#d7dbe5] bg-white px-6 py-16 text-center text-sm text-slate-500">
                          Esta conversación todavía no tiene mensajes visibles para inspeccionar.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6">
                <div className="rounded-[24px] border border-dashed border-[#d7dbe5] bg-white px-6 py-16 text-center">
                  <p className="text-lg font-semibold text-slate-950">Seleccioná una conversación</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Vas a ver el timeline del cliente junto con las tools ejecutadas por el agente.
                  </p>
                </div>
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
