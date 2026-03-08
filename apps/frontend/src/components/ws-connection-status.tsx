"use client";

import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

// Reusable pulsing dot that reflects the current WS state.
// Three states: connected (green), reconnecting (yellow), disconnected/exhausted (red).

type DotState = "connected" | "reconnecting" | "disconnected";

function StatusDot({ state }: { state: DotState }) {
  return (
    <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
      {state === "connected" && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      )}
      {state === "reconnecting" && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
      )}
      <span
        className={cn(
          "relative inline-flex rounded-full h-2.5 w-2.5",
          state === "connected" && "bg-green-500",
          state === "reconnecting" && "bg-yellow-500",
          state === "disconnected" && "bg-red-500"
        )}
      />
    </span>
  );
}

export function WsConnectionStatus() {
  const { isConnected, retriesExhausted, reconnect } = useWebSocket();

  const dotState: DotState = isConnected
    ? "connected"
    : retriesExhausted
    ? "disconnected"
    : "reconnecting";

  const label = isConnected
    ? "Conectado"
    : retriesExhausted
    ? "Sin conexion"
    : "Reconectando...";

  return (
    <div className="flex flex-col gap-0">
      {/* Compact status pill shown in the navbar area */}
      <div
        className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur-sm"
        role="status"
        aria-live="polite"
        aria-label={`Estado de la conexion en tiempo real: ${label}`}
      >
        <StatusDot state={dotState} />
        <span>{label}</span>
        {!isConnected && !retriesExhausted && (
          <span className="ml-0.5 text-yellow-600">
            <Wifi className="h-3 w-3 animate-pulse" aria-hidden="true" />
          </span>
        )}
        {retriesExhausted && (
          <WifiOff className="h-3 w-3 text-red-500" aria-hidden="true" />
        )}
      </div>

      {/* Warning banner — only shown when retries are exhausted */}
      {retriesExhausted && (
        <div
          role="alert"
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 flex items-center gap-4 rounded-2xl border border-red-200 bg-red-50 px-6 py-4 shadow-xl shadow-red-100/50"
        >
          <WifiOff className="h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-red-700">
            Se perdio la conexion en tiempo real. Los datos pueden estar desactualizados.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={reconnect}
            className="ml-2 h-9 shrink-0 rounded-xl border-2 border-red-300 bg-white text-sm font-bold text-red-600 hover:bg-red-100"
            aria-label="Reconectar al servidor en tiempo real"
          >
            <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Reconectar
          </Button>
        </div>
      )}
    </div>
  );
}
