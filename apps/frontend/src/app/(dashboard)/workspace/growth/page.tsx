"use client";

import { useState } from "react";
import useSWR from "swr";
import type { ClientAnalytics } from "@talora/shared";
import {
  Phone,
  RefreshCw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { api, companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageEntrance } from "@/components/ui/page-entrance";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SendMessageModalProps {
  client: ClientAnalytics | null;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

interface KanbanColumn {
  id: string;
  title: string;
  dotColor: string;
  clients: ClientAnalytics[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeDays(days: number | null | undefined): string {
  if (days === null || days === undefined) return "—";
  if (days === 0) return "hoy";
  if (days === 1) return "hace 1 dia";
  return `hace ${days} dias`;
}

function buildColumns(clients: ClientAnalytics[]): KanbanColumn[] {
  const activos: ClientAnalytics[] = [];
  const leve: ClientAnalytics[] = [];
  const moderado: ClientAnalytics[] = [];
  const critico: ClientAnalytics[] = [];

  for (const c of clients) {
    const overdue = c.days_overdue ?? 0;
    if (overdue <= 4 || c.risk_score === 0) {
      activos.push(c);
    } else if (overdue <= 11) {
      leve.push(c);
    } else if (overdue <= 30) {
      moderado.push(c);
    } else {
      critico.push(c);
    }
  }

  return [
    { id: "activos", title: "Activos", dotColor: "#22c55e", clients: activos },
    { id: "leve", title: "5–11 dias de atraso", dotColor: "#eab308", clients: leve },
    { id: "moderado", title: "15–30 dias de atraso", dotColor: "#f97316", clients: moderado },
    { id: "critico", title: "30–60 dias de atraso", dotColor: "#ef4444", clients: critico },
  ];
}

function filterClients(clients: ClientAnalytics[], query: string): ClientAnalytics[] {
  if (!query.trim()) return clients;
  const q = query.toLowerCase();
  return clients.filter(
    (c) =>
      (c.client_name ?? "").toLowerCase().includes(q) ||
      (c.client_phone ?? "").toLowerCase().includes(q)
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-[20px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] p-3.5">
      <div className="space-y-2.5">
        <div className="h-4 w-32 rounded-full bg-slate-100" />
        <div className="h-3 w-20 rounded-full bg-slate-100" />
        <div className="flex gap-2 pt-1">
          <div className="h-8 w-8 rounded-xl bg-slate-100" />
          <div className="h-8 flex-1 rounded-xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function ClientCard({
  client,
  onSend,
}: {
  client: ClientAnalytics;
  onSend: (client: ClientAnalytics) => void;
}) {
  return (
    <article className="rounded-[20px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] p-3.5 transition-shadow hover:shadow-sm">
      <p className="text-sm font-semibold text-slate-950 leading-snug">
        {client.client_name ?? "Cliente sin nombre"}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        {formatRelativeDays(client.days_since_last)}
      </p>

      <div className="mt-3 flex items-center gap-2">
        {client.client_phone && (
          <a
            href={`tel:${client.client_phone}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#e6e7ec] bg-white text-slate-500 transition-colors hover:bg-[#f6f7fb]"
            title={client.client_phone}
            aria-label={`Llamar a ${client.client_name ?? "cliente"}`}
          >
            <Phone className="h-3.5 w-3.5" />
          </a>
        )}
        <Button
          onClick={() => onSend(client)}
          className="h-8 flex-1 rounded-xl bg-slate-900 px-3 text-xs text-white hover:bg-slate-800"
        >
          <Send className="mr-1.5 h-3 w-3" />
          Enviar mensaje
        </Button>
      </div>
    </article>
  );
}

function KanbanColumnView({
  column,
  onSend,
  isLoading,
}: {
  column: KanbanColumn;
  onSend: (client: ClientAnalytics) => void;
  isLoading: boolean;
}) {
  return (
    <div className="flex min-w-[260px] flex-1 flex-col rounded-[24px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#f9fafb_0%,#f3f4f8_100%)] p-4">
      {/* Column header */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: column.dotColor }}
        />
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400 flex-1 truncate">
          {column.title}
        </p>
        <span className="rounded-full bg-white border border-[#e6e7ec] px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {column.clients.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2.5">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : column.clients.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#dde1ea] px-3 py-6 text-center">
            <p className="text-xs text-slate-400">Sin clientes</p>
          </div>
        ) : (
          column.clients.map((client) => (
            <ClientCard key={client.client_id} client={client} onSend={onSend} />
          ))
        )}
      </div>
    </div>
  );
}

function SendMessageModal({ client, open, onClose, onSent }: SendMessageModalProps) {
  const [message, setMessage] = useState(
    client
      ? `Hola ${client.client_name ?? ""}! Te escribimos desde el equipo. Hace un tiempo que no te vemos. ¿Querés sacar un turno?`
      : ""
  );
  const [sending, setSending] = useState(false);

  const clientName = client?.client_name ?? "";

  const handleSend = async () => {
    if (!client) return;
    setSending(true);
    try {
      await api.post("/growth/reactivation/send", {
        clientId: client.client_id,
        messageText: message,
      });
      toast.success(`Mensaje enviado a ${clientName}`);
      onSent();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="rounded-[28px] sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Enviar mensaje de reactivacion</DialogTitle>
          <DialogDescription>
            {client
              ? `Enviando mensaje a ${clientName} · ${client.client_phone ?? ""}`
              : "Selecciona un cliente para enviar un mensaje."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-[20px] border border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Cliente</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-950">{clientName || "—"}</p>
            <p className="mt-0.5 text-sm text-slate-500">{client?.client_phone ?? "—"}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message-text">Mensaje</Label>
            <Textarea
              id="message-text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="min-h-[120px] rounded-2xl border-[#dde1ea] shadow-none"
            />
            <p className="text-xs text-slate-400">
              Variables disponibles: {"{{client_name}}"}, {"{{days}}"}, {"{{company_name}}"}
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={onClose}
            className="h-11 flex-1 rounded-2xl border-[#dde1ea] hover:bg-[#f6f7fb]"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => void handleSend()}
            disabled={sending || !message.trim()}
            className="h-11 flex-1 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
          >
            {sending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GrowthPage() {
  const { activeCompanyId } = useAuth();
  const [selectedClient, setSelectedClient] = useState<ClientAnalytics | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const {
    data: allClients,
    isLoading: clientsLoading,
    mutate: mutateClients,
  } = useSWR(
    companyScopedKey("/growth/at-risk?include_active=true&refresh=false&limit=200", activeCompanyId),
    companyScopedFetcher<ClientAnalytics[]>
  );

  // ── Handlers (all declared before useEffect and early returns) ─────────────

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.get("/growth/at-risk?refresh=true");
      await mutateClients();
      toast.success("CRM actualizado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenModal = (client: ClientAnalytics) => {
    setSelectedClient(client);
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedClient(null);
  };

  const handleSent = () => {
    void mutateClients();
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const filtered = filterClients(allClients ?? [], searchQuery);
  const columns = buildColumns(filtered);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <PageEntrance className="min-h-0 flex-1 overflow-y-auto space-y-5 lg:space-y-6">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tab: CRM (active) */}
          <div className="flex rounded-2xl border border-[#e6e7ec] bg-white p-1">
            <button
              type="button"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              CRM
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Input
              type="search"
              placeholder="Buscar cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 rounded-2xl border-[#dde1ea] pl-4 pr-4 text-sm shadow-none"
            />
          </div>

          {/* Refresh */}
          <Button
            variant="outline"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="h-10 rounded-2xl border-[#dde1ea] bg-white px-4 text-slate-600 hover:bg-[#f6f7fb]"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
            Actualizar
          </Button>
        </div>

        {/* Kanban board */}
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-3 px-3 sm:-mx-4 sm:px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
          {columns.map((column) => (
            <KanbanColumnView
              key={column.id}
              column={column}
              onSend={handleOpenModal}
              isLoading={clientsLoading}
            />
          ))}
        </div>
      </PageEntrance>

      <SendMessageModal
        client={selectedClient}
        open={modalOpen}
        onClose={handleModalClose}
        onSent={handleSent}
      />
    </>
  );
}
