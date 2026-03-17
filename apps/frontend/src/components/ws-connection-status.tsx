"use client";

import { useWebSocket } from "@/hooks/useWebSocket";
import { cn } from "@/lib/utils";

type DotState = "connected" | "reconnecting";

function StatusDot({ state }: { state: DotState }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full h-2 w-2 shrink-0",
        state === "connected" && "bg-green-500",
        state === "reconnecting" && "bg-amber-400"
      )}
      aria-hidden="true"
    />
  );
}

export function WsConnectionStatus() {
  const { isConnected } = useWebSocket();

  const dotState: DotState = isConnected ? "connected" : "reconnecting";
  const label = isConnected ? "Conectado" : "Reconectando...";

  return (
    <div className="flex flex-col gap-0">
      <div
        className="flex items-center gap-2 text-xs text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-label={`Estado de la conexion en tiempo real: ${label}`}
      >
        <StatusDot state={dotState} />
        <span>{label}</span>
      </div>
    </div>
  );
}
