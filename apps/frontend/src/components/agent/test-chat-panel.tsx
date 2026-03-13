"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { TestChatMode, TestChatResponse, TestSession, TestToolTrace } from "@talora/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, RotateCcw, Bot, User, AlertTriangle, Wrench, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  traces?: TestToolTrace[];
}

function isResetCommand(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "/reset" || normalized === "reset";
}

function formatTraceSummary(trace: TestToolTrace) {
  if (trace.error) return trace.error;
  if (typeof trace.output === "string") return trace.output;
  if (trace.output && typeof trace.output === "object") {
    if ("message" in trace.output && typeof trace.output.message === "string") {
      return trace.output.message;
    }
    if ("error" in trace.output && typeof trace.output.error === "string") {
      return trace.output.error;
    }
    if ("success" in trace.output && trace.output.success === true) {
      return "Ejecución completada.";
    }
  }
  return "Ejecución completada.";
}

function MessageBubble({
  message,
  isNew,
}: {
  message: DisplayMessage;
  isNew?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="shrink-0 h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center mt-0.5">
          <Bot className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-lg border px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-accent border-border text-foreground"
            : "bg-primary/15 border-primary/20 text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && message.traces && message.traces.length > 0 && (
          <div className="mt-3 space-y-2 rounded-md border border-primary/15 bg-background/75 p-2">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" />
              Tools ejecutadas
            </div>
            {message.traces.map((trace) => (
              <div
                key={trace.tool_call_id}
                className="rounded-md border border-border/70 bg-background px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{trace.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatTraceSummary(trace)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium">
                      {trace.mode === "live" ? "Real" : "Simulado"}
                    </Badge>
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full",
                        trace.status === "success"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                      )}
                    >
                      {trace.status === "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-1 text-[10px] text-muted-foreground/70 text-right">
          {new Date(message.createdAt).toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
      {isUser && (
        <div className="shrink-0 h-6 w-6 rounded-full bg-accent border border-border flex items-center justify-center mt-0.5">
          <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2 justify-start">
      <div className="shrink-0 h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center mt-0.5">
        <Bot className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      </div>
      <div className="bg-primary/15 border border-primary/20 rounded-lg px-3 py-2.5">
        <div className="flex gap-1 items-center">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

interface TestChatPanelProps {
  promptSavedAt?: number | null;
}

export function TestChatPanel({ promptSavedAt }: TestChatPanelProps) {
  const [session, setSession] = useState<TestSession | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<TestChatMode>("live");
  const [isSending, setIsSending] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newMessageId, setNewMessageId] = useState<string | null>(null);
  const [showPromptBanner, setShowPromptBanner] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  const createSession = useCallback(async () => {
    setIsCreatingSession(true);
    setMessages([]);
    try {
      const res = await api.post<{ data: TestSession }>(
        "/agent/test-chat/session"
      );
      setSession(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Error al crear la sesion de prueba");
    } finally {
      setIsCreatingSession(false);
    }
  }, []);

  const clearSession = useCallback(async () => {
    if (session) {
      try {
        await api.delete(`/agent/test-chat/session/${session.id}`);
      } catch (err) {
        console.error("Error deleting test session:", err);
        toast.error("Error al limpiar la sesión");
      }
    }
    await createSession();
    setShowPromptBanner(false);
    toast.success("Memoria eliminada exitosamente");
  }, [session, createSession]);

  useEffect(() => {
    createSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show banner when prompt is saved and there are messages in the chat
  useEffect(() => {
    if (promptSavedAt && messages.length > 0) {
      setShowPromptBanner(true);
    }
  }, [messages.length, promptSavedAt]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || !session || isSending) return;
    const resetCommand = isResetCommand(content);

    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setNewMessageId(userMsg.id);
    setInput("");
    setIsSending(true);

    try {
      const res = await api.post<{ data: TestChatResponse }>("/agent/test-chat/message", {
        session_id: session.id,
        content,
        mode,
      });

      const assistantMsg: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: res.data.content,
        traces: res.data.executed_tools,
        createdAt: new Date().toISOString(),
      };
      if (resetCommand) {
        setMessages([assistantMsg]);
      } else {
        setMessages((prev) => [...prev, assistantMsg]);
      }
      setNewMessageId(assistantMsg.id);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Error al enviar el mensaje";
      toast.error(message);
      // Remove the user message on failure
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }, [input, isSending, mode, session]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <span className="text-sm font-semibold">Prueba del Agente</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground"
          >
            Sesion temporal
          </Badge>
          <Badge
            variant={mode === "live" ? "default" : "outline"}
            className="text-[10px] px-1.5 py-0 h-4 font-normal"
          >
            {mode === "live" ? "Modo real" : "Modo simulado"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1">
            <Button
              variant={mode === "live" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("live")}
              disabled={isSending || isCreatingSession}
              className="h-7 px-2 text-[11px]"
            >
              Real
            </Button>
            <Button
              variant={mode === "simulate" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("simulate")}
              disabled={isSending || isCreatingSession}
              className="h-7 px-2 text-[11px]"
            >
              Simular
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSession}
            disabled={isCreatingSession}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Limpiar chat y crear nueva sesion"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Limpiar
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3" ref={scrollRef}>
        {isCreatingSession ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="h-6 w-6 border-2 border-primary/40 border-t-primary rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Iniciando sesion...
              </p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Bot className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Prueba tu agente
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Escribe un mensaje para comenzar y ver qué tools corren de verdad.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {showPromptBanner && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-2.5 text-xs"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-yellow-200/90">
                        El prompt fue actualizado. Limpiá el chat para probar con los nuevos cambios.
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSession}
                        className="h-6 text-[11px] text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 px-2 mt-1"
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Limpiar chat
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isNew={msg.id === newMessageId}
              />
            ))}
            {isSending && <TypingIndicator />}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-3 pb-3 pt-2 border-t border-border shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            rows={1}
            disabled={!session || isSending || isCreatingSession}
            className={cn(
              "flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm",
              "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
              "max-h-[120px] overflow-y-auto",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            style={{
              height: "auto",
              minHeight: "36px",
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
            onClick={handleSend}
            disabled={!input.trim() || !session || isSending || isCreatingSession}
            aria-label="Enviar mensaje"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground/60">
          Enter para enviar, Shift+Enter para nueva linea
        </p>
      </div>
    </div>
  );
}
