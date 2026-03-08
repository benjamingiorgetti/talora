"use client";

import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RefreshCw, WifiOff } from "lucide-react";

type DotState = "connected" | "reconnecting" | "disconnected";

function StatusDot({ state }: { state: DotState }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full h-2 w-2 shrink-0",
        state === "connected" && "bg-green-500",
        state === "reconnecting" && "bg-amber-400",
        state === "disconnected" && "bg-red-500"
      )}
      aria-hidden="true"
    />
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
      {/* Compact status indicator in the navbar */}
      <div
        className="flex items-center gap-2 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-label={`Estado de la conexion en tiempo real: ${label}`}
      >
        <StatusDot state={dotState} />
        <span>{label}</span>
      </div>

      {/* Disconnection banner — only shown when retries are exhausted */}
      {retriesExhausted && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-4 rounded-lg border border-destructive/30 bg-card px-6 py-4"
        >
          <WifiOff className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            Se perdio la conexion en tiempo real. Los datos pueden estar desactualizados.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={reconnect}
            className="ml-2 h-8 shrink-0 text-xs font-semibold"
            aria-label="Reconectar al servidor en tiempo real"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Reconectar
          </Button>
        </div>
      )}
    </div>
  );
}
