"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import type { Client, Professional, Service } from "@talora/shared";
import { Filter, MessageCircle, Plus, Search, UserRound } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageEntrance } from "@/components/ui/page-entrance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { WorkspaceEmptyState } from "@/components/workspace/chrome";
import { WorkspaceErrorState } from "@/components/workspace/error-state";

function formatNextAppointment(dateStr: string | null | undefined): { label: string; urgent: boolean } {
  if (!dateStr) return { label: "Sin turno", urgent: false };
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const time = d.toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit" });

  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();

  if (isToday) return { label: `Hoy ${time}`, urgent: diffHours <= 3 };
  if (isTomorrow) return { label: `Mañana ${time}`, urgent: false };
  return {
    label: d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
    urgent: false,
  };
}

export default function WorkspaceClientsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompanyId, session } = useAuth();
  const isProfessional = session?.role === "professional";
  const professionalId = session?.professionalId ?? null;
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", phone_number: "", professional_id: "", notes: "" });

  const clientsPath = isProfessional && professionalId
    ? `/clients?professional_id=${professionalId}`
    : "/clients";

  const { data: clients, error: clientsError, mutate } = useSWR(
    companyScopedKey(clientsPath, activeCompanyId),
    companyScopedFetcher<Client[]>
  );

  const { data: professionals } = useSWR(
    !isProfessional ? companyScopedKey("/professionals", activeCompanyId) : null,
    companyScopedFetcher<Professional[]>
  );

  const { data: services } = useSWR(
    companyScopedKey("/services", activeCompanyId),
    companyScopedFetcher<Service[]>
  );

  const handleCreateClient = async () => {
    if (!newClient.phone_number.trim()) return;
    const profId = isProfessional ? professionalId : newClient.professional_id || null;
    if (!profId) {
      toast.error("Selecciona un profesional.");
      return;
    }
    setCreating(true);
    try {
      await api.post("/clients", {
        phone_number: newClient.phone_number.trim(),
        name: newClient.name.trim() || undefined,
        professional_id: profId,
        notes: newClient.notes.trim() || undefined,
      });
      toast.success("Cliente creado.");
      setCreateOpen(false);
      setNewClient({ name: "", phone_number: "", professional_id: "", notes: "" });
      void mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el cliente.");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    setSearch("");
    setServiceFilter("all");
  }, [activeCompanyId]);

  const displayClients = useMemo(() => {
    return (clients ?? []).filter((client) => {
      const query = search.trim().toLowerCase();
      if (query) {
        const matchesSearch =
          (client.name || "Cliente sin nombre").toLowerCase().includes(query) ||
          client.phone_number.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (serviceFilter !== "all") {
        const hasService = client.booked_services?.some(s => s.id === serviceFilter);
        if (!hasService) return false;
      }
      return true;
    });
  }, [clients, search, serviceFilter]);

  useEffect(() => {
    if (pathname === "/workspace/clients") {
      router.replace("/clients");
    }
  }, [pathname, router]);

  if (clientsError) {
    return <WorkspaceErrorState className="min-h-[50vh]" onRetry={() => { void mutate(); }} />;
  }

  return (
    <PageEntrance className="min-h-0 flex-1 overflow-y-auto space-y-5 lg:space-y-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="h-11 rounded-2xl bg-slate-900 px-5 text-white hover:bg-slate-800">
              <Plus className="mr-2 h-4 w-4" />
              Crear cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-[28px] sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Nuevo cliente</DialogTitle>
              <DialogDescription>Crea un cliente de forma manual.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="client-name">Nombre</Label>
                <Input
                  id="client-name"
                  value={newClient.name}
                  onChange={(e) => setNewClient((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Juan Perez"
                  className="h-11 rounded-2xl border-[#dde1ea]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-phone">Telefono *</Label>
                <Input
                  id="client-phone"
                  value={newClient.phone_number}
                  onChange={(e) => setNewClient((prev) => ({ ...prev, phone_number: e.target.value }))}
                  placeholder="5491112345678"
                  className="h-11 rounded-2xl border-[#dde1ea]"
                />
              </div>
              {!isProfessional && (professionals?.length ?? 0) > 0 && (
                <div className="space-y-2">
                  <Label>Profesional *</Label>
                  <Select
                    value={newClient.professional_id}
                    onValueChange={(value) => setNewClient((prev) => ({ ...prev, professional_id: value }))}
                  >
                    <SelectTrigger className="h-11 rounded-2xl border-[#dde1ea]">
                      <SelectValue placeholder="Selecciona un profesional" />
                    </SelectTrigger>
                    <SelectContent>
                      {(professionals ?? []).map((prof) => (
                        <SelectItem key={prof.id} value={prof.id}>
                          {prof.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="client-notes">Notas</Label>
                <Input
                  id="client-notes"
                  value={newClient.notes}
                  onChange={(e) => setNewClient((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notas internas..."
                  className="h-11 rounded-2xl border-[#dde1ea]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => void handleCreateClient()}
                disabled={creating || !newClient.phone_number.trim()}
                className="h-11 w-full rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
              >
                {creating ? "Creando..." : "Crear cliente"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="h-11 w-auto min-w-[180px] rounded-2xl border-[#dde1ea] bg-white">
            <Filter className="mr-2 h-3.5 w-3.5 text-slate-400" />
            <SelectValue placeholder="Todos los servicios" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los servicios</SelectItem>
            {(services ?? []).filter(s => s.is_active).map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative ml-auto w-full min-w-0 sm:w-[320px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar cliente..."
            className="h-11 rounded-2xl border-[#dde1ea] bg-white pl-11 shadow-none"
          />
        </div>
      </div>

      {/* Table */}
      {displayClients.length > 0 && (
        <div className="rounded-[28px] border border-[#e6e7ec] bg-white overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#f0f1f5]">
                <th className="px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">
                  Nombre
                </th>
                <th className="hidden sm:table-cell px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">
                  Telefono
                </th>
                <th className="hidden md:table-cell px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">
                  Proximo turno
                </th>
                <th className="hidden md:table-cell px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">
                  Servicio
                </th>
                <th className="hidden lg:table-cell px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">
                  Historial
                </th>
                <th className="hidden lg:table-cell px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">
                  Canal
                </th>
              </tr>
            </thead>
            <tbody>
              {displayClients.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => router.push(`/workspace/clients/${client.id}`)}
                  className="border-b border-[#f0f1f5] last:border-0 hover:bg-[#fafafa] transition-colors cursor-pointer"
                >
                  {/* Nombre */}
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--surface-lilac))]">
                        <UserRound className="h-4 w-4 text-slate-700" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950 leading-snug">
                          {client.name || "Cliente sin nombre"}
                        </p>
                        {/* Phone visible on mobile below name */}
                        <p className="truncate text-xs text-slate-500 sm:hidden">
                          {client.phone_number}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Telefono */}
                  <td className="hidden sm:table-cell px-5 py-3">
                    <span className="text-sm text-slate-500">{client.phone_number}</span>
                  </td>

                  {/* Proximo turno */}
                  <td className="hidden md:table-cell px-5 py-3">
                    {(() => {
                      const apt = formatNextAppointment(client.next_appointment_at);
                      return (
                        <span className={`text-sm ${apt.urgent ? "text-amber-600 font-semibold" : client.next_appointment_at ? "text-slate-950 font-medium" : "text-slate-400"}`}>
                          {apt.label}
                        </span>
                      );
                    })()}
                  </td>

                  {/* Servicio */}
                  <td className="hidden md:table-cell px-5 py-3">
                    {client.booked_services && client.booked_services.length > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="border-0 bg-[hsl(var(--surface-sand))] text-slate-700 text-xs font-medium">
                          {client.booked_services[0].name}
                        </Badge>
                        {client.booked_services.length > 1 && (
                          <span className="text-xs text-slate-400">+{client.booked_services.length - 1}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">--</span>
                    )}
                  </td>

                  {/* Historial */}
                  <td className="hidden lg:table-cell px-5 py-3">
                    <span className="text-sm text-slate-500">
                      {client.recent_appointments?.length ?? 0} ultimos visibles
                    </span>
                  </td>

                  {/* Canal */}
                  <td className="hidden lg:table-cell px-5 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                      <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                      WhatsApp
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {displayClients.length === 0 && (
        <WorkspaceEmptyState
          title={isProfessional ? "No tenes clientes asignados todavia." : "No hay clientes para mostrar."}
          description={
            isProfessional
              ? "Cuando el bot reciba mensajes de tus clientes, van a aparecer aca."
              : "Cuando entren conversaciones y turnos reales, esta vista va a empezar a construir contexto util para el equipo."
          }
          className="mx-auto max-w-2xl"
        />
      )}
    </PageEntrance>
  );
}
