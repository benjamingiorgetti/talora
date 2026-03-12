"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import type { Conversation, Message } from "@talora/shared";
import { PauseCircle, PlayCircle, Search, Send, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api, companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { WorkspaceEmptyState } from "@/components/workspace/chrome";

function formatConversationLabel(conversation: Conversation) {
  return conversation.contact_name?.trim() || conversation.phone_number;
}

function formatMessageTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadConversations() {
  const response = await api.get<{ data: Conversation[] }>("/conversations?page=1&limit=25");
  return response.data;
}

async function loadMessages(id: string) {
  const response = await api.get<{ data: Message[] }>(`/conversations/${id}/messages`);
  return response.data;
}

export default function WorkspaceWhatsAppPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompanyId } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [toggling, setToggling] = useState(false);

  const { data: conversations, mutate: mutateConversations } = useSWR(
    companyScopedKey("/conversations?page=1&limit=25", activeCompanyId),
    companyScopedFetcher<Conversation[]>
  );
  const { data: messages, mutate: mutateMessages } = useSWR(
    activeCompanyId && selectedId ? [`/conversations/${selectedId}/messages`, activeCompanyId] as const : null,
    companyScopedFetcher<Message[]>
  );

  const filteredConversations = useMemo(() => {
    return (conversations ?? []).filter((conversation) => {
      const query = search.toLowerCase();
      if (!query) return true;
      return (
        formatConversationLabel(conversation).toLowerCase().includes(query) ||
        conversation.phone_number.toLowerCase().includes(query)
      );
    });
  }, [conversations, search]);

  useEffect(() => {
    setSelectedId(null);
    setSearch("");
    setComposer("");
  }, [activeCompanyId]);

  useEffect(() => {
    if (filteredConversations.length === 0) {
      setSelectedId(null);
      return;
    }

    const currentSelectionExists = filteredConversations.some((conversation) => conversation.id === selectedId);
    if (!currentSelectionExists) {
      setSelectedId(filteredConversations[0].id);
    }
  }, [filteredConversations, selectedId]);

  useEffect(() => {
    if (pathname === "/workspace/whatsapp") {
      router.replace("/whatsapp");
    }
  }, [pathname, router]);

  const selectedConversation =
    filteredConversations.find((conversation) => conversation.id === selectedId) ??
    filteredConversations[0] ??
    null;

  const selectedMessages = (messages ?? []).filter((message) => message.role !== "tool");

  const handleTogglePause = async () => {
    if (!selectedConversation) return;
    setToggling(true);
    try {
      const path = selectedConversation.bot_paused
        ? `/conversations/${selectedConversation.id}/resume`
        : `/conversations/${selectedConversation.id}/pause`;
      await api.post(path);
      await mutateConversations();
      toast.success(selectedConversation.bot_paused ? "Bot reactivado para esta conversacion" : "Bot pausado para esta conversacion");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cambiar el estado del bot.");
    } finally {
      setToggling(false);
    }
  };

  const handleSend = async () => {
    if (!selectedConversation || !composer.trim()) return;
    setSending(true);
    try {
      await api.post(`/conversations/${selectedConversation.id}/messages/manual`, { content: composer.trim() });
      setComposer("");
      await Promise.all([mutateMessages(), mutateConversations()]);
      toast.success("Mensaje manual enviado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-5 lg:space-y-6">
      <Card className="overflow-hidden rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[32px]">
        <CardContent className="grid min-h-[680px] grid-cols-1 p-0 lg:min-h-[760px] lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-b border-[#e6e7ec] bg-[linear-gradient(180deg,#fbfbfd_0%,#f5f6fa_100%)] lg:border-b-0 lg:border-r">
            <div className="border-b border-[#e6e7ec] px-4 py-4 sm:px-5 sm:py-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">WhatsApp</p>
                  <h3 className="font-display mt-2 text-[1.9rem] leading-none text-slate-950">Bandeja activa</h3>
                </div>
                <div className="rounded-full border border-[#d5e7da] bg-[hsl(var(--surface-mint))] px-2.5 py-1 text-xs font-semibold text-[#517261]">
                  {filteredConversations.length} abiertas
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

            <div className="max-h-[620px] overflow-y-auto px-3 py-3">
              <div className="space-y-2">
                {filteredConversations.map((conversation) => {
                  const isActive = selectedConversation?.id === conversation.id;
                  const isPaused = conversation.bot_paused;

                  return (
                    <button
                      key={conversation.id}
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
                      <div className="mt-3 flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            isPaused ? "bg-[hsl(var(--surface-sand))] text-[#7b664a]" : "bg-[hsl(var(--surface-mint))] text-[#517261]"
                          )}
                        >
                          {isPaused ? "Pausado" : "Auto"}
                        </span>
                        <span className="rounded-full bg-[hsl(var(--surface-sand))] px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                          Contexto activo
                        </span>
                      </div>
                    </button>
                  );
                })}

                {filteredConversations.length === 0 && (
                  <WorkspaceEmptyState
                    title="No encontramos conversaciones con ese criterio."
                    description="Probá con otro nombre o teléfono para volver a traer la bandeja."
                    className="px-4 py-10"
                  />
                )}
              </div>
            </div>
          </aside>

          <section className="flex min-h-[680px] flex-col lg:min-h-[760px]">
            {selectedConversation ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6e7ec] px-4 py-4 sm:px-5 sm:py-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Conversacion</p>
                    <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">
                      {formatConversationLabel(selectedConversation)}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">{selectedConversation.phone_number}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full bg-[hsl(var(--surface-sand))] px-3 py-1.5 text-xs font-semibold text-slate-600">
                      FAQ y turnos en la misma bandeja
                    </div>
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
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#fbfcff_0%,#f5f6fa_100%)] px-4 py-4 sm:px-5 sm:py-5">
                  <div className="mx-auto flex max-w-4xl flex-col gap-4">
                    {selectedMessages.length > 0 ? (
                      selectedMessages.map((message) => {
                        const isHumanSide = message.role === "assistant";
                        return (
                          <div key={message.id} className={cn("flex", isHumanSide ? "justify-end" : "justify-start")}>
                            <div
                              className={cn(
                                "max-w-[86%] rounded-[24px] px-4 py-3 shadow-[0_14px_28px_rgba(15,23,42,0.06)] sm:max-w-[72%] sm:rounded-[28px]",
                                isHumanSide
                                  ? "rounded-br-md bg-[#1c1d22] text-white"
                                  : "rounded-bl-md border border-[#e4e7ee] bg-white text-slate-900"
                              )}
                            >
                              <p className="text-sm leading-7">{message.content}</p>
                              <div className={cn("mt-2 flex items-center justify-end gap-1 text-[11px]", isHumanSide ? "text-white/60" : "text-slate-400")}>
                                {isHumanSide ? <ShieldCheck className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                                {formatMessageTime(message.created_at)}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <WorkspaceEmptyState
                        title="Esta conversación todavía no tiene mensajes visibles desde el API."
                        description="Cuando entren mensajes reales, esta vista va a mostrar contexto y takeover sobre la misma bandeja."
                        className="bg-white"
                      />
                    )}
                  </div>
                </div>

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
                    <p className="mt-3 text-xs text-slate-400">
                      El equipo puede tomar el control de una conversacion puntual sin apagar la operacion completa.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6">
                <WorkspaceEmptyState
                  title="Seleccioná una conversación para revisar contexto."
                  description="Desde acá podés pausar el bot o responder manualmente sin romper la continuidad de la bandeja."
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
