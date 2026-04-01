"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import type { Appointment, Company, Conversation, DashboardMetrics, GrowthStats, WhatsAppInstance } from "@talora/shared";
import { ArrowRight, CalendarCheck2, CalendarDays, ChartColumnIncreasing, Clock3, MessageSquareText, Timer } from "lucide-react";
import { companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageEntrance } from "@/components/ui/page-entrance";
import { AnimatedList, AnimatedItem } from "@/components/ui/animated-list";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { WorkspaceEmptyState, WorkspaceMetricCard, WorkspaceSectionHeader } from "@/components/workspace/chrome";
import { WorkspaceErrorState } from "@/components/workspace/error-state";

type WorkspaceAppointment = Appointment & {
  professional_name?: string | null;
  service_name?: string | null;
};

function formatMetric(value: number, suffix = "") {
  return `${new Intl.NumberFormat("es-AR").format(value)}${suffix}`;
}

function formatDecimalMetric(value: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function isSameDay(value: string, target: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
}

function formatTimeSaved(minutes: number) {
  if (minutes <= 0) return "0m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatBotActivity(isoDate: string | null | undefined): { label: string; tone: "green" | "yellow" | "red" } {
  if (!isoDate) return { label: "Sin actividad registrada", tone: "red" };
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return { label: "Activo hace instantes", tone: "green" };
  if (diffMin < 60) return { label: `Activo hace ${diffMin} min`, tone: diffMin < 30 ? "green" : "yellow" };
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return { label: `Ultima actividad hace ${diffH}h`, tone: diffH < 2 ? "yellow" : "red" };
  return { label: `Ultima actividad hace ${Math.floor(diffH / 24)}d`, tone: "red" };
}

function getCurrentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function formatAppointmentDateTime(isoDate: string) {
  const date = new Date(isoDate);
  return {
    day: date.toLocaleDateString("es-AR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
    time: date.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  };
}

function formatConversationActivity(isoDate: string | null | undefined) {
  if (!isoDate) return "Sin actividad reciente";
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.max(1, Math.floor(diffMs / 60_000));
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH} h`;
  return `Hace ${Math.floor(diffH / 24)} d`;
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "green" | "yellow" | "red" | "neutral";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "yellow"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "red"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-[#dde1ea] bg-white text-slate-600";

  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium", toneClass)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}

export default function WorkspaceDashboardPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompanyId, session } = useAuth();
  const isProfessional = session?.role === "professional";
  const professionalId = session?.professionalId ?? null;

  const appointmentsPath = isProfessional && professionalId
    ? `/appointments?professional_id=${professionalId}`
    : "/appointments";
  const conversationsPath = isProfessional && professionalId
    ? `/conversations?page=1&limit=8&state=active&professional_id=${professionalId}`
    : "/conversations?page=1&limit=8";
  const growthRange = useMemo(() => getCurrentMonthRange(), []);

  const { data: metrics, error: metricsError, mutate: mutateMetrics } = useSWR(
    companyScopedKey("/dashboard/metrics", activeCompanyId),
    companyScopedFetcher<DashboardMetrics>
  );
  const { data: company } = useSWR(
    companyScopedKey("/companies/current", activeCompanyId),
    companyScopedFetcher<Company>
  );
  const { data: appointments, error: appointmentsError, mutate: mutateAppointments } = useSWR(
    companyScopedKey(appointmentsPath, activeCompanyId),
    companyScopedFetcher<WorkspaceAppointment[]>
  );
  const { data: conversations } = useSWR(
    companyScopedKey(conversationsPath, activeCompanyId),
    companyScopedFetcher<Conversation[]>
  );
  const { data: instances } = useSWR(
    isProfessional ? null : companyScopedKey("/instances", activeCompanyId),
    companyScopedFetcher<WhatsAppInstance[]>
  );
  const { data: growthStats } = useSWR(
    companyScopedKey(`/growth/stats?from=${growthRange.from}&to=${growthRange.to}`, activeCompanyId),
    companyScopedFetcher<GrowthStats>
  );
  const today = useMemo(() => new Date(), []);

  const todayAppointments = useMemo(() => {
    return (appointments ?? []).filter(
      (appointment) => appointment.status !== "cancelled" && isSameDay(appointment.starts_at, today)
    );
  }, [appointments, today]);

  const pausedConversations = useMemo(
    () => (conversations ?? []).filter((conversation) => conversation.bot_paused),
    [conversations]
  );

  const upcomingAppointments = useMemo(() => {
    return [...(appointments ?? [])]
      .filter((appointment) => appointment.status !== "cancelled" && new Date(appointment.starts_at) >= new Date())
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .slice(0, 4);
  }, [appointments]);

  const reviewQueue = useMemo(
    () =>
      [...pausedConversations]
        .sort(
          (a, b) =>
            new Date(b.last_message_at ?? b.created_at).getTime() -
            new Date(a.last_message_at ?? a.created_at).getTime()
        )
        .slice(0, 4),
    [pausedConversations]
  );

  const connectedInstances = useMemo(
    () => (instances ?? []).filter((instance) => instance.status === "connected"),
    [instances]
  );

  useEffect(() => {
    if (pathname === "/workspace") {
      router.replace("/dashboard");
    }
  }, [pathname, router]);

  const hasError = metricsError || appointmentsError;
  if (hasError) {
    return (
      <WorkspaceErrorState
        className="min-h-[50vh]"
        onRetry={() => { void mutateMetrics(); void mutateAppointments(); }}
      />
    );
  }

  const isLoading = !metrics && !appointments;
  if (isLoading) {
    return <LoadingSpinner className="min-h-[70vh]" />;
  }

  const relativeDemand = metrics?.relative_demand;
  const hasZeroBaseline = (relativeDemand?.sample_size ?? 0) > 0 && (relativeDemand?.historical_avg_count ?? 0) === 0;
  const relativeDemandValue = relativeDemand?.has_enough_data
    ? formatMetric(relativeDemand.ratio_pct, "%")
    : "Sin base";
  const relativeDemandCaption = relativeDemand?.has_enough_data
    ? `${relativeDemand.today_count} hoy vs ${formatDecimalMetric(relativeDemand.historical_avg_count)} promedio. Ultimos ${relativeDemand.sample_size} dias comparables hasta esta hora.`
    : hasZeroBaseline
      ? `Hoy van ${relativeDemand?.today_count ?? 0} turnos confirmados. El historico comparable venia en 0, asi que no hay base para porcentajes.`
    : `Hoy van ${relativeDemand?.today_count ?? 0} turnos confirmados. Falta historial comparable para marcar un ritmo confiable.`;

  const dashboardMetrics = [
    {
      label: isProfessional ? "Mis turnos de hoy" : "Turnos de hoy",
      value: formatMetric(todayAppointments.length),
      tone: "lilac" as const,
      icon: CalendarDays,
      caption: "Carga real del dia.",
    },
    {
      label: "Pendientes",
      value: formatMetric(pausedConversations.length),
      tone: "sand" as const,
      icon: Clock3,
      caption: "Casos que piden revision humana.",
    },
    {
      label: "Tiempo ahorrado",
      value: formatTimeSaved(metrics?.estimated_time_saved_minutes ?? 0),
      tone: "neutral" as const,
      icon: Timer,
      caption: "Estimado por gestion automatizada.",
    },
    {
      label: "Demanda hoy",
      value: relativeDemandValue,
      tone: "neutral" as const,
      icon: ChartColumnIncreasing,
      caption: relativeDemandCaption,
    },
  ];

  const operationalAlerts: Array<{
    key: string;
    label: string;
    title: string;
    note: string;
    href: string;
    action: string;
    icon: typeof CalendarCheck2;
    tone: "sky" | "sand" | "mint";
  }> = isProfessional
    ? []
    : [
        !company?.calendar_connected
          ? {
              key: "calendar",
              label: "Agenda",
              title: "Google Calendar pendiente",
              note: "La disponibilidad todavia no es confiable para operar con agenda automatica.",
              href: "/settings/professionals",
              action: "Configurar agenda",
              icon: CalendarCheck2,
              tone: "sand" as const,
            }
          : null,
        connectedInstances.length === 0
          ? {
              key: "whatsapp",
              label: "WhatsApp",
              title: "WhatsApp sin conexion",
              note: "Todavia no hay una instancia conectada para atender mensajes reales.",
              href: "/whatsapp",
              action: "Abrir WhatsApp",
              icon: MessageSquareText,
              tone: "sand" as const,
            }
          : null,
        pausedConversations.length > 0
          ? {
              key: "review",
              label: "Seguimiento",
              title: `${pausedConversations.length} conversacion(es) en revision`,
              note: "Hay conversaciones pausadas esperando intervencion humana.",
              href: "/whatsapp",
              action: "Revisar casos",
              icon: Clock3,
              tone: "sky" as const,
            }
          : null,
      ].filter((item): item is NonNullable<typeof item> => item !== null);

  const botActivity = formatBotActivity(metrics?.last_bot_activity_at);
  const botDotColor = botActivity.tone === "green"
    ? "bg-emerald-500"
    : botActivity.tone === "yellow"
      ? "bg-amber-400"
      : "bg-red-400";
  const whatsappTone = connectedInstances.length > 0 ? "green" : "yellow";
  const calendarTone = company?.calendar_connected ? "green" : "yellow";

  return (
    <PageEntrance className="mx-auto min-h-0 flex-1 overflow-y-auto max-w-[1080px] space-y-6">
      <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[30px]">
        <CardContent className="p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <WorkspaceSectionHeader
              eyebrow="Operacion"
              title="Tu dia en Talora"
              description="Una vista rapida para entender salud, carga y ritmo sin salir del dashboard."
            />

            {!isProfessional && (
              <div className="flex flex-wrap gap-2">
                <StatusPill label={botActivity.label} tone={botActivity.tone} />
                <StatusPill
                  label={connectedInstances.length > 0 ? "WhatsApp conectado" : "WhatsApp pendiente"}
                  tone={whatsappTone}
                />
                <StatusPill
                  label={company?.calendar_connected ? "Agenda conectada" : "Agenda pendiente"}
                  tone={calendarTone}
                />
              </div>
            )}
          </div>

          <AnimatedList className="mt-5 grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
            {dashboardMetrics.map((metric) => (
              <AnimatedItem key={metric.label}>
                <WorkspaceMetricCard
                  label={metric.label}
                  value={metric.value}
                  caption={metric.caption}
                  icon={metric.icon}
                  tone={metric.tone}
                />
              </AnimatedItem>
            ))}
          </AnimatedList>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
        <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[30px]">
          <CardContent className="p-5 sm:p-6 lg:p-7">
            <WorkspaceSectionHeader
              eyebrow="Operacion"
              title="Proximos turnos"
              description="Lo inmediato para que no tengas que entrar a Agenda solo para orientarte."
              action={
                <Link
                  href={appointmentsPath}
                  className="inline-flex items-center gap-2 rounded-full border border-[#dde1ea] bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-[#f6f7fb]"
                >
                  Ver agenda
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </Link>
              }
            />

            {upcomingAppointments.length > 0 ? (
              <div className="mt-6 space-y-3">
                {upcomingAppointments.map((appointment) => {
                  const slot = formatAppointmentDateTime(appointment.starts_at);
                  return (
                    <div
                      key={appointment.id}
                      className="flex flex-col gap-3 rounded-[24px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8f9fc_100%)] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-950">
                            {appointment.client_name || "Cliente sin nombre"}
                          </p>
                          <span className="rounded-full border border-[#dde1ea] bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            {appointment.service_name ?? appointment.title}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {slot.day} · {slot.time}
                          {appointment.professional_name ? ` · ${appointment.professional_name}` : ""}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 rounded-full border border-[#dde1ea] bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        Confirmado
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <WorkspaceEmptyState
                className="mt-6"
                title="No hay turnos proximos"
                description="Cuando entren nuevos turnos confirmados, van a aparecer aca con el contexto minimo para operar rapido."
              />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[30px]">
            <CardContent className="p-5 sm:p-6">
              <WorkspaceSectionHeader
                eyebrow="Atencion"
                title="Casos en revision"
                description="Conversaciones pausadas que hoy necesitan una decision humana."
                action={
                  <Link
                    href="/whatsapp"
                    className="inline-flex items-center gap-2 rounded-full border border-[#dde1ea] bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-[#f6f7fb]"
                  >
                    Abrir WhatsApp
                    <ArrowRight className="h-4 w-4 text-slate-500" />
                  </Link>
                }
              />

              {reviewQueue.length > 0 ? (
                <div className="mt-6 space-y-3">
                  {reviewQueue.map((conversation) => (
                    <div
                      key={conversation.id}
                      className="rounded-[22px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8f9fc_100%)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-950">
                            {conversation.contact_name || conversation.phone_number}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {formatConversationActivity(conversation.last_message_at)}
                          </p>
                        </div>
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                          En pausa
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <WorkspaceEmptyState
                  className="mt-6"
                  title="Todo al dia"
                  description="No hay conversaciones pausadas esperando intervencion humana en este momento."
                />
              )}
            </CardContent>
          </Card>

          {operationalAlerts.length > 0 ? (
            <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[30px]">
              <CardContent className="p-5 sm:p-6">
                <WorkspaceSectionHeader
                  eyebrow="Seguimiento"
                  title="Alertas operativas"
                  description="Cosas que conviene corregir para que la operacion corra sin friccion."
                />

                <div className="mt-5 space-y-3">
                  {operationalAlerts.slice(0, 2).map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      className="interactive-soft flex items-center justify-between gap-3 rounded-[22px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8f9fc_100%)] p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{item.note}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[30px]">
        <CardContent className="p-5 sm:p-6 lg:p-7">
          <WorkspaceSectionHeader
            eyebrow="Crecimiento"
            title="Reactiva y recupera"
            description="Un resumen corto del trabajo comercial para no esconder crecimiento dentro de un link vacio."
            action={
              <Link
                href="/dashboard/crecimiento"
                className="inline-flex items-center gap-2 rounded-full border border-[#dde1ea] bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-[#f6f7fb]"
              >
                Ver crecimiento
                <ArrowRight className="h-4 w-4 text-slate-500" />
              </Link>
            }
          />

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-[24px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8f9fc_100%)] p-5">
              <p className="text-sm text-slate-500">Clientes en riesgo</p>
              <p className="mt-2 tabular-nums text-[2rem] font-semibold leading-none tracking-[-0.05em] text-slate-950">
                {formatMetric(growthStats?.clients_at_risk ?? 0)}
              </p>
              <p className="mt-3 text-sm text-slate-500">Base de clientes que hoy vale la pena trabajar desde CRM.</p>
            </div>

            <div className="rounded-[24px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8f9fc_100%)] p-5">
              <p className="text-sm text-slate-500">Mensajes enviados</p>
              <p className="mt-2 tabular-nums text-[2rem] font-semibold leading-none tracking-[-0.05em] text-slate-950">
                {formatMetric(growthStats?.messages_sent ?? 0)}
              </p>
              <p className="mt-3 text-sm text-slate-500">Contactos procesados en el periodo actual para reactivacion.</p>
            </div>

            <div className="rounded-[24px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8f9fc_100%)] p-5">
              <p className="text-sm text-slate-500">Entrega sin error</p>
              <p className="mt-2 tabular-nums text-[2rem] font-semibold leading-none tracking-[-0.05em] text-slate-950">
                {growthStats ? `${Math.round(growthStats.delivery_rate)}%` : "0%"}
              </p>
              <p className="mt-3 text-sm text-slate-500">Salud operativa del canal antes de mirar conversion o revenue.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageEntrance>
  );
}
