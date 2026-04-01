"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import type { CompanySettings } from "@talora/shared";
import { Bell, Clock, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { api, companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { RequireActiveCompany } from "@/components/role-guards";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DAY_LABELS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mie" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" },
];

const DEFAULTS: CompanySettings = {
  id: "",
  company_id: "",
  opening_hour: "09:00",
  closing_hour: "18:00",
  working_days: [1, 2, 3, 4, 5],
  show_prices: false,
  timezone: "America/Argentina/Buenos_Aires",
  reminder_enabled: false,
  reminder_hours_before: 3,
  reminder_message_template: null,
  created_at: "",
  updated_at: "",
};

const REMINDER_TEMPLATE_PLACEHOLDER =
  "Hola {{client_name}}! Te recordamos que tenes turno {{time_description}} para {{service_name}} en {{company_name}}. Te esperamos!";

const REMINDER_VARIABLES = [
  "{{client_name}}",
  "{{service_name}}",
  "{{company_name}}",
  "{{professional_name}}",
  "{{time_description}}",
  "{{date}}",
  "{{time}}",
];

export default function GeneralSettingsPage() {
  const { activeCompanyId } = useAuth();
  const { data: settings, mutate } = useSWR(
    companyScopedKey("/company-settings", activeCompanyId),
    companyScopedFetcher<CompanySettings>
  );
  const [form, setForm] = useState<CompanySettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm(settings);
      setDirty(false);
    }
  }, [settings]);

  const updateField = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const toggleDay = (day: number) => {
    const days = form.working_days.includes(day)
      ? form.working_days.filter((d) => d !== day)
      : [...form.working_days, day];
    updateField("working_days", days);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/company-settings", {
        opening_hour: form.opening_hour,
        closing_hour: form.closing_hour,
        working_days: form.working_days,
        show_prices: form.show_prices,
        timezone: form.timezone,
        reminder_enabled: form.reminder_enabled,
        reminder_hours_before: form.reminder_hours_before,
        reminder_message_template: form.reminder_message_template,
      });
      toast.success("Configuracion guardada.");
      setDirty(false);
      void mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la configuracion.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequireActiveCompany title="Selecciona una empresa" description="Selecciona una empresa para ver su configuracion.">
      <div className="space-y-6">
          {/* Horarios */}
          <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#dfe3eb] bg-[#f6f7fb]">
                  <Clock className="h-4.5 w-4.5 text-slate-600" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Configuracion</p>
                  <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">Horarios</h3>
                </div>
              </div>

              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Hora de apertura</Label>
                  <Input
                    type="time"
                    value={form.opening_hour}
                    onChange={(e) => updateField("opening_hour", e.target.value)}
                    className="h-11 rounded-2xl border-[#dde1ea]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora de cierre</Label>
                  <Input
                    type="time"
                    value={form.closing_hour}
                    onChange={(e) => updateField("closing_hour", e.target.value)}
                    className="h-11 rounded-2xl border-[#dde1ea]"
                  />
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <Label>Dias laborables</Label>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleDay(value)}
                      className={cn(
                        "h-10 w-14 rounded-2xl border text-sm font-medium transition-colors",
                        form.working_days.includes(value)
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-[#dde1ea] bg-white text-slate-500 hover:border-slate-400"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <Label>Zona horaria</Label>
                <Input
                  value={form.timezone}
                  onChange={(e) => updateField("timezone", e.target.value)}
                  className="h-11 rounded-2xl border-[#dde1ea]"
                  placeholder="America/Argentina/Buenos_Aires"
                />
              </div>
            </CardContent>
          </Card>

          {/* Funcionalidades */}
          <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none">
            <CardContent className="p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Funcionalidades</p>
              <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-950">Opciones de la empresa</h3>

              <div className="mt-6 space-y-4">
                <button
                  type="button"
                  onClick={() => updateField("show_prices", !form.show_prices)}
                  className="flex w-full items-center justify-between rounded-[22px] border border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] px-5 py-4 text-left transition-colors hover:border-[#d0d3dc]"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Incluir precios en servicios</p>
                    <p className="mt-1 text-sm text-slate-500">Muestra los precios de los servicios al cliente.</p>
                  </div>
                  {form.show_prices ? (
                    <ToggleRight className="h-8 w-8 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-slate-300" />
                  )}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Recordatorios */}
          <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#dfe3eb] bg-[#f6f7fb]">
                  <Bell className="h-4.5 w-4.5 text-slate-600" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Automatizacion</p>
                  <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">Recordatorios de turno</h3>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <button
                  type="button"
                  onClick={() => updateField("reminder_enabled", !form.reminder_enabled)}
                  className="flex w-full items-center justify-between rounded-[22px] border border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] px-5 py-4 text-left transition-colors hover:border-[#d0d3dc]"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-950">Enviar recordatorios por WhatsApp</p>
                    <p className="mt-1 text-sm text-slate-500">Envia un mensaje automatico antes de cada turno confirmado.</p>
                  </div>
                  {form.reminder_enabled ? (
                    <ToggleRight className="h-8 w-8 shrink-0 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 shrink-0 text-slate-300" />
                  )}
                </button>

                {form.reminder_enabled && (
                  <div className="space-y-4 pl-1">
                    <div className="space-y-2">
                      <Label>Horas antes del turno</Label>
                      <Input
                        type="number"
                        min={1}
                        max={48}
                        value={form.reminder_hours_before}
                        onChange={(e) => updateField("reminder_hours_before", Math.max(1, Math.min(48, parseInt(e.target.value) || 3)))}
                        className="h-11 w-32 rounded-2xl border-[#dde1ea]"
                      />
                      <p className="text-xs text-slate-400">Entre 1 y 48 horas. Por defecto: 3 horas.</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Mensaje personalizado</Label>
                      <textarea
                        value={form.reminder_message_template ?? ""}
                        onChange={(e) => updateField("reminder_message_template", e.target.value || null)}
                        placeholder={REMINDER_TEMPLATE_PLACEHOLDER}
                        rows={3}
                        className="w-full rounded-2xl border border-[#dde1ea] bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-0"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {REMINDER_VARIABLES.map((v) => (
                          <span
                            key={v}
                            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Save */}
          {dirty && (
            <div className="flex justify-end">
              <Button
                onClick={() => void handleSave()}
                disabled={saving}
                className="h-11 rounded-2xl bg-slate-900 px-6 text-white hover:bg-slate-800"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          )}
        </div>
    </RequireActiveCompany>
  );
}
