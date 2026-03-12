"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import type { Appointment, Company, Conversation, DashboardMetrics, WhatsAppInstance } from "@talora/shared";
import { ArrowRight, CalendarCheck2, CalendarDays, CheckCircle2, Clock3, MessageSquareText, Sparkles } from "lucide-react";
import { companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  WorkspaceEmptyState,
  WorkspaceMetricCard,
  WorkspaceSectionHeader,
} from "@/components/workspace/chrome";

type WorkspaceAppointment = Appointment & {
  professional_name?: string | null;
  service_name?: string | null;
};

function formatMetric(value: number, suffix = "") {
  return `${new Intl.NumberFormat("es-AR").format(value)}${suffix}`;
}

function isSameDay(value: string, target: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
}

function formatSlot(value: string) {
  return new Date(value).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildCalendarMatrix(reference: Date) {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const leading = (firstDay.getDay() + 6) % 7;
  const trailing = 41 - leading - lastDay.getDate();
  const days: Array<{ day: number; currentMonth: boolean; date: Date }> = [];

  for (let index = leading; index > 0; index -= 1) {
    const date = new Date(year, month, 1 - index);
    days.push({ day: date.getDate(), currentMonth: false, date });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push({ day, currentMonth: true, date: new Date(year, month, day) });
  }

  for (let day = 1; day <= trailing; day += 1) {
    const date = new Date(year, month + 1, day);
    days.push({ day: date.getDate(), currentMonth: false, date });
  }

  const weeks = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }
  return weeks;
}

