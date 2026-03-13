"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import type { Appointment, Professional } from "@talora/shared";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Layers3,
  Users2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { WorkspaceMetricCard, WorkspaceSectionHeader } from "@/components/workspace/chrome";
import { WorkspaceErrorState } from "@/components/workspace/error-state";

type AppointmentItem = Appointment & {
  professional_name?: string | null;
  service_name?: string | null;
};

type BoardProfessional = {
  id: string;
  name: string;
  specialty: string | null;
  color_hex: string | null;
  calendar_id?: string;
  is_active: boolean;
};

const UNASSIGNED_PROFESSIONAL_ID = "__unassigned__";

const fallbackPalette = ["#1F6F78", "#9F4D34", "#4D6B50", "#5E4AE3", "#9A6D38", "#7A4154"];

function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit" });
}

function formatDayMeta(date: Date) {
  return date.toLocaleDateString("es-AR", { month: "short" });
}

function formatWeekRange(start: Date, end: Date) {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()}-${end.getDate()} ${start.toLocaleDateString("es-AR", { month: "long" })}`;
  }

  return `${start.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
  })} - ${end.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}`;
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameDay(left: Date, right: Date) {
  return getDateKey(left) === getDateKey(right);
}

function normalizeHex(hex: string | null | undefined) {
  if (!hex) return null;
  const trimmed = hex.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getAccentColor(professional: Pick<BoardProfessional, "id" | "color_hex">, index: number) {
  return normalizeHex(professional.color_hex) ?? fallbackPalette[index % fallbackPalette.length];
}

function getDurationLabel(startsAt: string, endsAt: string) {
  const durationMinutes = Math.max(
    15,
    Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000)
  );
  if (durationMinutes % 60 === 0) {
    return `${durationMinutes / 60}h`;
  }
  return `${durationMinutes} min`;
}

export default function WorkspaceCalendarPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompanyId, session } = useAuth();
  const [offsetWeeks, setOffsetWeeks] = useState(0);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("all");
  const isProfessionalSession = session?.role === "professional";
  const sessionProfessionalId = session?.professionalId ?? null;

  const weekStart = useMemo(() => {
    const current = startOfWeek(new Date());
    current.setDate(current.getDate() + offsetWeeks * 7);
    return current;
  }, [offsetWeeks]);

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [weekStart]);

  const { data: professionals, error: professionalsError } = useSWR(
    companyScopedKey("/professionals", activeCompanyId),
    companyScopedFetcher<Professional[]>
  );

  const { data: appointments, error: appointmentsError, mutate: mutateAppointments } = useSWR<AppointmentItem[]>(
    companyScopedKey(
      `/appointments?from=${encodeURIComponent(weekStart.toISOString())}&to=${encodeURIComponent(weekEnd.toISOString())}`,
      activeCompanyId
    ),
    companyScopedFetcher<AppointmentItem[]>
  );

  const calendarDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + index);
      return {
        date,
        key: getDateKey(date),
        label: formatDayLabel(date),
        meta: formatDayMeta(date),
      };
    });
  }, [weekStart]);

  const activeProfessionals = useMemo(() => {
    return (professionals ?? []).filter((professional) => professional.is_active !== false);
  }, [professionals]);

  const professionalMap = useMemo(() => {
    return new Map(activeProfessionals.map((professional) => [professional.id, professional]));
  }, [activeProfessionals]);

  const sortedAppointments = useMemo(() => {
    return [...(appointments ?? [])].sort(
      (left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime()
    );
  }, [appointments]);

  const boardProfessionals = useMemo<BoardProfessional[]>(() => {
    const baseRows: BoardProfessional[] = activeProfessionals.map((professional) => ({
      id: professional.id,
      name: professional.name,
      specialty: professional.specialty ?? null,
      color_hex: professional.color_hex,
      calendar_id: professional.calendar_id,
      is_active: professional.is_active,
    }));

    const hasUnassignedAppointments = sortedAppointments.some((appointment) => {
      return !appointment.professional_id || !professionalMap.has(appointment.professional_id);
    });

    if (hasUnassignedAppointments && selectedProfessionalId === "all") {
      baseRows.push({
        id: UNASSIGNED_PROFESSIONAL_ID,
        name: "Sin asignar",
        specialty: "Revisar setup",
        color_hex: "#667085",
        is_active: true,
      });
    }

    if (selectedProfessionalId === "all") {
      return baseRows;
    }

    return baseRows.filter((professional) => professional.id === selectedProfessionalId);
  }, [activeProfessionals, professionalMap, selectedProfessionalId, sortedAppointments]);

  const visibleAppointments = useMemo(() => {
    if (selectedProfessionalId === "all") {
      return sortedAppointments;
    }

    return sortedAppointments.filter((appointment) => appointment.professional_id === selectedProfessionalId);
  }, [selectedProfessionalId, sortedAppointments]);

  const appointmentsByCell = useMemo(() => {
    const grouped = new Map<string, AppointmentItem[]>();

    for (const appointment of visibleAppointments) {
      const professionalId = appointment.professional_id && professionalMap.has(appointment.professional_id)
        ? appointment.professional_id
        : UNASSIGNED_PROFESSIONAL_ID;
      const cellKey = `${professionalId}:${getDateKey(new Date(appointment.starts_at))}`;
      const currentItems = grouped.get(cellKey) ?? [];
      currentItems.push(appointment);
      grouped.set(cellKey, currentItems);
    }

    return grouped;
  }, [professionalMap, visibleAppointments]);

  const selectedProfessional = useMemo(() => {
    if (selectedProfessionalId === "all") return null;
    return activeProfessionals.find((professional) => professional.id === selectedProfessionalId) ?? null;
  }, [activeProfessionals, selectedProfessionalId]);

  const summary = useMemo(() => {
    const dayLoads = calendarDays.map((day) => ({
      key: day.key,
      label: day.label,
      count: visibleAppointments.filter((appointment) => sameDay(new Date(appointment.starts_at), day.date)).length,
    }));

    const busiestDay = [...dayLoads].sort((left, right) => right.count - left.count)[0];
    const busyProfessionalIds = new Set(
      visibleAppointments
        .map((appointment) => appointment.professional_id)
        .filter((professionalId): professionalId is string => Boolean(professionalId))
    );

    return {
      totalAppointments: visibleAppointments.length,
      visibleProfessionals: boardProfessionals.length,
      busyProfessionals: busyProfessionalIds.size,
      busiestDay,
    };
  }, [boardProfessionals.length, calendarDays, visibleAppointments]);

  useEffect(() => {
    if (pathname === "/workspace/calendar") {
      router.replace("/calendar");
    }
  }, [pathname, router]);

  useEffect(() => {
    setOffsetWeeks(0);
    setSelectedProfessionalId(sessionProfessionalId ?? "all");
  }, [activeCompanyId, sessionProfessionalId]);

  useEffect(() => {
    if (sessionProfessionalId) {
      setSelectedProfessionalId(sessionProfessionalId);
      return;
    }

    if (selectedProfessionalId !== "all" && !activeProfessionals.some((professional) => professional.id === selectedProfessionalId)) {
      setSelectedProfessionalId("all");
    }
  }, [activeProfessionals, selectedProfessionalId, sessionProfessionalId]);

  if (professionalsError || appointmentsError) {
    return <WorkspaceErrorState className="min-h-[50vh]" onRetry={() => { void mutateAppointments(); }} />;
  }

  if (!professionals && !appointments) {
    return <LoadingSpinner className="min-h-[70vh]" />;
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOffsetWeeks((current) => current - 1)}
          className="h-10 w-10 rounded-2xl border-muted bg-white hover:bg-[#f6f7fb]"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span
          className="inline-flex h-10 items-center rounded-2xl border border-muted bg-white px-4 text-sm text-foreground"
        >
          {formatWeekRange(weekStart, weekEnd)}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOffsetWeeks((current) => current + 1)}
          className="h-10 w-10 rounded-2xl border-muted bg-white hover:bg-[#f6f7fb]"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Turnos visibles",
            value: summary.totalAppointments,
            caption: selectedProfessional ? `Modo foco: ${selectedProfessional.name}` : "Vista total de la semana",
            icon: CalendarDays,
            tone: "lilac" as const,
          },
          {
            label: "Profesionales visibles",
            value: summary.visibleProfessionals,
            caption: selectedProfessional ? "Un solo carril operativo" : "Carriles activos en la agenda",
            icon: Users2,
            tone: "sky" as const,
          },
          {
            label: "Profesionales con carga",
            value: summary.busyProfessionals,
            caption: "Cuántos tienen al menos un turno esta semana",
            icon: Layers3,
            tone: "sand" as const,
          },
          {
            label: "Día más cargado",
            value: summary.busiestDay?.count ?? 0,
            caption: summary.busiestDay ? summary.busiestDay.label : "Sin actividad",
            icon: Clock3,
            tone: "mint" as const,
          },
        ].map((item) => (
          <WorkspaceMetricCard
            key={item.label}
            label={item.label}
            value={item.value}
            caption={item.caption}
            icon={item.icon}
            tone={item.tone}
          />
        ))}
      </section>

      <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[30px]">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Filtros</p>
              <h3 className="font-display mt-2 text-[2rem] leading-none text-slate-950">
                {isProfessionalSession ? "Vista personal del calendario" : "Cambiá de vista sin abrir otro login"}
              </h3>
            </div>
            <div className="rounded-full border border-[#dde1ea] bg-[#f6f7fb] px-4 py-2 text-sm text-slate-600">
              {selectedProfessional ? `${selectedProfessional.name} en foco` : "Todos los profesionales"}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {!isProfessionalSession ? (
              <button
                type="button"
                onClick={() => setSelectedProfessionalId("all")}
                  className={`interactive-soft rounded-full border px-4 py-2 text-sm font-medium ${
                    selectedProfessionalId === "all"
                      ? "border-[#1c1d22] bg-[#1c1d22] text-white"
                      : "border-[#dde1ea] bg-[#f7f8fc] text-slate-700 hover:border-[#cfd5e0] hover:bg-white"
                }`}
              >
                Todos
              </button>
            ) : null}
            {activeProfessionals.map((professional, index) => {
              const accent = getAccentColor(professional, index);
              const isSelected = professional.id === selectedProfessionalId;
              return (
                <button
                  key={professional.id}
                  type="button"
                  onClick={() => {
                    if (!isProfessionalSession) {
                      setSelectedProfessionalId(professional.id);
                    }
                  }}
                  disabled={isProfessionalSession}
                  className="interactive-soft rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
                  style={{
                    borderColor: isSelected ? accent : hexToRgba(accent, 0.16),
                    background: isSelected ? accent : hexToRgba(accent, 0.09),
                    color: isSelected ? "#ffffff" : "#24323f",
                  }}
                >
                  {professional.name}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="overflow-hidden rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[32px]">
          <CardContent className="p-0">
            <div className="hidden lg:block">
              <div className="overflow-x-auto">
                <div className="min-w-[1120px]">
                  <div className="grid grid-cols-[260px_repeat(7,minmax(140px,1fr))] border-b border-[#e6e7ec] bg-[#f7f8fc]">
                    <div className="px-6 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Profesional</p>
                      <p className="mt-1 text-sm text-slate-600">Vista recurso por día</p>
                    </div>
                    {calendarDays.map((day) => (
                      <div key={day.key} className="border-l border-[#e6e7ec] px-4 py-4">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{day.meta}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{day.label}</p>
                      </div>
                    ))}
                  </div>

                  {boardProfessionals.map((professional, index) => {
                    const accent = getAccentColor(professional, index);
                    return (
                      <div
                        key={professional.id}
                        className="grid grid-cols-[260px_repeat(7,minmax(140px,1fr))] border-b border-[#eceef3] last:border-b-0"
                      >
                        <div className="border-r border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] px-5 py-5">
                          <div
                            className="rounded-[24px] border p-4"
                            style={{
                              borderColor: hexToRgba(accent, 0.18),
                              background: `linear-gradient(135deg, ${hexToRgba(accent, 0.14)}, rgba(255,255,255,0.92))`,
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{ backgroundColor: accent }}
                              />
                              <div>
                                <p className="text-sm font-semibold text-slate-950">{professional.name}</p>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  {professional.specialty || "Agenda activa"}
                                </p>
                              </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500">
                              <span>{professional.id === UNASSIGNED_PROFESSIONAL_ID ? "Setup pendiente" : "Google conectado"}</span>
                              <span className="rounded-full bg-white/80 px-2.5 py-1 font-medium text-slate-700">
                                {
                                  visibleAppointments.filter((appointment) => {
                                    const appointmentProfessionalId =
                                      appointment.professional_id && professionalMap.has(appointment.professional_id)
                                        ? appointment.professional_id
                                        : UNASSIGNED_PROFESSIONAL_ID;
                                    return appointmentProfessionalId === professional.id;
                                  }).length
                                }{" "}
                                turnos
                              </span>
                            </div>
                          </div>
                        </div>

                        {calendarDays.map((day) => {
                          const cellAppointments = appointmentsByCell.get(`${professional.id}:${day.key}`) ?? [];
                          return (
                            <div
                              key={`${professional.id}-${day.key}`}
                              className="border-l border-[#e6e7ec] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,247,251,0.92))] px-3 py-3"
                            >
                              <div className="flex min-h-[176px] flex-col gap-2">
                                {cellAppointments.length === 0 ? (
                                  <div className="flex min-h-[152px] flex-1 items-end rounded-[24px] border border-dashed border-[#dfe3eb] bg-white/75 p-3 text-xs text-slate-400">
                                    Libre
                                  </div>
                                ) : (
                                  cellAppointments.map((appointment) => (
                                    <article
                                      key={appointment.id}
                                      className="rounded-[24px] border px-3 py-3 shadow-[0_10px_28px_rgba(41,54,73,0.06)]"
                                      style={{
                                        borderColor: hexToRgba(accent, 0.16),
                                        background: `linear-gradient(180deg, ${hexToRgba(accent, 0.1)}, rgba(255,255,255,0.96))`,
                                      }}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <p className="text-sm font-semibold text-slate-950">
                                            {appointment.service_name ?? appointment.title ?? "Turno"}
                                          </p>
                                          <p className="mt-1 text-xs text-slate-600">{appointment.client_name}</p>
                                        </div>
                                        <span className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-700">
                                          {new Date(appointment.starts_at).toLocaleTimeString("es-AR", {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </span>
                                      </div>
                                      <div className="mt-3 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                        <span>{getDurationLabel(appointment.starts_at, appointment.ends_at)}</span>
                                        <span>{appointment.status}</span>
                                      </div>
                                    </article>
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-3 p-3 sm:p-4 lg:hidden">
              {calendarDays.map((day) => {
                const dayAppointments = visibleAppointments.filter((appointment) =>
                  sameDay(new Date(appointment.starts_at), day.date)
                );

                return (
                  <div key={day.key} className="rounded-[24px] border border-[#e6e7ec] bg-[#f8f9fc] p-4 sm:rounded-[28px]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">{day.meta}</p>
                        <h4 className="mt-1 text-lg font-semibold text-slate-950">{day.label}</h4>
                      </div>
                      <span className="rounded-full border border-[#dde1ea] bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                        {dayAppointments.length} turnos
                      </span>
                    </div>

                    <div className="mt-4 space-y-3">
                      {dayAppointments.length === 0 ? (
                        <div className="rounded-[22px] border border-dashed border-[#dfe3eb] bg-white px-4 py-5 text-sm text-slate-400">
                          Día libre.
                        </div>
                      ) : (
                        dayAppointments.map((appointment) => {
                          const professional = appointment.professional_id
                            ? professionalMap.get(appointment.professional_id) ?? null
                            : null;
                          const accent = getAccentColor(
                            professional ?? { id: UNASSIGNED_PROFESSIONAL_ID, color_hex: "#667085" },
                            0
                          );

                          return (
                            <article
                              key={appointment.id}
                              className="interactive-soft rounded-[24px] border px-4 py-4"
                              style={{
                                borderColor: hexToRgba(accent, 0.16),
                                background: `linear-gradient(180deg, ${hexToRgba(accent, 0.11)}, rgba(255,255,255,0.96))`,
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">
                                    {appointment.service_name ?? appointment.title ?? "Turno"}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-600">{appointment.client_name}</p>
                                </div>
                                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">
                                  {new Date(appointment.starts_at).toLocaleTimeString("es-AR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                <span className="rounded-full bg-white/80 px-2.5 py-1">
                                  {professional?.name ?? appointment.professional_name ?? "Sin asignar"}
                                </span>
                                <span className="rounded-full bg-white/80 px-2.5 py-1">
                                  {getDurationLabel(appointment.starts_at, appointment.ends_at)}
                                </span>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none">
            <CardContent className="p-5 sm:p-6">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Profesionales</p>
              <div className="mt-4 space-y-3">
                {boardProfessionals.length === 0 ? (
                  <div className="rounded-[22px] border border-dashed border-[#dfe3eb] bg-[#f7f8fc] px-4 py-5 text-sm text-slate-400">
                    No hay profesionales activos para esta empresa.
                  </div>
                ) : (
                  boardProfessionals.map((professional, index) => {
                    const accent = getAccentColor(professional, index);
                    const isFocused = selectedProfessionalId === professional.id;
                    return (
                      <div
                        key={professional.id}
                        className="interactive-soft rounded-[24px] border px-4 py-4"
                        style={{
                          borderColor: hexToRgba(accent, 0.18),
                          background: `linear-gradient(180deg, ${hexToRgba(accent, 0.09)}, rgba(255,255,255,0.98))`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: accent }}
                            />
                            <div>
                              <p className="text-sm font-semibold text-slate-950">{professional.name}</p>
                              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                {professional.specialty || "Agenda activa"}
                              </p>
                            </div>
                          </div>
                          {isFocused ? (
                            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                              foco
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
