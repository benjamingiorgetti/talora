"use client";

import { useEffect } from "react";
import useSWR from "swr";
import type { Alert } from "@talora/shared";
import { fetcher } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Info, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorCard } from "@/components/ui/error-card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const typeConfig: Record<string, { icon: typeof Info; bg: string; iconBg: string; label: string }> = {
  error: {
    icon: AlertCircle,
    bg: "bg-red-500/10 border-l-red-500",
    iconBg: "bg-red-500/15 text-red-400",
    label: "Error",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-yellow-500/10 border-l-yellow-500",
    iconBg: "bg-yellow-500/15 text-yellow-400",
    label: "Advertencia",
  },
  info: {
    icon: Info,
    bg: "bg-blue-500/10 border-l-blue-500",
    iconBg: "bg-blue-500/15 text-blue-400",
    label: "Info",
  },
};

function getTypeConfig(type: string) {
  return typeConfig[type] ?? typeConfig.info;
}

export function AlertsTab() {
  const { data: alerts, error, isLoading, mutate } = useSWR<Alert[]>("/alerts", fetcher);
  const { lastEvent } = useWebSocket();

  useEffect(() => {
    if (lastEvent?.type === "alert:new") {
      mutate();
    }
  }, [lastEvent, mutate]);

  if (error) return <ErrorCard onRetry={() => mutate()} />;
  if (isLoading && !alerts) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Alertas</h2>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground">
          Alertas y notificaciones recientes del sistema
        </p>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="space-y-3">
          {alerts?.map((alert) => {
            const config = getTypeConfig(alert.type);
            const Icon = config.icon;

            return (
              <Card
                key={alert.id}
                className={cn(
                  "rounded-lg border-0 border-l-4 overflow-hidden",
                  config.bg
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
                        config.iconBg
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded font-medium px-2 py-0.5 text-xs border-0",
                            config.iconBg
                          )}
                        >
                          {config.label}
                        </Badge>
                        {alert.resolved_at && (
                          <Badge
                            variant="outline"
                            className="rounded bg-green-500/15 text-green-400 border-0 font-medium px-2 py-0.5 text-xs"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Resuelto
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto shrink-0">
                          {new Date(alert.created_at).toLocaleString("es-AR")}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{alert.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {(!alerts || alerts.length === 0) && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                Sin alertas — todo en orden
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