export default function WorkspaceDashboardPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompanyId } = useAuth();
  const { data: metrics } = useSWR(companyScopedKey("/dashboard/metrics", activeCompanyId), companyScopedFetcher<DashboardMetrics>);
  const { data: company } = useSWR(companyScopedKey("/companies/current", activeCompanyId), companyScopedFetcher<Company>);
  const { data: appointments } = useSWR(companyScopedKey("/appointments", activeCompanyId), companyScopedFetcher<WorkspaceAppointment[]>);
  const { data: conversations } = useSWR(companyScopedKey("/conversations?page=1&limit=8", activeCompanyId), companyScopedFetcher<Conversation[]>);
  const { data: instances } = useSWR(companyScopedKey("/instances", activeCompanyId), companyScopedFetcher<WhatsAppInstance[]>);
  const today = useMemo(() => new Date(), []);

  const upcomingAppointments = useMemo(() => {
    return (appointments ?? [])
      .filter((appointment) => appointment.status !== "cancelled" && new Date(appointment.starts_at).getTime() >= today.getTime())
      .sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime())
      .slice(0, 5);
  }, [appointments, today]);

  const todayAppointments = useMemo(() => {
    return (appointments ?? []).filter(
      (appointment) => appointment.status !== "cancelled" && isSameDay(appointment.starts_at, today)
    );
  }, [appointments, today]);

  const pausedConversations = useMemo(
    () => (conversations ?? []).filter((conversation) => conversation.bot_paused),
    [conversations]
  );

  const connectedInstances = useMemo(
    () => (instances ?? []).filter((instance) => instance.status === "connected"),
    [instances]
  );

  const calendarWeeks = useMemo(() => buildCalendarMatrix(today), [today]);

  useEffect(() => {
    if (pathname === "/workspace") {
      router.replace("/dashboard");
    }
  }, [pathname, router]);

  const isLoading = !metrics && !appointments;

  if (isLoading) {
    return <LoadingSpinner className="min-h-[70vh]" />;
  }

  const dashboardMetrics = [
    {
      label: "Turnos de hoy",
      value: formatMetric(todayAppointments.length),
      tone: "lilac" as const,
      icon: CalendarDays,
      caption: "Volumen real que el equipo tiene encima hoy.",
    },
    {
      label: "Confirmados",
      value: formatMetric(metrics?.confirmed_appointments ?? 0),
      tone: "sky" as const,
      icon: CheckCircle2,
      caption: "Agenda ya validada y lista para ejecutarse.",
    },
    {
      label: "Pendientes",
      value: formatMetric(pausedConversations.length),
      tone: "sand" as const,
      icon: Clock3,
      caption: "Casos donde conviene takeover o revisión humana.",
    },
    {
      label: "Resolución automática",
      value: formatMetric(metrics?.automation_rate ?? 0, "%"),
      tone: "mint" as const,
      icon: Sparkles,
      caption: "Cuánto de la operación avanza sin intervención.",
    },
  ];

  return (
    <div className="grid gap-5 lg:gap-6 xl:grid-cols-[minmax(0,1.32fr)_340px]">
      <div className="space-y-6">
        <section className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardMetrics.map((metric) => (
            <WorkspaceMetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              caption={metric.caption}
              icon={metric.icon}
              tone={metric.tone}
            />
          ))}
        </section>

        <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[30px]">
          <CardContent className="p-5 sm:p-6 lg:p-7">
            <WorkspaceSectionHeader
              eyebrow="Operación del día"
              title="Qué necesita atención y qué ya está resuelto"
              description="La lógica visual acá es simple: paneles neutros para estructura, color pastel solo para los bloques que resumen estado."
              action={
                <Button asChild variant="outline" className="h-11 rounded-2xl border-[#dde1ea] px-4 hover:bg-[#f6f7fb]">
                  <Link href="/calendar">
                    Ver calendario completo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              }
            />

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {[
                {
                  title: "Agenda activa",
                  description: company?.calendar_connected
                    ? "La agenda ya está vinculada y la disponibilidad puede usarse como fuente real."
                    : "Hasta cerrar la conexión, la disponibilidad no es 100% confiable.",
                  icon: CalendarCheck2,
                  tone: "sky" as const,
                  status: company?.calendar_connected ? "Google Calendar conectado" : "Falta terminar la conexión",
                },
                {
                  title: "Bandeja operativa",
                  description:
                    connectedInstances.length > 0
                      ? "Talora ya puede usarse como inbox real cuando una conversación necesita intervención."
                      : "Conectar WhatsApp es lo que termina de volver vendible el workspace.",
                  icon: MessageSquareText,
                  tone: "mint" as const,
                  status: connectedInstances.length > 0 ? "Lista para takeover humano" : "WhatsApp todavía pendiente",
                },
                {
                  title: "Acción inmediata",
                  description:
                    pausedConversations.length > 0
                      ? "Entrá a WhatsApp para revisar los casos fuera de guion y no dejar huecos en la agenda."
                      : "El bot está operando sin fricción visible sobre la cuenta activa.",
                  icon: Clock3,
                  tone: "sand" as const,
                  status:
                    pausedConversations.length > 0
                      ? `${pausedConversations.length} conversaciones piden revisión`
                      : "No hay excepciones abiertas",
                },
              ].map((item) => {
                const Icon = item.icon;
                const accentClass =
                  item.tone === "sky"
                    ? "bg-[hsl(var(--surface-sky))]"
                    : item.tone === "mint"
                      ? "bg-[hsl(var(--surface-mint))]"
                      : "bg-[hsl(var(--surface-sand))]";

                return (
                  <div
                    key={item.title}
                    className="interactive-soft rounded-[24px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8f9fc_100%)] p-5 sm:rounded-[28px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-11 w-11 items-center justify-center rounded-[18px] text-slate-900", accentClass)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{item.title}</p>
                        <p className="text-lg font-semibold text-slate-950">{item.status}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-pretty text-sm leading-6 text-slate-500">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[30px]">
          <CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">Calendario</p>
                <h3 className="font-display mt-2 text-[2.1rem] leading-none text-slate-950">
                  {today.toLocaleDateString("es-AR", {
                    month: "long",
                    year: "numeric",
                  })}
                </h3>
              </div>
              <div className="rounded-[20px] border border-[#dde1ea] bg-[#f6f7fb] px-3 py-2 text-sm font-medium text-slate-600">
                {today.toLocaleDateString("es-AR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase text-slate-400">
              {["L", "M", "X", "J", "V", "S", "D"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {calendarWeeks.map((week, index) => (
                <div key={index} className="grid grid-cols-7 gap-2">
                  {week.map((day) => {
                    const isCurrentDay = isSameDay(day.date.toISOString(), today);

                    return (
                      <div
                        key={day.date.toISOString()}
                        className={cn(
                          "flex h-11 items-center justify-center rounded-[18px] border text-sm tabular-nums",
                          day.currentMonth
                            ? "border-transparent text-slate-800"
                            : "border-transparent text-slate-300",
                          isCurrentDay && "border-[#d8dcf0] bg-[hsl(var(--surface-lilac))] font-semibold text-slate-950"
                        )}
                      >
                        {day.day}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[30px]">
          <CardContent className="p-5 sm:p-6">
            <WorkspaceSectionHeader
              eyebrow="Próximos turnos"
              title="Lo que viene ahora"
              action={
                <Button asChild variant="ghost" className="h-10 rounded-2xl px-3 text-slate-600 hover:bg-[#f4f5fa]">
                  <Link href="/appointments">Ver todos</Link>
                </Button>
              }
            />

            <div className="mt-6 space-y-3">
              {upcomingAppointments.length > 0 ? (
                upcomingAppointments.map((appointment, index) => (
                  <div
                    key={appointment.id}
                    className="interactive-soft flex gap-4 rounded-[24px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] p-4"
                  >
                    <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-[20px] border border-[#dde1ea] bg-white text-center shadow-sm">
                      <span className="tabular-nums text-lg font-semibold text-slate-950">
                        {formatSlot(appointment.starts_at)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-950">{appointment.client_name}</p>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {appointment.service_name ?? "Turno"} · {appointment.professional_name ?? "Profesional"}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        {new Date(appointment.starts_at).toLocaleDateString("es-AR", {
                          weekday: "long",
                          day: "2-digit",
                          month: "long",
                        })}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "mt-1 h-16 w-1 rounded-full",
                        index === 0
                          ? "bg-[#c8b8f6]"
                          : index === 1
                            ? "bg-[#f0c8d5]"
                            : index === 2
                              ? "bg-[#c5e8f3]"
                              : "bg-[#d7ead8]"
                      )}
                    />
                  </div>
                ))
              ) : (
                <WorkspaceEmptyState
                  title="Todavía no hay turnos programados."
                  description="Cuando la agenda se empiece a mover, este panel va a mostrar lo siguiente que viene para el equipo."
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
