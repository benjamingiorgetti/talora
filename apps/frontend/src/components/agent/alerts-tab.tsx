"use client";

import { useEffect } from "react";
import useSWR from "swr";
import type { Alert } from "@bottoo/shared";
import { fetcher } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Info, AlertCircle, CheckCircle2, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { ErrorCard } from "@/components/ui/error-card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const typeConfig: Record<string, { icon: typeof Info; bg: string; iconBg: string; label: string }> = {
  error: {
    icon: AlertCircle,
    bg: "bg-red-50 border-l-red-500",
    iconBg: "bg-red-100 text-red-600",
    label: "Error",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-yellow-50 border-l-yellow-500",
    iconBg: "bg-yellow-100 text-yellow-600",
    label: "Advertencia",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50 border-l-blue-500",
    iconBg: "bg-blue-100 text-blue-600",
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
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight">Alertas</h2>
        <p className="mt-1 text-lg text-muted-foreground font-semibold">
          Alertas y notificaciones recientes del sistema
        </p>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="space-y-4">
          {alerts?.map((alert) => {
            const config = getTypeConfig(alert.type);
            const Icon = config.icon;

            return (
              <Card
                key={alert.id}
                className={cn(
                  "rounded-2xl border-0 border-l-4 shadow-sm overflow-hidden",
                  config.bg
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "h-12 w-12 rounded-2xl flex items-center justify-center shrink-0",
                        config.iconBg
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full font-bold px-3 py-1 text-sm",
                            config.iconBg
                          )}
                        >
                          {config.label}
                        </Badge>
                        {alert.resolved_at && (
                          <Badge
                            variant="outline"
                            className="rounded-full bg-green-100 text-green-700 border-green-200 font-bold px-3 py-1 text-sm"
                          >
                            <CheckCircle2 className="mr-1.5 h-4 w-4" />
                            Resuelto
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground ml-auto shrink-0 font-semibold">
                          {new Date(alert.created_at).toLocaleString("es-AR")}
                        </span>
                      </div>
                      <p className="text-base font-semibold">{alert.message}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {(!alerts || alerts.length === 0) && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <PartyPopper className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-xl font-bold text-muted-foreground">
                Sin alertas — todo en orden
              </p>
              <p className="text-muted-foreground">
                Cuando algo requiera atencion, aparecera aca
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
