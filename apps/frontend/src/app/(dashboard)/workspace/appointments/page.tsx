"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import type { Appointment, Professional, Service } from "@talora/shared";
import { CalendarClock, Clock3, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";
import { WorkspaceEmptyState, WorkspaceMetricCard } from "@/components/workspace/chrome";
import { WorkspaceErrorState } from "@/components/workspace/error-state";

type AppointmentRow = Appointment & {
  professional_name?: string | null;
  service_name?: string | null;
};

type PanelMode =
  | { type: "create" }
  | { type: "reschedule"; appointment: AppointmentRow }
  | null;

const emptyForm = {
  client_name: "",
  phone_number: "",
  professional_id: "",
  service_id: "",
  starts_at: "",
  notes: "",
};

function formatDaySlot(value: string) {
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateInput(value: string) {
  return new Date(value).toISOString().slice(0, 16);
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export default function WorkspaceAppointmentsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompanyId, session } = useAuth();
  const isProfessional = session?.role === "professional";
  const professionalId = session?.professionalId ?? null;

  const appointmentsPath = isProfessional && professionalId
    ? `/appointments?professional_id=${professionalId}`
    : "/appointments";

  const { data: appointments, error: appointmentsError, mutate } = useSWR(
    companyScopedKey(appointmentsPath, activeCompanyId),
    companyScopedFetcher<AppointmentRow[]>
  );
  const { data: professionals } = useSWR(
    companyScopedKey("/professionals", activeCompanyId),
    companyScopedFetcher<Professional[]>
  );
  const { data: services } = useSWR(
    companyScopedKey("/services", activeCompanyId),
    companyScopedFetcher<Service[]>
  );

  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const closePanel = () => {
    setPanelMode(null);
    setForm(emptyForm);
  };

  useEffect(() => {
    closePanel();
  }, [activeCompanyId]);

  const stats = useMemo(() => {
    const rows = appointments ?? [];
    return {
      today: rows.filter((appointment) => appointment.status !== "cancelled" && isToday(appointment.starts_at)).length,
      confirmed: rows.filter((appointment) => appointment.status === "confirmed").length,
      reprogrammed: rows.filter((appointment) => appointment.status === "rescheduled").length,
      cancelled: rows.filter((appointment) => appointment.status === "cancelled").length,
    };
  }, [appointments]);

  const sortedAppointments = useMemo(() => {
    return [...(appointments ?? [])].sort(
      (left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime()
    );
  }, [appointments]);

  useEffect(() => {
    if (pathname === "/workspace/appointments") {
      router.replace("/appointments");
    }
  }, [pathname, router]);

  if (appointmentsError) {
    return <WorkspaceErrorState className="min-h-[50vh]" onRetry={() => { void mutate(); }} />;
  }

  if (!appointments && !professionals) {
    return <LoadingSpinner className="min-h-[70vh]" />;
  }

  const openCreatePanel = () => {
    setForm(emptyForm);
    setPanelMode({ type: "create" });
  };

  const openReschedulePanel = (appointment: AppointmentRow) => {
    setForm({
      client_name: appointment.client_name,
      phone_number: appointment.phone_number,
      professional_id: appointment.professional_id ?? "",
      service_id: appointment.service_id ?? "",
      starts_at: formatDateInput(appointment.starts_at),
      notes: appointment.notes ?? "",
    });
    setPanelMode({ type: "reschedule", appointment });
  };

  const handleSubmit = async () => {
    if (!form.client_name || !form.phone_number || !form.professional_id || !form.starts_at) {
      toast.error("Completa cliente, teléfono, profesional y horario.");
      return;
    }

    setSubmitting(true);
    try {
      if (panelMode?.type === "reschedule") {
        await api.put(`/appointments/${panelMode.appointment.id}`, {
          starts_at: new Date(form.starts_at).toISOString(),
          professional_id: form.professional_id,
          service_id: form.service_id || null,
          notes: form.notes,
        });
        toast.success("Turno reprogramado.");
      } else {
        await api.post("/appointments", {
          client_name: form.client_name,
          phone_number: form.phone_number,
          professional_id: form.professional_id,
          service_id: form.service_id || null,
          starts_at: new Date(form.starts_at).toISOString(),
          notes: form.notes,
          source: "manual",
        });
        toast.success("Turno creado manualmente.");
      }

      await mutate();
      closePanel();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el turno.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (appointmentId: string) => {
    try {
      await api.delete(`/appointments/${appointmentId}`);
      await mutate();
      toast.success("Turno cancelado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cancelar el turno.");
    }
  };

  return (
    <>
      <div className="space-y-5 lg:space-y-6">
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => mutate()}
            className="h-11 rounded-2xl border-[#dde1ea] bg-white px-4 hover:bg-[#f6f7fb]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
          <Button onClick={openCreatePanel} className="h-11 rounded-2xl px-4">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo turno
          </Button>
        </div>

        <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Turnos de hoy", value: stats.today, icon: CalendarClock, tone: "lilac" as const },
            { label: "Confirmados", value: stats.confirmed, icon: Sparkles, tone: "sky" as const },
            { label: "Reprogramados", value: stats.reprogrammed, icon: RefreshCw, tone: "sand" as const },
            { label: "Cancelados", value: stats.cancelled, icon: Clock3, tone: "rose" as const },
          ].map((item) => (
            <WorkspaceMetricCard
              key={item.label}
              label={item.label}
              value={item.value}
              icon={item.icon}
              tone={item.tone}
              caption={
                item.label === "Turnos de hoy"
                  ? "Carga inmediata del equipo."
                  : item.label === "Confirmados"
                    ? "Agenda que ya no necesita seguimiento."
                    : item.label === "Reprogramados"
                      ? "Ajustes que ya movieron la agenda."
                      : "Cancelaciones visibles para no perder contexto."
              }
            />
          ))}
        </section>

        <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[30px]">
          <CardContent className="p-0">
            <div className="hidden border-b border-[#e6e7ec] px-6 py-5 md:block">
              <div className="grid grid-cols-[minmax(0,1.25fr)_190px_190px_130px_180px] gap-4 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                <span>Cliente</span>
                <span>Fecha</span>
                <span>Profesional</span>
                <span>Estado</span>
                <span className="text-right">Acciones</span>
              </div>
            </div>

            {sortedAppointments.length > 0 ? (
              <div className="space-y-3 p-3 md:hidden">
                {sortedAppointments.map((appointment) => (
                  <article
                    key={appointment.id}
                    className="rounded-[24px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{appointment.client_name}</p>
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {appointment.service_name ?? "Turno"} · {appointment.phone_number}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold",
                          appointment.status === "cancelled"
                            ? "bg-[hsl(var(--surface-rose))] text-[#7c5b66]"
                            : appointment.status === "rescheduled"
                              ? "bg-[hsl(var(--surface-sand))] text-[#7b664a]"
                              : "bg-[hsl(var(--surface-mint))] text-[#517261]"
                        )}
                      >
                        {appointment.status === "confirmed"
                          ? "Confirmado"
                          : appointment.status === "rescheduled"
                            ? "Reprogramado"
                            : "Cancelado"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[20px] border border-[#e2e4ec] bg-white px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Fecha</p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">{formatDaySlot(appointment.starts_at)}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {appointment.source === "manual" ? "Carga manual" : appointment.source === "bot" ? "Bot" : "Google Calendar"}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-[#e2e4ec] bg-white px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Profesional</p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">{appointment.professional_name ?? "Profesional"}</p>
                        <p className="mt-1 text-sm text-slate-500">{appointment.notes || "Sin notas"}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="outline"
                        onClick={() => openReschedulePanel(appointment)}
                        className="h-10 flex-1 rounded-2xl border-slate-200 px-3 hover:bg-slate-50"
                      >
                        Reprogramar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleCancel(appointment.id)}
                        className="h-10 flex-1 rounded-2xl border-rose-200 px-3 text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Cancelar
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            <Table className={cn(sortedAppointments.length > 0 ? "hidden md:table" : "table")}>
              <TableHeader className="hidden">
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAppointments.length > 0 ? (
                  sortedAppointments.map((appointment) => (
                    <TableRow key={appointment.id} className="border-[#e6e7ec] hover:bg-[#f7f8fc]">
                      <TableCell className="w-[34%]">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">{appointment.client_name}</p>
                          <p className="mt-1 truncate text-sm text-slate-500">
                            {appointment.service_name ?? "Turno"} · {appointment.phone_number}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="w-[18%]">
                        <p className="tabular-nums text-sm font-semibold text-slate-950">
                          {formatDaySlot(appointment.starts_at)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {appointment.source === "manual" ? "Carga manual" : appointment.source === "bot" ? "Bot" : "Google Calendar"}
                        </p>
                      </TableCell>
                      <TableCell className="w-[18%]">
                        <p className="text-sm font-semibold text-slate-950">{appointment.professional_name ?? "Profesional"}</p>
                        <p className="mt-1 text-sm text-slate-500">{appointment.notes || "Sin notas"}</p>
                      </TableCell>
                      <TableCell className="w-[12%]">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                            appointment.status === "cancelled"
                              ? "bg-[hsl(var(--surface-rose))] text-[#7c5b66]"
                              : appointment.status === "rescheduled"
                                ? "bg-[hsl(var(--surface-sand))] text-[#7b664a]"
                                : "bg-[hsl(var(--surface-mint))] text-[#517261]"
                          )}
                        >
                          {appointment.status === "confirmed"
                            ? "Confirmado"
                            : appointment.status === "rescheduled"
                              ? "Reprogramado"
                              : "Cancelado"}
                        </span>
                      </TableCell>
                      <TableCell className="w-[18%]">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => openReschedulePanel(appointment)}
                            className="h-9 rounded-2xl border-slate-200 px-3 hover:bg-slate-50"
                          >
                            Reprogramar
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleCancel(appointment.id)}
                            className="h-9 rounded-2xl border-rose-200 px-3 text-rose-700 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Cancelar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="px-5 py-14 sm:px-6 sm:py-16">
                      <WorkspaceEmptyState
                        title={isProfessional ? "No tenes turnos asignados todavia." : "Todavia no hay turnos cargados."}
                        description={
                          isProfessional
                            ? "Cuando el bot o tu admin agenden turnos para vos, van a aparecer aca."
                            : "Crea el primer turno manual o espera a que la operacion empiece a llenar esta vista."
                        }
                        action={
                          !isProfessional ? (
                            <Button onClick={openCreatePanel} className="h-10 rounded-2xl px-4">
                              <Plus className="mr-2 h-4 w-4" />
                              Crear turno
                            </Button>
                          ) : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {panelMode && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/24 backdrop-blur-[1px]">
          <div className="flex h-dvh w-full max-w-[520px] flex-col border-l border-[#e2e4ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8f9fc_100%)] shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
            <div className="border-b border-[#e6e7ec] px-5 py-5 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-400">
                    {panelMode.type === "create" ? "Nuevo turno" : "Reprogramar turno"}
                  </p>
                  <h3 className="font-display mt-2 text-[2rem] leading-none text-slate-950">
                    {panelMode.type === "create" ? "Carga manual" : panelMode.appointment.client_name}
                  </h3>
                </div>
                <Button variant="ghost" onClick={closePanel} className="h-11 rounded-2xl px-3 text-slate-500 hover:bg-[#f2f4f9]">
                  Cerrar
                </Button>
              </div>
              <p className="mt-3 text-pretty text-sm leading-6 text-slate-500">
                {panelMode.type === "create"
                  ? "Usa este panel cuando el equipo necesite cargar un turno manualmente."
                  : "Ajusta fecha, profesional o notas sin perder el contexto del turno actual."}
              </p>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Input
                  value={form.client_name}
                  onChange={(event) => setForm((current) => ({ ...current, client_name: event.target.value }))}
                  className="h-12 rounded-2xl border-[#dde1ea] bg-[#f7f8fc]"
                />
              </div>

              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={form.phone_number}
                  onChange={(event) => setForm((current) => ({ ...current, phone_number: event.target.value }))}
                  className="h-12 rounded-2xl border-[#dde1ea] bg-[#f7f8fc]"
                />
              </div>

              <div className="space-y-2">
                <Label>Profesional</Label>
                <Select
                  value={form.professional_id}
                  onValueChange={(value) => setForm((current) => ({ ...current, professional_id: value }))}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-[#dde1ea] bg-[#f7f8fc]">
                    <SelectValue placeholder="Seleccionar profesional" />
                  </SelectTrigger>
                  <SelectContent>
                    {(professionals ?? []).map((professional) => (
                      <SelectItem key={professional.id} value={professional.id}>
                        {professional.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Servicio</Label>
                <Select
                  value={form.service_id}
                  onValueChange={(value) => setForm((current) => ({ ...current, service_id: value }))}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-[#dde1ea] bg-[#f7f8fc]">
                    <SelectValue placeholder="Servicio opcional" />
                  </SelectTrigger>
                  <SelectContent>
                    {(services ?? []).map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fecha y hora</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))}
                  className="h-12 rounded-2xl border-[#dde1ea] bg-[#f7f8fc]"
                />
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Aclaraciones para el equipo"
                  className="min-h-[130px] rounded-2xl border-[#dde1ea] bg-[#f7f8fc] shadow-none"
                />
              </div>
            </div>

            <div className="border-t border-[#e6e7ec] px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={closePanel}
                  className="h-11 flex-1 rounded-2xl border-[#dde1ea] hover:bg-[#f6f7fb]"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="h-11 flex-1 rounded-2xl"
                >
                  {submitting
                    ? "Guardando..."
                    : panelMode.type === "create"
                      ? "Crear turno"
                      : "Guardar cambio"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
