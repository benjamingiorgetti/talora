"use client";

import { useState } from "react";
import useSWR from "swr";
import type { Company } from "@talora/shared";
import { Activity, Building2, Database, Power, Search, ToggleLeft, ToggleRight, Users } from "lucide-react";
import { toast } from "sonner";
import { api, companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RequireActiveCompany, RequireAdminAccess } from "@/components/role-guards";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CompanyOverview = Company & {
  admin_count: number;
  professional_count: number;
  service_count: number;
  whatsapp_connected: boolean;
  calendar_connection_count: number;
  bot_enabled?: boolean;
};

export default function AdminSettingsPage() {
  const { activeCompanyId } = useAuth();
  const { data: company, mutate } = useSWR(
    companyScopedKey("/companies/current", activeCompanyId),
    companyScopedFetcher<CompanyOverview>
  );
  const [togglingBot, setTogglingBot] = useState(false);

  const botEnabled = company?.bot_enabled !== false;

  const handleToggleBot = async () => {
    if (!company) return;
    setTogglingBot(true);
    try {
      await api.put("/companies/current/bot", { bot_enabled: !botEnabled });
      toast.success(botEnabled ? "Bot desactivado." : "Bot activado.");
      void mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado del bot.");
    } finally {
      setTogglingBot(false);
    }
  };

  return (
    <RequireAdminAccess description="Ajustes de administracion quedan reservados para Talora.">
      <RequireActiveCompany title="Selecciona una empresa" description="Selecciona una empresa para ver sus ajustes.">
        <div className="space-y-6">
          {/* Bot status */}
          <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-[14px] border",
                  botEnabled
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-red-200 bg-red-50"
                )}>
                  <Power className={cn("h-4.5 w-4.5", botEnabled ? "text-emerald-600" : "text-red-500")} />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Control</p>
                  <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">Estado del bot</h3>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  disabled={togglingBot}
                  onClick={() => void handleToggleBot()}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[22px] border px-5 py-4 text-left transition-colors",
                    botEnabled
                      ? "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300"
                      : "border-red-200 bg-red-50/50 hover:border-red-300"
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      Bot {botEnabled ? "activo" : "desactivado"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {botEnabled
                        ? "El bot responde mensajes de WhatsApp normalmente."
                        : "El bot esta apagado. Los mensajes entrantes se ignoran silenciosamente."}
                    </p>
                  </div>
                  {botEnabled ? (
                    <ToggleRight className="h-8 w-8 shrink-0 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 shrink-0 text-slate-300" />
                  )}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Company info */}
          <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#dfe3eb] bg-[#f6f7fb]">
                  <Activity className="h-4.5 w-4.5 text-slate-600" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Informacion</p>
                  <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">Estado del sistema</h3>
                </div>
              </div>

              {company && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Empresa</p>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{company.name}</p>
                    <p className="text-sm text-slate-500">{company.industry}</p>
                  </div>
                  <div className="rounded-[22px] border border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-400" />
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Equipo</p>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{company.professional_count} profesional(es)</p>
                    <p className="text-sm text-slate-500">{company.calendar_connection_count} con calendario</p>
                  </div>
                  <div className="rounded-[22px] border border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", company.whatsapp_connected ? "bg-emerald-500" : "bg-amber-400")} />
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">WhatsApp</p>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {company.whatsapp_connected ? "Conectado" : "Pendiente"}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] px-5 py-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Servicios</p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">{company.service_count} servicio(s)</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Operations — deferred */}
          <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#dfe3eb] bg-[#f6f7fb]">
                  <Database className="h-4.5 w-4.5 text-slate-600" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Operaciones</p>
                  <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">Herramientas de admin</h3>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-dashed border-[#e2e4ec] px-5 py-6 text-center">
                  <Search className="mx-auto h-6 w-6 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-500">Sincronizacion de embeddings</p>
                  <p className="mt-1 text-xs text-slate-400">Proximamente</p>
                </div>
                <div className="rounded-[22px] border border-dashed border-[#e2e4ec] px-5 py-6 text-center">
                  <Database className="mx-auto h-6 w-6 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-500">Backup de base de datos</p>
                  <p className="mt-1 text-xs text-slate-400">Proximamente</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </RequireActiveCompany>
    </RequireAdminAccess>
  );
}
