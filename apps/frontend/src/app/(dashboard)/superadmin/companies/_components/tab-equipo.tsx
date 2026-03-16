"use client";

import type { Professional } from "@talora/shared";
import { CalendarRange, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GoogleCalendarValidation, ProfessionalEditDraft } from "./types";

export function TabEquipo({
  professionals,
  googleCalendars,
  professionalDraft,
  setProfessionalDraft,
  professionalEdits,
  setProfessionalEdits,
  creatingProfessional,
  onCreateProfessional,
  onSaveProfessional,
  onDeleteProfessional,
  onConnectGoogle,
  onDisconnectGoogle,
  onRefresh,
}: {
  professionals: Professional[] | undefined;
  googleCalendars: GoogleCalendarValidation | undefined;
  professionalDraft: { name: string; specialty: string; calendar_id: string; color_hex: string; user_email: string; user_password: string; user_full_name: string };
  setProfessionalDraft: (updater: (current: typeof professionalDraft) => typeof professionalDraft) => void;
  professionalEdits: Record<string, ProfessionalEditDraft>;
  setProfessionalEdits: (updater: (current: Record<string, ProfessionalEditDraft>) => Record<string, ProfessionalEditDraft>) => void;
  creatingProfessional: boolean;
  onCreateProfessional: () => void;
  onSaveProfessional: (professional: Professional) => void;
  onDeleteProfessional: (professionalId: string) => void;
  onConnectGoogle: (professionalId: string) => void;
  onDisconnectGoogle: (professionalId: string) => void;
  onRefresh: () => void;
}) {
  const professionalValidationMap = new Map(
    (googleCalendars?.professionals ?? []).map((item) => [item.id, item])
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">Equipo</h4>
        <Button variant="outline" onClick={onRefresh} className="h-9 rounded-2xl border-[#e5d9c8] bg-white px-3 hover:bg-[#f7efe4]">
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* New professional form */}
      <div className="rounded-[22px] border border-[#ece2d5] bg-[#fcfaf6] p-5">
        <p className="mb-3 text-sm font-semibold text-slate-950">Agregar profesional</p>
        <div className="grid gap-3">
          <Input value={professionalDraft.name} onChange={(event) => setProfessionalDraft((c) => ({ ...c, name: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="Nombre del profesional" />
          <Input value={professionalDraft.specialty} onChange={(event) => setProfessionalDraft((c) => ({ ...c, specialty: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="Especialidad o rol" />
          <div className="grid gap-3 md:grid-cols-[1fr_120px]">
            <select
              value={professionalDraft.calendar_id}
              onChange={(event) => setProfessionalDraft((c) => ({ ...c, calendar_id: event.target.value }))}
              className="h-10 rounded-2xl border border-[#eadfcd] bg-white px-3 text-sm text-slate-700"
            >
              {(googleCalendars?.calendars?.length ?? 0) > 0 ? (
                googleCalendars!.calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.summary}{calendar.primary ? " · principal" : ""}
                  </option>
                ))
              ) : (
                <option value={professionalDraft.calendar_id}>
                  {professionalDraft.calendar_id || "primary"}
                </option>
              )}
            </select>
            <Input value={professionalDraft.color_hex} onChange={(event) => setProfessionalDraft((c) => ({ ...c, color_hex: event.target.value }))} className="h-10 rounded-2xl border-[#eadfcd]" placeholder="#17352d" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={professionalDraft.user_full_name}
              onChange={(event) => setProfessionalDraft((c) => ({ ...c, user_full_name: event.target.value }))}
              className="h-10 rounded-2xl border-[#eadfcd]"
              placeholder="Nombre para el login"
            />
            <Input
              type="email"
              value={professionalDraft.user_email}
              onChange={(event) => setProfessionalDraft((c) => ({ ...c, user_email: event.target.value }))}
              className="h-10 rounded-2xl border-[#eadfcd]"
              placeholder="Email del profesional"
            />
          </div>
          <Input
            type="password"
            value={professionalDraft.user_password}
            onChange={(event) => setProfessionalDraft((c) => ({ ...c, user_password: event.target.value }))}
            className="h-10 rounded-2xl border-[#eadfcd]"
            placeholder="Password inicial del profesional"
          />
          <p className="text-xs text-slate-500">
            Si dejas email y password vacios, se crea solo la agenda. Si los completas, el profesional ya queda listo para iniciar sesion.
          </p>
          <Button disabled={creatingProfessional} onClick={onCreateProfessional} className="h-10 rounded-2xl bg-[#17352d] hover:bg-[#21453a]">
            <Plus className="mr-2 h-4 w-4" />
            {creatingProfessional ? "Guardando..." : "Agregar profesional"}
          </Button>
        </div>
      </div>

      {/* Professional list */}
      {(professionals ?? []).map((professional) => {
        const draft = professionalEdits[professional.id] ?? {};
        const validation = professionalValidationMap.get(professional.id);
        const hasLogin = Boolean(professional.has_login ?? professional.user_id);
        return (
          <div key={professional.id} className="rounded-[22px] border border-[#eadfce] bg-white p-4">
            <div className="grid gap-3">
              <Input
                value={(draft.name as string | undefined) ?? professional.name}
                onChange={(event) => setProfessionalEdits((c) => ({ ...c, [professional.id]: { ...c[professional.id], name: event.target.value } }))}
                className="h-10 rounded-2xl border-[#eadfcd]"
              />
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px]">
                <Input
                  value={(draft.specialty as string | undefined) ?? (professional.specialty ?? "")}
                  onChange={(event) => setProfessionalEdits((c) => ({ ...c, [professional.id]: { ...c[professional.id], specialty: event.target.value } }))}
                  className="h-10 rounded-2xl border-[#eadfcd]"
                  placeholder="Especialidad"
                />
                <select
                  value={(draft.calendar_id as string | undefined) ?? professional.calendar_id}
                  onChange={(event) => setProfessionalEdits((c) => ({ ...c, [professional.id]: { ...c[professional.id], calendar_id: event.target.value } }))}
                  className="h-10 rounded-2xl border border-[#eadfcd] bg-white px-3 text-sm text-slate-700"
                >
                  {(googleCalendars?.calendars?.length ?? 0) > 0 ? (
                    googleCalendars!.calendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.summary}{calendar.primary ? " · principal" : ""}
                      </option>
                    ))
                  ) : (
                    <option value={(draft.calendar_id as string | undefined) ?? professional.calendar_id}>
                      {(draft.calendar_id as string | undefined) ?? professional.calendar_id}
                    </option>
                  )}
                </select>
                <Input
                  value={(draft.color_hex as string | undefined) ?? (professional.color_hex ?? "")}
                  onChange={(event) => setProfessionalEdits((c) => ({ ...c, [professional.id]: { ...c[professional.id], color_hex: event.target.value } }))}
                  className="h-10 rounded-2xl border-[#eadfcd]"
                  placeholder="#17352d"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  value={(draft.user_full_name as string | undefined) ?? (professional.user_full_name ?? professional.name)}
                  onChange={(event) => setProfessionalEdits((c) => ({ ...c, [professional.id]: { ...c[professional.id], user_full_name: event.target.value } }))}
                  className="h-10 rounded-2xl border-[#eadfcd]"
                  placeholder="Nombre del login"
                />
                <Input
                  type="email"
                  value={(draft.user_email as string | undefined) ?? (professional.user_email ?? "")}
                  onChange={(event) => setProfessionalEdits((c) => ({ ...c, [professional.id]: { ...c[professional.id], user_email: event.target.value } }))}
                  className="h-10 rounded-2xl border-[#eadfcd]"
                  placeholder="Email del login"
                />
              </div>
              <Input
                type="password"
                value={(draft.user_password as string | undefined) ?? ""}
                onChange={(event) => setProfessionalEdits((c) => ({ ...c, [professional.id]: { ...c[professional.id], user_password: event.target.value } }))}
                className="h-10 rounded-2xl border-[#eadfcd]"
                placeholder={hasLogin ? "Nueva password (opcional)" : "Password inicial para crear login"}
              />
              <div className={`rounded-2xl px-3 py-2 text-xs ${validation?.is_connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {validation?.is_connected
                  ? `Google conectado${validation.google_account_email ? ` · ${validation.google_account_email}` : ""}`
                  : `Google pendiente para ${((draft.user_email as string | undefined) ?? professional.user_email ?? professional.name)}`}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${hasLogin ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {hasLogin ? "Login activo" : "Sin login"}
                </span>
                <Button
                  variant="outline"
                  onClick={() =>
                    validation?.is_connected
                      ? onDisconnectGoogle(professional.id)
                      : onConnectGoogle(professional.id)
                  }
                  className="h-9 rounded-2xl border-[#e5d9c8] bg-white px-3 hover:bg-[#f7efe4]"
                >
                  <CalendarRange className="mr-2 h-4 w-4" />
                  {validation?.is_connected ? "Desconectar Google" : "Conectar Google"}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onDeleteProfessional(professional.id)} className="h-9 rounded-2xl border-[#edd6d3] bg-white px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
                <Button onClick={() => onSaveProfessional(professional)} className="h-9 rounded-2xl bg-[#17352d] px-3 hover:bg-[#21453a]">
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        );
      })}
      {(professionals ?? []).length === 0 && (
        <div className="rounded-[22px] border border-dashed border-[#e5d9c7] bg-white px-4 py-8 text-center text-sm text-slate-500">
          Todavia no hay profesionales para esta cuenta.
        </div>
      )}
    </div>
  );
}
