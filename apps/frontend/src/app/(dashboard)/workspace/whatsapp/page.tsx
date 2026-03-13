"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import type { Conversation, Message } from "@talora/shared";
import { Archive, PauseCircle, PlayCircle, Search, Send, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { WorkspaceEmptyState } from "@/components/workspace/chrome";
import { useWebSocket } from "@/hooks/useWebSocket";

type ConversationView = "active" | "archived";

function formatConversationLabel(conversation: Conversation) {
  return conversation.contact_name?.trim() || conversation.phone_number;
}

function formatMessageTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatArchiveReason(conversation: Conversation) {
  if (conversation.archive_reason === "manual_reset") return "Archivada por reset";
  if (conversation.archive_reason === "inactive_48h") return "Archivada por inactividad";
  return "Archivada";
}

export default function WorkspaceWhatsAppPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const { activeCompanyId } = useAuth();
  const { lastEvent } = useWebSocket();
  const [view, setView] = useState<ConversationView>("active");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [toggling, setToggling] = useState(false);

  const activeConversationsKey = companyScopedKey("/conversations?page=1&limit=25&state=active", activeCompanyId);
  const archivedConversationsKey = companyScopedKey("/conversations?page=1&limit=25&state=archived", activeCompanyId);

  const { data: activeConversations, mutate: mutateActiveConversations } = useSWR(
    activeConversationsKey,
    companyScopedFetcher<Conversation[]>
  );
  const { data: archivedConversations, mutate: mutateArchivedConversations } = useSWR(
    archivedConversationsKey,
    companyScopedFetcher<Conversation[]>
  );
  const { data: messages, mutate: mutateMessages } = useSWR(
    activeCompanyId && selectedId ? [`/conversations/${selectedId}/messages`, activeCompanyId] as const : null,
    companyScopedFetcher<Message[]>
  );

  useEffect(() => {
    setSelectedId(null);
    setSearch("");
    setComposer("");
    setView("active");
  }, [activeCompanyId]);

  useEffect(() => {
    if (!lastEvent || !activeCompanyId) return;

    if (lastEvent.type === "conversation:updated" && lastEvent.payload.company_id === activeCompanyId) {
      void Promise.all([
        globalMutate(activeConversationsKey),
        globalMutate(archivedConversationsKey),
      ]);
      return;
    }

    if (lastEvent.type === "message:new" && lastEvent.payload.company_id === activeCompanyId) {
      void Promise.all([
        globalMutate(activeConversationsKey),
        globalMutate(archivedConversationsKey),
      ]);

      if (lastEvent.payload.conversation_id === selectedId) {
        void mutateMessages();
      }
    }
  }, [
    activeCompanyId,
    activeConversationsKey,
    archivedConversationsKey,
    globalMutate,
    lastEvent,
    mutateMessages,
    selectedId,
  ]);

  const conversations = useMemo(
    () => (view === "active" ? activeConversations ?? [] : archivedConversations ?? []),
    [activeConversations, archivedConversations, view]
  );

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      const query = search.toLowerCase().trim();
      if (!query) return true;
      return (
        formatConversationLabel(conversation).toLowerCase().includes(query) ||
        conversation.phone_number.toLowerCase().includes(query)
      );
    });
  }, [conversations, search]);

  useEffect(() => {
    if (pathname === "/workspace/whatsapp") {
      router.replace("/whatsapp");
    }
  }, [pathname, router]);

  useEffect(() => {
    const currentList = filteredConversations;
    const otherList = view === "active" ? archivedConversations ?? [] : activeConversations ?? [];

    if (currentList.length === 0) {
      if (selectedId && otherList.some((conversation) => conversation.id === selectedId)) {
        setView((current) => (current === "active" ? "archived" : "active"));
        return;
      }
      setSelectedId(null);
      return;
    }

    if (selectedId && currentList.some((conversation) => conversation.id === selectedId)) {
      return;
    }

    if (selectedId && otherList.some((conversation) => conversation.id === selectedId)) {
      setView((current) => (current === "active" ? "archived" : "active"));
      return;
    }

    setSelectedId(currentList[0].id);
  }, [activeConversations, archivedConversations, filteredConversations, selectedId, view]);

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.id === selectedId) ??
    filteredConversations[0] ??
    null;

  const visibleMessages = (messages ?? []).filter((message) => message.role !== "tool");

  const handleTogglePause = async () => {
    if (!selectedConversation || selectedConversation.archived_at) return;
    setToggling(true);
    try {
      const path = selectedConversation.bot_paused
        ? `/conversations/${selectedConversation.id}/resume`
        : `/conversations/${selectedConversation.id}/pause`;
      await api.post(path);
      await mutateActiveConversations();
      toast.success(selectedConversation.bot_paused ? "Bot reactivado para esta conversacion" : "Bot pausado para esta conversacion");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar el estado del bot.");
    } finally {
      setToggling(false);
    }
  };

  const handleSend = async () => {
    if (!selectedConversation || selectedConversation.archived_at || !composer.trim()) return;
    setSending(true);
    try {
      await api.post(`/conversations/${selectedConversation.id}/messages/manual`, { content: composer.trim() });
      setComposer("");
      await Promise.all([mutateMessages(), mutateActiveConversations()]);
      toast.success("Mensaje manual enviado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Card className="overflow-hidden rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[32px] lg:flex-1 lg:min-h-0">
        <CardContent className="grid min-h-[680px] grid-cols-1 p-0 lg:h-full lg:min-h-0 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b border-[#e6e7ec] bg-[linear-gradient(180deg,#fbfbfd_0%,#f5f6fa_100%)] lg:flex lg:min-h-0 lg:flex-col lg:border-b-0 lg:border-r">
            <div className="border-b border-[#e6e7ec] px-4 py-4 sm:px-5 sm:py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">WhatsApp</p>
                  <h3 className="font-display mt-2 text-[1.9rem] leading-none text-slate-950">
                    {view === "active" ? "Activos" : "Archivados"}
                  </h3>
                </div>
                <div className="rounded-full border border-[#dde1ea] bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                  {filteredConversations.length}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 rounded-[18px] bg-[#eef1f7] p-1">
                <button
                  type="button"
                  onClick={() => setView("active")}
                  className={cn(
                    "rounded-[14px] px-3 py-2 text-sm font-medium transition-colors",
                    view === "active" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
                  )}
                >
                  Activos
                </button>
                <button
                  type="button"
                  onClick={() => setView("archived")}
                  className={cn(
                    "rounded-[14px] px-3 py-2 text-sm font-medium transition-colors",
                    view === "archived" ? "bg-white text-slate-950 shadow-sm" : "text-slate-500"
                  )}
                >
                  Archivados
                </button>
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

            <div className="px-3 py-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <div className="space-y-2">
                {filteredConversations.map((conversation) => {
                  const isActive = selectedConversation?.id === conversation.id;
                  const isPaused = conversation.bot_paused;

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setSelectedId(conversation.id)}
                      className={cn(
                        "interactive-soft w-full rounded-[22px] border px-4 py-3.5 text-left sm:rounded-[24px]",
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
                          {conversation.last_message_at ? formatMessageTime(conversation.last_message_at) : "--:--"}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {conversation.archived_at ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                            {formatArchiveReason(conversation)}
                          </span>
                        ) : (
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                              isPaused ? "bg-[hsl(var(--surface-sand))] text-[#7b664a]" : "bg-[hsl(var(--surface-mint))] text-[#517261]"
                            )}
                          >
                            {isPaused ? "Pausado" : "Auto"}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}

                {filteredConversations.length === 0 && (
                  <WorkspaceEmptyState
                    title={view === "active" ? "No hay conversaciones activas." : "No hay conversaciones archivadas."}
                    description={
                      view === "active"
                        ? "Cuando entren mensajes nuevos, van a aparecer aca."
                        : "Los resets y los chats sin actividad de 48 horas aparecen aca."
                    }
                    className="px-4 py-10"
                  />
                )}
              </div>
            </div>
          </aside>

          <section className="flex min-h-[680px] flex-col lg:min-h-0 lg:h-full">
            {selectedConversation ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6e7ec] px-4 py-4 sm:px-5 sm:py-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Conversacion</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">
                        {formatConversationLabel(selectedConversation)}
                      </h3>
                      {selectedConversation.archived_at ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          {formatArchiveReason(selectedConversation)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{selectedConversation.phone_number}</p>
                  </div>
                  {!selectedConversation.archived_at ? (
                    <Button
                      variant="outline"
                      disabled={toggling}
                      onClick={handleTogglePause}
                      className="h-10 rounded-2xl border-[#dde1ea] bg-white px-4 text-slate-700 hover:bg-[#f6f7fb]"
                    >
                      {selectedConversation.bot_paused ? (
                        <>
                          <PlayCircle className="mr-2 h-4 w-4" />
                          Reactivar bot
                        </>
                      ) : (
                        <>
                          <PauseCircle className="mr-2 h-4 w-4" />
                          Pausar bot
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Solo lectura
                    </div>
                  )}
                </div>

                <div className="flex-1 bg-[linear-gradient(180deg,#fbfcff_0%,#f5f6fa_100%)] px-4 py-4 sm:px-5 sm:py-5 lg:min-h-0 lg:overflow-y-auto">
                  <div className="mx-auto flex max-w-4xl flex-col gap-4">
                    {visibleMessages.length > 0 ? (
                      visibleMessages.map((message) => {
                        if (message.role === "system") {
                          return (
                            <div key={message.id} className="flex justify-center">
                              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm">
                                <Archive className="h-3.5 w-3.5" />
                                <span>{message.content}</span>
                                <span className="text-slate-400">{formatMessageTime(message.created_at)}</span>
                              </div>
                            </div>
                          );
                        }

                        const isAssistant = message.role === "assistant";
                        return (
                          <div key={message.id} className={cn("flex", isAssistant ? "justify-end" : "justify-start")}>
                            <div
                              className={cn(
                                "max-w-[86%] rounded-[24px] px-4 py-3 shadow-[0_14px_28px_rgba(15,23,42,0.06)] sm:max-w-[72%] sm:rounded-[28px]",
                                isAssistant
                                  ? "rounded-br-md bg-[#1c1d22] text-white"
                                  : "rounded-bl-md border border-[#e4e7ee] bg-white text-slate-900"
                              )}
                            >
                              <p className="text-sm leading-7">{message.content}</p>
                              <div className={cn("mt-2 flex items-center justify-end gap-1 text-[11px]", isAssistant ? "text-white/60" : "text-slate-400")}>
                                {isAssistant ? <ShieldCheck className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                                {formatMessageTime(message.created_at)}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <WorkspaceEmptyState
                        title="Todavia no hay mensajes visibles."
                        description="Cuando entren mensajes, vas a poder revisarlos desde esta bandeja."
                        className="bg-white"
                      />
                    )}
                  </div>
                </div>

                {selectedConversation.archived_at ? (
                  <div className="border-t border-[#e6e7ec] px-4 py-4 text-sm text-slate-500 sm:px-5">
                    Esta conversacion esta archivada. Si entra un mensaje nuevo, vuelve sola a Activos.
                  </div>
                ) : (
                  <div className="border-t border-[#e6e7ec] px-4 py-4 sm:px-5">
                    <div className="rounded-[24px] border border-[#e2e4ec] bg-white p-3 shadow-[0_18px_32px_rgba(15,23,42,0.06)] sm:rounded-[28px]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <Input
                          value={composer}
                          onChange={(event) => setComposer(event.target.value)}
                          placeholder="Escribir mensaje manual..."
                          className="h-12 rounded-2xl border-transparent bg-[#f6f7fb] shadow-none"
                        />
                        <Button disabled={sending} onClick={handleSend} className="h-12 rounded-2xl px-5 sm:shrink-0">
                          <Send className="mr-2 h-4 w-4" />
                          {sending ? "Enviando..." : "Enviar"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <WorkspaceEmptyState
                  title={view === "active" ? "Selecciona una conversacion activa." : "Selecciona una conversacion archivada."}
                  description={
                    view === "active"
                      ? "Abri una conversacion para revisar mensajes o responder manualmente."
                      : "Abri una conversacion archivada para revisar su historial."
                  }
                  className="max-w-md"
                />
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
