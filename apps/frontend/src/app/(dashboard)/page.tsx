"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import type { WhatsAppInstance } from "@bottoo/shared";
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
import { Plus, Plug, Trash2, RefreshCw, QrCode, Smartphone, Wifi, WifiOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ErrorCard } from "@/components/ui/error-card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

function TrafficLight({ status }: { status: WhatsAppInstance["status"] }) {
  const config = {
    connected: {
      bg: "bg-green-500",
      pulse: "pulse-green",
      label: "Conectado",
      icon: Wifi,
    },
    disconnected: {
      bg: "bg-red-500",
      pulse: "",
      label: "Desconectado",
      icon: WifiOff,
    },
    qr_pending: {
      bg: "bg-orange-400",
      pulse: "pulse-orange",
      label: "QR Pendiente",
      icon: QrCode,
    },
  };
  const c = config[status];
  const Icon = c.icon;

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "h-12 w-12 rounded-full flex items-center justify-center",
          c.bg,
          c.pulse
        )}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>
      <span
        className={cn(
          "text-sm font-bold",
          status === "connected" && "text-green-600",
          status === "disconnected" && "text-red-500",
          status === "qr_pending" && "text-orange-500"
        )}
      >
        {c.label}
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
  const [connectingId, setConnectingId] = useState<string | null>(null);

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
          setQrData(lastEvent.payload.qr_code);
        }
        if (lastEvent.payload.status === "connected") {
          setQrOpen(false);
          setConnectingId(null);
          toast.success("Conectado exitosamente");
        }
      }
    }
  }, [lastEvent, connectingId, mutate]);

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
    setQrOpen(true);
    try {
      const res = await api.post<{ data: { qr_code?: string } }>(`/instances/${instance.id}/connect`);
      if (res.data.qr_code) {
        setQrData(res.data.qr_code);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al conectar");
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            Instancias de WhatsApp
          </h1>
          <p className="mt-1 text-lg text-muted-foreground font-semibold">
            Gestiona las conexiones de WhatsApp del bot
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="h-14 rounded-xl bg-primary px-6 text-base font-extrabold shadow-lg shadow-primary/20 hover:shadow-xl transition-all duration-200"
        >
          <Plus className="mr-2 h-5 w-5" />
          Nueva Instancia
        </Button>
      </div>

      {/* Card Grid */}
      {error ? (
        <ErrorCard onRetry={() => mutate()} />
      ) : isLoading ? (
        <LoadingSpinner />
      ) : instances && instances.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Smartphone className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-bold text-muted-foreground">
            No hay instancias todavia
          </h3>
          <p className="mt-1 text-muted-foreground">
            Crea tu primera instancia para empezar
          </p>
          <Button
            onClick={() => setCreateOpen(true)}
            className="mt-6 h-12 rounded-xl px-6 text-base font-bold"
          >
            <Plus className="mr-2 h-5 w-5" />
            Crear Instancia
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instances?.map((inst) => (
            <Card
              key={inst.id}
              className="hover-lift rounded-2xl border-0 shadow-md shadow-black/5 overflow-hidden"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-5">
                  <TrafficLight status={inst.status} />
                </div>

                <h3 className="text-xl font-extrabold mb-1">{inst.name}</h3>
                <p className="text-muted-foreground font-semibold">
                  {inst.phone_number ?? "Sin numero asignado"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Creada: {new Date(inst.created_at).toLocaleDateString("es-AR")}
                </p>

                <div className="mt-5 flex gap-3">
                  {inst.status === "connected" ? (
                    <Button
                      variant="outline"
                      onClick={() => handleConnect(inst)}
                      className="flex-1 h-12 rounded-xl border-2 text-base font-bold hover:bg-muted transition-all"
                    >
                      <RefreshCw className="mr-2 h-5 w-5" />
                      Reconectar
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleConnect(inst)}
                      className="flex-1 h-12 rounded-xl bg-primary text-base font-bold shadow-md shadow-primary/20 hover:shadow-lg transition-all"
                    >
                      <Plug className="mr-2 h-5 w-5" />
                      Conectar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => confirmDelete(inst.id)}
                    className="h-12 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 px-4 transition-all"
                  >
                    <Trash2 className="mr-2 h-5 w-5" />
                    Eliminar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Instance Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold">
              Nueva Instancia
            </DialogTitle>
            <DialogDescription className="text-base">
              Crea una nueva instancia de WhatsApp para conectar un numero.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-base font-bold">Nombre</Label>
              <Input
                placeholder="Mi WhatsApp"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="h-12 rounded-xl border-2 text-base"
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="h-12 rounded-xl border-2 text-base font-bold"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="h-12 rounded-xl text-base font-bold"
            >
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
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
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl font-extrabold">
              <QrCode className="h-7 w-7 text-primary" />
              Escanea el QR
            </DialogTitle>
            <DialogDescription className="text-base">
              Abre WhatsApp en tu telefono y escanea este codigo para conectar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            {qrData ? (
              <div className="rounded-2xl bg-white p-4 shadow-inner">
                <img
                  src={qrData.startsWith("data:") ? qrData : `data:image/png;base64,${qrData}`}
                  alt="QR Code"
                  className="h-64 w-64 rounded-xl"
                />
              </div>
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5">
                <div className="text-center text-muted-foreground">
                  <div className="mb-3 mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <p className="font-bold">Esperando QR...</p>
                </div>
              </div>
            )}
            <p className="mt-4 text-center text-muted-foreground font-semibold">
              Escanea el QR con WhatsApp
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-red-600">
              Eliminar Instancia
            </DialogTitle>
            <DialogDescription className="text-base">
              Esta accion no se puede deshacer. Se eliminara la instancia y todos sus datos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="h-12 rounded-xl border-2 text-base font-bold flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              className="h-12 rounded-xl bg-red-500 text-base font-bold text-white hover:bg-red-600 flex-1"
            >
              <Trash2 className="mr-2 h-5 w-5" />
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
