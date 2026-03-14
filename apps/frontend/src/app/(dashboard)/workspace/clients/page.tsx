"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import type { Client } from "@talora/shared";
import { NotebookPen, PhoneCall, Search, UserRound } from "lucide-react";
import { companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageEntrance } from "@/components/ui/page-entrance";
import { AnimatedList, AnimatedItem } from "@/components/ui/animated-list";
import { useAuth } from "@/lib/auth";
import { WorkspaceEmptyState } from "@/components/workspace/chrome";
import { WorkspaceErrorState } from "@/components/workspace/error-state";

export default function WorkspaceClientsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompanyId, session } = useAuth();
  const isProfessional = session?.role === "professional";
  const professionalId = session?.professionalId ?? null;
  const [search, setSearch] = useState("");

  const clientsPath = isProfessional && professionalId
    ? `/clients?professional_id=${professionalId}`
    : "/clients";

  const { data: clients, error: clientsError, mutate } = useSWR(
    companyScopedKey(clientsPath, activeCompanyId),
    companyScopedFetcher<Client[]>
  );

  useEffect(() => {
    setSearch("");
  }, [activeCompanyId]);

  const displayClients = useMemo(() => {
    return (clients ?? []).filter((client) => {
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return (
        (client.name || "Cliente sin nombre").toLowerCase().includes(query) ||
        client.phone_number.toLowerCase().includes(query)
      );
    });
  }, [clients, search]);

  useEffect(() => {
    if (pathname === "/workspace/clients") {
      router.replace("/clients");
    }
  }, [pathname, router]);

  if (clientsError) {
    return <WorkspaceErrorState className="min-h-[50vh]" onRetry={() => { void mutate(); }} />;
  }

  return (
    <PageEntrance className="space-y-5 lg:space-y-6">
      <div className="flex flex-wrap justify-end gap-3">
        <div className="relative w-full min-w-0 sm:w-[320px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar cliente..."
            className="h-11 rounded-2xl border-[#dde1ea] bg-white pl-11 shadow-none"
          />
        </div>
      </div>

      <AnimatedList className="grid gap-4 lg:grid-cols-2">
        {displayClients.map((client, index) => (
          <AnimatedItem key={client.id}>
            <Card className="interactive-soft rounded-[24px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[28px]">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-[20px] text-slate-900"
                  style={{
                    backgroundColor:
                      index % 3 === 0
                        ? "hsl(var(--surface-lilac))"
                        : index % 3 === 1
                          ? "hsl(var(--surface-sky))"
                          : "hsl(var(--surface-sand))",
                  }}
                >
                  <UserRound className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold tracking-[-0.04em] text-slate-950">{client.name || "Cliente sin nombre"}</h3>
                    <span className="rounded-full bg-[hsl(var(--surface-sand))] px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      Proximo turno visible
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-2">
                      <PhoneCall className="h-4 w-4" />
                      {client.phone_number}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <NotebookPen className="h-4 w-4" />
                      {client.notes || "Sin notas internas todavia"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[22px] border border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Proximo turno</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {client.next_appointment_at
                      ? new Date(client.next_appointment_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                      : "Sin turno"}
                  </p>
                </div>
                <div className="rounded-[22px] border border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Historial</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{client.recent_appointments?.length ?? 0} ultimos visibles</p>
                </div>
                <div className="rounded-[22px] border border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Canal</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">WhatsApp</p>
                </div>
              </div>
            </CardContent>
            </Card>
          </AnimatedItem>
        ))}
      </AnimatedList>

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
