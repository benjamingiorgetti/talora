"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import type { WhatsAppInstance } from "@talora/shared";
import { fetcher } from "@/lib/api";
import { api } from "@/lib/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Plug, Trash2, RefreshCw, QrCode, Smartphone, Wifi, WifiOff, Loader2, Database, Zap, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ErrorCard } from "@/components/ui/error-card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

// ---------- Health Check ----------

interface HealthChecks {
  database: "ok" | "error";
  evolution: "ok" | "error";
  google_calendar: "ok" | "not_connected" | "error";
}

interface HealthResponse {
  status: "ok" | "degraded";
  timestamp: string;
  checks: HealthChecks;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

function healthFetcher(_key: string): Promise<HealthResponse> {
  return fetch(`${API_URL}/api/health`).then((r) => r.json());
}

function HealthBar() {
  const { data: health, isLoading } = useSWR<HealthResponse>(
    "/api/health",
    healthFetcher,
    { refreshInterval: 30_000, revalidateOnFocus: true }
  );

  const indicators: {
    key: keyof HealthChecks;
    label: string;
    icon: typeof Database;
    getState: (v: string | undefined) => "ok" | "warn" | "error" | "loading";
  }[] = [
    {
      key: "database",
      label: "Base de datos",
      icon: Database,
      getState: (v) => {
        if (!v) return "loading";
        return v === "ok" ? "ok" : "error";
      },
    },
    {
      key: "evolution",
      label: "Evolution API",
      icon: Zap,
      getState: (v) => {
        if (!v) return "loading";
        return v === "ok" ? "ok" : "error";
      },
    },
    {
      key: "google_calendar",
      label: "Google Calendar",
      icon: Calendar,
      getState: (v) => {
        if (!v) return "loading";
        if (v === "ok") return "ok";
        if (v === "not_connected") return "warn";
        return "error";
      },
    },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      aria-label="Estado del sistema"
      role="status"
      aria-live="polite"
    >
      {indicators.map(({ key, label, icon: Icon, getState }) => {
        const rawValue = health?.checks[key];
        const state = isLoading && !health ? "loading" : getState(rawValue);
        const subLabel =
          key === "google_calendar" && rawValue === "not_connected"
            ? "No conectado"
            : null;

        return (
          <div key={key} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                state === "ok" && "bg-green-400 glow-green",
                state === "warn" && "bg-yellow-400 glow-yellow",
                state === "error" && "bg-red-400 glow-red",
                state === "loading" && "bg-muted-foreground/30"
              )}
              aria-hidden="true"
            />
            <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span
              className={cn(
                state === "ok" && "text-green-400",
                state === "warn" && "text-yellow-400",
                state === "error" && "text-red-400",
                state === "loading" && "text-muted-foreground/50"
              )}
            >
              {label}
            </span>
            {subLabel && (
              <span className="text-muted-foreground/60">— {subLabel}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- Status Dot ----------

function StatusDot({ status }: { status: WhatsAppInstance["status"] }) {
  const label =
    status === "connected"
      ? "Conectado"
      : status === "qr_pending"
      ? "QR Pendiente"
      : "Desconectado";

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "h-2 w-2 rounded-full shrink-0",
          status === "connected" && "bg-green-400 glow-green",
          status === "qr_pending" && "bg-yellow-400 glow-yellow",
          status === "disconnected" && "bg-red-400 glow-red"
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          "text-xs font-medium",
          status === "connected" && "text-green-400",
          status === "qr_pending" && "text-yellow-400",
          status === "disconnected" && "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { data: instances, error, isLoading, mutate } = useSWR<WhatsAppInstance[]>("/instances", fetcher);
  const { lastEvent } = useWebSocket();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  const [qrTimeoutRef, setQrTimeoutRef] = useState<ReturnType<typeof setTimeout> | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === "instance:status") {
      mutate((prev) => {
        if (!prev) return prev;
        return prev.map((inst) =>
          inst.id === lastEvent.payload.id
            ? {
                ...inst,
                status: lastEvent.payload.status,
                qr_code: lastEvent.payload.qr_code ?? inst.qr_code,
              }
            : inst
        );
      }, false);

      if (connectingId === lastEvent.payload.id) {
        if (lastEvent.payload.qr_code) {
          if (qrTimeoutRef) { clearTimeout(qrTimeoutRef); setQrTimeoutRef(null); }
          setQrData(lastEvent.payload.qr_code);
        }
        if (lastEvent.payload.status === "connected") {
          if (qrTimeoutRef) { clearTimeout(qrTimeoutRef); setQrTimeoutRef(null); }
          setQrOpen(false);
          setConnectingId(null);
          toast.success("Conectado exitosamente");
        }
      }
    }
  }, [lastEvent, connectingId, mutate, qrTimeoutRef]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post("/instances", { name: newName.trim() });
      await mutate();
      setCreateOpen(false);
      setNewName("");
      toast.success("Instancia creada");
    } catch (err) {
      console.error(err);
      toast.error("Error al crear instancia");
    } finally {
      setCreating(false);
    }
  };

  const handleConnect = async (instance: WhatsAppInstance) => {
    setConnectingId(instance.id);
    setQrData(null);
    setQrError(null);
    setQrOpen(true);

    // Timeout: if no QR arrives within 15s (neither from response nor WebSocket), show error
    if (qrTimeoutRef) clearTimeout(qrTimeoutRef);
    const timeout = setTimeout(() => {
      setQrData((current) => {
        if (!current) {
          setQrError("No se pudo obtener el codigo QR. Intenta de nuevo.");
        }
        return current;
      });
    }, 15_000);
    setQrTimeoutRef(timeout);

    try {
      const res = await api.post<{ data: { qr_code?: string } }>(`/instances/${instance.id}/connect`);
      if (res.data.qr_code) {
        clearTimeout(timeout);
        setQrTimeoutRef(null);
        setQrData(res.data.qr_code);
      }
    } catch (err) {
      clearTimeout(timeout);
      setQrTimeoutRef(null);
      console.error(err);
      const message = err instanceof Error ? err.message : "Error al conectar";
      setQrError(message);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/instances/${deleteId}`);
      await mutate();
      toast.success("Instancia eliminada");
    } catch (err) {
      console.error(err);
      toast.error("Error al eliminar");
    } finally {
      setDeleteOpen(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">
            Instancias de WhatsApp
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Gestiona las conexiones de WhatsApp del bot
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Nueva Instancia
        </Button>
      </div>

      {/* System Health Bar */}
      <HealthBar />

      {/* Card Grid */}
      {error ? (
        <ErrorCard onRetry={() => mutate()} />
      ) : isLoading ? (
        <LoadingSpinner />
      ) : instances && instances.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-muted">
            <Smartphone className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">
            No hay instancias todavia
          </h3>
          <p className="mt-1 text-sm text-muted-foreground/60">
            Crea tu primera instancia para empezar
          </p>
          <Button
            onClick={() => setCreateOpen(true)}
            className="mt-6 h-9 rounded-lg px-4 text-sm font-medium"
          >
            <Plus className="mr-2 h-4 w-4" />
            Crear Instancia
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances?.map((inst) => (
            <Card
              key={inst.id}
              className="rounded-lg border border-border bg-card overflow-hidden hover:border-[hsl(222_20%_22%)] transition-colors"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <StatusDot status={inst.status} />
                  <button
                    onClick={() => confirmDelete(inst.id)}
                    aria-label="Eliminar instancia"
                    className="text-muted-foreground hover:text-destructive transition-colors p-1 -mr-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>

                <h3 className="text-sm font-semibold mb-0.5">{inst.name}</h3>
                <p className="text-xs text-muted-foreground font-mono">
                  {inst.phone_number ?? "Sin numero asignado"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/60">
                  Creada: {new Date(inst.created_at).toLocaleDateString("es-AR")}
                </p>

                <div className="mt-4">
                  {inst.status === "connected" ? (
                    <Button
                      variant="outline"
                      onClick={() => handleConnect(inst)}
                      className="w-full h-8 rounded-lg text-xs font-medium"
                    >
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                      Reconectar
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleConnect(inst)}
                      className="w-full h-8 rounded-lg bg-primary text-xs font-medium"
                    >
                      <Plug className="mr-2 h-3.5 w-3.5" />
                      Conectar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Instance Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Nueva Instancia
            </DialogTitle>
            <DialogDescription>
              Crea una nueva instancia de WhatsApp para conectar un numero.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nombre</Label>
              <Input
                placeholder="Mi WhatsApp"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="h-9 rounded-lg bg-transparent border-border text-sm"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="h-9 rounded-lg text-sm font-medium"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="h-9 rounded-lg text-sm font-medium"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="rounded-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <QrCode className="h-4 w-4 text-primary" aria-hidden="true" />
              Escanea el QR
            </DialogTitle>
            <DialogDescription>
              Abre WhatsApp en tu telefono y escanea este codigo para conectar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-5">
            {qrData ? (
              <div className="rounded-lg bg-white p-4">
                <img
                  src={qrData.startsWith("data:") ? qrData : `data:image/png;base64,${qrData}`}
                  alt="QR Code"
                  className="h-64 w-64 rounded"
                />
              </div>
            ) : qrError ? (
              <div className="flex h-64 w-64 flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/10">
                <WifiOff className="mb-3 h-7 w-7 text-destructive" aria-hidden="true" />
                <p className="text-sm font-medium text-destructive">Error al conectar</p>
                <p className="mt-1 max-w-[200px] text-center text-xs text-destructive/70">{qrError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const inst = instances?.find((i) => i.id === connectingId);
                    if (inst) handleConnect(inst);
                  }}
                  className="mt-4 h-8 rounded-lg text-xs font-medium"
                >
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                  Reintentar
                </Button>
              </div>
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-muted border border-border">
                <div className="text-center text-muted-foreground">
                  <Loader2 className="mb-3 mx-auto h-6 w-6 animate-spin" aria-hidden="true" />
                  <p className="text-sm">Esperando QR...</p>
                </div>
              </div>
            )}
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {qrError ? "Verifica que Evolution API este corriendo" : "Escanea el QR con WhatsApp"}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-lg sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Eliminar Instancia
            </DialogTitle>
            <DialogDescription>
              Esta accion no se puede deshacer. Se eliminara la instancia y todos sus datos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-3">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="h-9 rounded-lg text-sm font-medium flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              className="h-9 rounded-lg bg-destructive text-sm font-medium text-destructive-foreground hover:bg-destructive/90 flex-1"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
