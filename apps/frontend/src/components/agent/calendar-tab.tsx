"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GoogleCalendarStatus {
  connected: boolean;
  configured: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function googleStatusFetcher(_key: string): Promise<GoogleCalendarStatus> {
  return api.get<GoogleCalendarStatus>("/auth/google/status");
}

export function CalendarTab() {
  const searchParams = useSearchParams();

  const {
    data: status,
    error,
    isLoading,
    mutate,
  } = useSWR<GoogleCalendarStatus>("/auth/google/status", googleStatusFetcher, {
    refreshInterval: 10_000,
  });

  // Show success toast when OAuth redirects back with ?calendar=connected
  useEffect(() => {
    if (searchParams.get("calendar") === "connected") {
      toast.success("Google Calendar conectado correctamente");
      mutate();
    }
  }, [searchParams, mutate]);

  const handleConnect = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const url = token
      ? `${API_URL}/auth/google?token=${encodeURIComponent(token)}`
      : `${API_URL}/auth/google`;
    window.location.href = url;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Google Calendar</h2>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground">
          Conecta Google Calendar para que el bot pueda consultar disponibilidad y agendar citas
        </p>
      </div>

      {/* Status card */}
      <div>
        {isLoading && !status ? (
          <Card className="rounded-lg border border-border">
            <CardContent className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm font-medium">Verificando estado...</p>
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="rounded-lg border border-border">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
                <AlertTriangle className="h-6 w-6 text-red-400" aria-hidden="true" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Error al verificar estado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  No se pudo obtener el estado de la conexion
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => mutate()}
                className="h-9 rounded-md text-sm font-medium"
              >
                Reintentar
              </Button>
            </CardContent>
          </Card>
        ) : !status?.configured ? (
          <NotConfiguredState />
        ) : status.connected ? (
          <ConnectedState onDisconnect={() => mutate()} />
        ) : (
          <NotConnectedState onConnect={handleConnect} />
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            title: "Disponibilidad",
            description: "El bot consulta slots libres en tiempo real antes de confirmar una cita",
          },
          {
            title: "Agendamiento",
            description: "Crea eventos directamente en tu calendario cuando un cliente confirma",
          },
          {
            title: "Recordatorios",
            description: "Los clientes reciben confirmacion automatica por WhatsApp",
          },
        ].map((feature) => (
          <Card
            key={feature.title}
            className="rounded-lg border border-border"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold">{feature.title}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- Sub-states ----------

function NotConfiguredState() {
  return (
    <Card className="rounded-lg border-l-4 border-yellow-500/60 border-t-border border-r-border border-b-border bg-yellow-500/5">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="h-9 w-9 rounded-md bg-yellow-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-yellow-400" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Configuracion requerida</p>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              Para usar Google Calendar necesitas configurar las credenciales de OAuth en el servidor.
              Agrega las siguientes variables de entorno en{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
                apps/backend/.env
              </code>
              :
            </p>
            <div className="mt-3 rounded-md bg-muted border border-border p-3 font-mono text-xs text-muted-foreground leading-relaxed space-y-1">
              <p>GOOGLE_CLIENT_ID=tu-client-id</p>
              <p>GOOGLE_CLIENT_SECRET=tu-client-secret</p>
              <p>GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback</p>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Obtene estas credenciales en{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                Google Cloud Console
              </a>
              .
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NotConnectedState({ onConnect }: { onConnect: () => void }) {
  return (
    <Card className="rounded-lg border border-border">
      <CardContent className="flex flex-col items-center justify-center py-12 gap-5">
        <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center">
          <Calendar className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="text-center max-w-sm">
          <p className="text-sm font-semibold text-foreground">Google Calendar no conectado</p>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Conecta tu cuenta de Google para que el bot pueda ver tu disponibilidad y crear citas
            automaticamente.
          </p>
        </div>
        <Button
          onClick={onConnect}
          className="h-9 rounded-md px-5 text-sm font-medium"
        >
          <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
          Conectar Google Calendar
        </Button>
        <p className="text-xs text-muted-foreground">
          Se abrira el flujo de autorizacion de Google OAuth
        </p>
      </CardContent>
    </Card>
  );
}

function ConnectedState({ onDisconnect }: { onDisconnect: () => void }) {
  return (
    <Card className="rounded-lg border-l-4 border-primary/60 border-t-border border-r-border border-b-border bg-primary/5">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
              <CheckCircle2 className="h-2.5 w-2.5 text-background" aria-hidden="true" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold text-foreground">Google Calendar conectado</p>
              <span className={cn(
                "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
                "bg-primary/15 text-primary"
              )}>
                Activo
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              El bot puede consultar disponibilidad y agendar citas automaticamente.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={onDisconnect}
            className="h-8 rounded-md border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400 text-sm font-medium shrink-0"
          >
            Desconectar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
