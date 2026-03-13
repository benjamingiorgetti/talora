"use client";

import { useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";
import type { AgentMessageTrace, Conversation, Message } from "@talora/shared";
import {
  AlertTriangle,
  Bot,
  Braces,
  ChevronDown,
  Search,
  Sparkles,
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

type TraceSection = "prompt" | "context" | "tools" | null;

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

function formatToolOutputSummary(output: AgentMessageTrace["executed_tools"][number]["output"]) {
  if (typeof output === "string") return output;
  if (output && typeof output === "object") {
    if ("message" in output && typeof output.message === "string") return output.message;
    if ("error" in output && typeof output.error === "string") return output.error;
    if ("success" in output && output.success === true) return "Ejecución exitosa";
  }
  return "Sin resumen corto";
}

function TraceIsland({
  icon,
  label,
  isOpen,
  onToggle,
  summary,
}: {
  icon: ReactNode;
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  summary: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "interactive-soft flex w-full items-center justify-between gap-3 rounded-[20px] border px-4 py-3 text-left transition-all",
        isOpen
          ? "border-[#d8dce6] bg-white shadow-[0_12px_24px_rgba(15,23,42,0.06)]"
          : "border-[#e6e8ef] bg-[#f7f8fb] hover:border-[#d8dce6] hover:bg-white"
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[#dfe3eb] bg-white text-slate-700">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-950">{label}</span>
          <span className="block truncate text-xs text-slate-500">{summary}</span>
        </span>
      </span>
      <ChevronDown className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform", isOpen && "rotate-180")} />
    </button>
  );
}

function TraceInspector({ trace }: { trace: AgentMessageTrace }) {
  const [openSection, setOpenSection] = useState<TraceSection>(null);
  const variableEntries = Object.entries(trace.injected_context ?? {});

  return (
    <div className="mt-3 rounded-[24px] border border-[#e5e7ef] bg-[linear-gradient(180deg,#fcfcfe_0%,#f6f7fb_100%)] p-3.5">
      <div className="flex flex-wrap items-center gap-2 px-1 pb-3">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            trace.status === "error" ? "bg-red-100 text-red-600" : "bg-[#e8f3eb] text-[#517261]"
          )}
        >
          {trace.status === "error" ? "Traza con error" : "Traza OK"}
        </span>
        <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{formatTime(trace.created_at)}</span>
      </div>

      <div className="space-y-2.5">
        <TraceIsland
          icon={<Sparkles className="h-4 w-4" />}
          label="Prompt resuelto"
          summary={`${trace.system_prompt_resolved.length} caracteres del prompt final ejecutado`}
          isOpen={openSection === "prompt"}
          onToggle={() => setOpenSection((current) => (current === "prompt" ? null : "prompt"))}
        />
        {openSection === "prompt" && (
          <div className="rounded-[22px] border border-[#e1e4ec] bg-white p-4">
            <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-slate-700">
              {trace.system_prompt_resolved}
            </pre>
          </div>
        )}

        <TraceIsland
          icon={<Braces className="h-4 w-4" />}
          label="Contexto inyectado"
          summary={
            variableEntries.length > 0
              ? `${variableEntries.length} variables resueltas para esta vuelta`
              : "No hubo variables resueltas explícitas en esta vuelta"
          }
          isOpen={openSection === "context"}
          onToggle={() => setOpenSection((current) => (current === "context" ? null : "context"))}
        />
        {openSection === "context" && (
          <div className="space-y-3 rounded-[22px] border border-[#e1e4ec] bg-white p-4">
            {variableEntries.length > 0 ? (
              variableEntries.map(([key, value]) => (
                <div key={key} className="rounded-[18px] border border-[#eceef4] bg-[#fafbfe] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{key}</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{value}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No quedó contexto persistido para esta vuelta.</p>
            )}
          </div>
        )}

        <TraceIsland
          icon={<Wrench className="h-4 w-4" />}
          label="Tools ejecutadas"
          summary={
            trace.executed_tools.length > 0
              ? `${trace.executed_tools.length} tools ejecutadas en esta vuelta`
              : "Sin ejecución de tools en esta vuelta"
          }
          isOpen={openSection === "tools"}
          onToggle={() => setOpenSection((current) => (current === "tools" ? null : "tools"))}
        />
        {openSection === "tools" && (
          <div className="space-y-3 rounded-[22px] border border-[#e1e4ec] bg-white p-4">
            {trace.requested_tool_calls && trace.requested_tool_calls.length > 0 && (
              <div className="rounded-[18px] border border-[#eceef4] bg-[#fafbfe] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Tool calls pedidas por el modelo</p>
                <pre className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-700">
                  {formatJson(trace.requested_tool_calls)}
                </pre>
              </div>
            )}

            {trace.executed_tools.length > 0 ? (
              trace.executed_tools.map((tool) => (
                <div key={tool.tool_call_id} className="rounded-[18px] border border-[#eceef4] bg-[#fafbfe] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-950">{tool.name}</p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        tool.status === "error" ? "bg-red-100 text-red-600" : "bg-[#e8f3eb] text-[#517261]"
                      )}
                    >
                      {tool.status === "error" ? "Error" : "Success"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{formatToolOutputSummary(tool.output)}</p>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Input</p>
                      <pre className="mt-2 whitespace-pre-wrap break-words rounded-[14px] border border-[#e6e8ef] bg-white p-3 text-xs leading-6 text-slate-700">
                        {formatJson(tool.input)}
                      </pre>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Output</p>
                      <pre className="mt-2 whitespace-pre-wrap break-words rounded-[14px] border border-[#e6e8ef] bg-white p-3 text-xs leading-6 text-slate-700">
                        {formatJson(tool.output)}
                      </pre>
                    </div>
                  </div>
                  {tool.error && (
                    <p className="mt-3 text-xs font-medium text-red-600">{tool.error}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No hubo tools ejecutadas para esta vuelta.</p>
            )}
          </div>
        )}
      </div>

      {trace.error_message && (
        <div className="mt-3 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {trace.error_message}
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  trace,
}: {
  message: Message;
  trace: AgentMessageTrace | null;
}) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex flex-col", isUser ? "items-start" : "items-end")}>
      <div className={cn("flex w-full gap-3", isUser ? "justify-start" : "justify-end")}>
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

      {!isUser && trace && <div className="w-full pl-12 sm:pl-16"><TraceInspector trace={trace} /></div>}
      {!isUser && !trace && (
        <div className="mt-3 w-full pl-12 sm:pl-16">
          <div className="rounded-[18px] border border-dashed border-[#d9dde7] bg-[#fafbfe] px-4 py-3 text-xs text-slate-500">
            Sin traza persistida para esta respuesta.
          </div>
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

  const unmatchedTraces = useMemo(() => {
    const messageIds = new Set((messages ?? []).map((message) => message.id));
    return (traces ?? []).filter((trace) => !trace.assistant_message_id || !messageIds.has(trace.assistant_message_id));
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
          Timeline real del cliente más observabilidad de cada vuelta del agente.
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
                    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-5 py-5">
                      {unmatchedTraces.length > 0 && (
                        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-amber-600">
                              <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-950">Incidencias sin respuesta final</p>
                              <p className="text-sm text-slate-600">
                                Estas trazas registran una ejecución con error o sin mensaje assistant asociado.
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 space-y-3">
                            {unmatchedTraces.map((trace) => (
                              <TraceInspector key={trace.id} trace={trace} />
                            ))}
                          </div>
                        </div>
                      )}

                      {visibleMessages.length > 0 ? (
                        visibleMessages.map((message) => (
                          <MessageBubble
                            key={message.id}
                            message={message}
                            trace={message.role === "assistant" ? traceByAssistantMessageId.get(message.id) ?? null : null}
                          />
                        ))
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
                    Vas a ver el timeline del cliente junto con prompt, contexto inyectado y tools ejecutadas.
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
