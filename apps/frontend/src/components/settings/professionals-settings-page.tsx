"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import type { Appointment, Professional } from "@talora/shared";
import {
  AlertTriangle,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ExternalLink,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Users2,
} from "lucide-react";
import { toast } from "sonner";
import { api, companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { WorkspaceEmptyState, WorkspaceMetricCard, WorkspaceSectionHeader } from "@/components/workspace/chrome";

type GoogleCalendarProfessionalStatus = {
  id: string;
  name: string;
  specialty: string | null;
  calendar_id: string;
  google_account_email: string | null;
  is_connected: boolean;
};

type GoogleCalendarsPayload = {
  configured: boolean;
  connected: boolean;
  professional_id: string | null;
  calendars: Array<{
    id: string;
    summary: string;
    primary: boolean;
    access_role: string;
    background_color: string | null;
  }>;
  professionals: GoogleCalendarProfessionalStatus[];
  connected_calendar_count: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export function ProfessionalsSettingsPage() {
  const searchParams = useSearchParams();
  const { activeCompanyId, session, token } = useAuth();
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", specialty: "", calendar_id: "primary" });

  const {
    data: professionals,
    mutate: mutateProfessionals,
  } = useSWR(
    companyScopedKey("/professionals", activeCompanyId),
    companyScopedFetcher<Professional[]>
  );
  const {
    data: googleCalendars,
    mutate: mutateGoogleCalendars,
  } = useSWR(
    companyScopedKey("/auth/google/calendars", activeCompanyId),
    companyScopedFetcher<GoogleCalendarsPayload>
  );

  const weekRange = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, []);

  const { data: weekAppointments } = useSWR(
    companyScopedKey(
      `/appointments?from=${encodeURIComponent(weekRange.start.toISOString())}&to=${encodeURIComponent(weekRange.end.toISOString())}`,
      activeCompanyId
    ),
    companyScopedFetcher<Appointment[]>
  );

  useEffect(() => {
    if (searchParams.get("calendar") === "connected") {
      toast.success("Google Calendar conectado correctamente.");
      void mutateGoogleCalendars();
      void mutateProfessionals();
      return;
    }

    if (searchParams.get("calendar") === "error") {
      toast.error("No se pudo completar la conexión con Google Calendar.");
    }
  }, [mutateGoogleCalendars, mutateProfessionals, searchParams]);

  const connectionMap = useMemo(() => {
    return new Map((googleCalendars?.professionals ?? []).map((professional) => [professional.id, professional]));
  }, [googleCalendars?.professionals]);

  const stats = useMemo(() => {
    const rows = googleCalendars?.professionals ?? [];
    const isConfigured = googleCalendars?.configured ?? false;
    const dbConnected = rows.filter((professional) => professional.is_connected).length;
    return {
      total: rows.length,
      pending: isConfigured ? rows.length - dbConnected : rows.length,
      calendarsVisible: isConfigured
        ? (googleCalendars?.calendars.length || googleCalendars?.connected_calendar_count || 0)
        : 0,
      weekAppointments: weekAppointments?.length ?? 0,
    };
  }, [googleCalendars, weekAppointments]);

  if (!professionals || !googleCalendars) {
    return <LoadingSpinner className="min-h-[70vh]" />;
  }

  const handleConnect = (professionalId: string) => {
    if (!token) {
      toast.error("La sesión expiró. Volvé a iniciar sesión.");
      return;
    }

    const url = new URL(`${API_URL}/auth/google`);
    url.searchParams.set("token", token);
    url.searchParams.set("professional_id", professionalId);
    url.searchParams.set("return_to", "/settings/professionals");
    window.location.href = url.toString();
  };

  const handleDisconnect = async (professionalId: string) => {
    setDisconnectingId(professionalId);
    try {
      await api.post(`/auth/google/disconnect?professional_id=${encodeURIComponent(professionalId)}`);
      await mutateGoogleCalendars();
      toast.success("Google Calendar desconectado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo desconectar Google Calendar.");
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleCreate = async () => {
    if (!draft.name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    setCreating(true);
    try {
      await api.post("/professionals", {
        name: draft.name.trim(),
        specialty: draft.specialty.trim() || "",
        calendar_id: draft.calendar_id.trim() || "primary",
        is_active: true,
      });
      await mutateProfessionals();
      await mutateGoogleCalendars();
      setShowCreateDialog(false);
      setDraft({ name: "", specialty: "", calendar_id: "primary" });
      toast.success("Profesional creado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el profesional.");
    } finally {
      setCreating(false);
    }
  };

  const activeProfessionals = professionals.filter((professional) => professional.is_active !== false);
  const isProfessionalSession = session?.role === "professional";

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-[#dfe4ee] bg-[radial-gradient(circle_at_top_left,#fbfcff_0%,#f3f6fc_46%,#ecf0f9_100%)] p-5 shadow-[0_18px_36px_rgba(29,48,84,0.06)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <WorkspaceSectionHeader
            eyebrow="Google Calendar"
            title={isProfessionalSession ? "Tu agenda" : "Google por profesional"}
          />
          <div className="flex gap-2">
            {!isProfessionalSession && (
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="h-11 rounded-2xl px-4"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuevo profesional
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                void mutateGoogleCalendars();
                void mutateProfessionals();
              }}
              className="h-11 rounded-2xl border-[#d9dfeb] bg-white px-4 hover:bg-[#f5f7fc]"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar estado
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetricCard label="Profesionales visibles" value={stats.total} icon={Users2} tone="sky" />
          <WorkspaceMetricCard label="Turnos esta semana" value={stats.weekAppointments} icon={CalendarDays} tone="mint" />
          <WorkspaceMetricCard label="Pendientes" value={stats.pending} icon={CalendarClock} tone="rose" />
          <WorkspaceMetricCard label="Calendarios accesibles" value={stats.calendarsVisible} icon={CalendarCheck2} tone="lilac" />
        </div>
      </section>

      {!googleCalendars.configured ? (
        <Card className="rounded-[28px] border-[#f0ddba] bg-[#fff9ef] shadow-none">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff1cd] text-[#8d6525]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Google OAuth no configurado</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  El servidor necesita <code className="rounded bg-[#f0e4d0] px-1 py-0.5 text-xs">GOOGLE_CLIENT_ID</code>, <code className="rounded bg-[#f0e4d0] px-1 py-0.5 text-xs">GOOGLE_CLIENT_SECRET</code> y <code className="rounded bg-[#f0e4d0] px-1 py-0.5 text-xs">GOOGLE_REDIRECT_URI</code> en el archivo <code className="rounded bg-[#f0e4d0] px-1 py-0.5 text-xs">.env</code> del backend.
                  {(googleCalendars.professionals ?? []).some((p) => p.is_connected)
                    ? " Las conexiones existentes en la base de datos no funcionarán hasta que se configuren estas credenciales."
                    : ""}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeProfessionals.length === 0 ? (
        <WorkspaceEmptyState
          title="No hay profesionales activos."
          description="Primero hace falta crear profesionales para poder mapear agendas y conexiones de Google."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {activeProfessionals.map((professional) => {
            const connection = connectionMap.get(professional.id);
            const hasDbConnection = Boolean(connection?.is_connected);
            const isConnected = hasDbConnection && googleCalendars.configured;
            const isStale = hasDbConnection && !googleCalendars.configured;
            const isBusy = disconnectingId === professional.id;

            return (
              <Card key={professional.id} className="rounded-[28px] border-[#dfe4ee] bg-white shadow-[0_14px_28px_rgba(15,23,42,0.04)]">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xl font-semibold tracking-[-0.03em] text-slate-950">{professional.name}</p>
                        <Badge className={
                          isConnected
                            ? "rounded-full border-[#d6e5d0] bg-[#f4fbf0] px-3 py-1 text-[#365240]"
                            : isStale
                              ? "rounded-full border-[#f0ddba] bg-[#fff9ef] px-3 py-1 text-[#8d6525]"
                              : "rounded-full border-[#efd7d7] bg-[#fff5f5] px-3 py-1 text-[#8a4f4f]"
                        }>
                          {isConnected ? "Conectado" : isStale ? "Inactivo" : "Pendiente"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{professional.specialty || "Sin especialidad visible"}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isConnected || isStale ? (
                        <Button
                          variant="outline"
                          onClick={() => void handleDisconnect(professional.id)}
                          disabled={isBusy}
                          className="h-10 rounded-2xl border-[#edd6d3] bg-white px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Desconectar Google
                        </Button>
                      ) : googleCalendars.configured ? (
                        <Button onClick={() => handleConnect(professional.id)} className="h-10 rounded-2xl px-3">
                          <Link2 className="mr-2 h-4 w-4" />
                          Conectar Google
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-[#e6ebf3] bg-[#f7f9fd] px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Agenda objetivo</p>
                      <p className="mt-2 text-sm font-medium text-slate-900 break-all">{professional.calendar_id}</p>
                    </div>
                    <div className="rounded-[22px] border border-[#e6ebf3] bg-[#f7f9fd] px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Cuenta conectada</p>
                      <p className="mt-2 text-sm font-medium text-slate-900 break-all">
                        {connection?.google_account_email
                          ?? (hasDbConnection ? "(email no registrado)" : "Todavía no hay cuenta vinculada")}
                      </p>
                    </div>
                  </div>

                  {isProfessionalSession && googleCalendars.calendars.length > 0 && professional.id === session?.professionalId ? (
                    <div className="mt-5 rounded-[24px] border border-[#e6ebf3] bg-[#f8faff] p-4">
                      <div className="flex items-center gap-2 text-slate-900">
                        <ExternalLink className="h-4 w-4" />
                        <p className="text-sm font-semibold">Calendarios que Google deja ver en esta sesión</p>
                      </div>
                      <div className="mt-3 space-y-2">
                        {googleCalendars.calendars.slice(0, 6).map((calendar) => (
                          <div key={calendar.id} className="rounded-2xl border border-[#dfe5f0] bg-white px-3 py-3 text-sm text-slate-600">
                            <p className="font-medium text-slate-900">{calendar.summary}</p>
                            <p className="mt-1 break-all text-xs text-slate-500">{calendar.id}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="rounded-[28px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo profesional</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="prof-name">Nombre *</Label>
              <Input
                id="prof-name"
                placeholder="Ej: Juli"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                className="rounded-2xl border-[#dfe4ee]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prof-specialty">Especialidad</Label>
              <Input
                id="prof-specialty"
                placeholder="Ej: Blackwork"
                value={draft.specialty}
                onChange={(e) => setDraft((d) => ({ ...d, specialty: e.target.value }))}
                className="rounded-2xl border-[#dfe4ee]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prof-calendar">Calendar ID</Label>
              <Input
                id="prof-calendar"
                placeholder="primary"
                value={draft.calendar_id}
                onChange={(e) => setDraft((d) => ({ ...d, calendar_id: e.target.value }))}
                className="rounded-2xl border-[#dfe4ee]"
              />
              <p className="text-xs text-slate-400">
                Dejalo en &quot;primary&quot; si vas a conectar Google Calendar despues.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="rounded-2xl">
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} disabled={creating} className="rounded-2xl">
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear profesional
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
