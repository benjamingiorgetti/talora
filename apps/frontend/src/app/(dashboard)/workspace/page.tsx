"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import type { Appointment, Company, Conversation, DashboardMetrics, WhatsAppInstance } from "@talora/shared";
import { ArrowRight, CalendarCheck2, CalendarDays, ChartColumnIncreasing, Clock3, MessageSquareText, Timer } from "lucide-react";
import { companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageEntrance } from "@/components/ui/page-entrance";
import { AnimatedList, AnimatedItem } from "@/components/ui/animated-list";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { WorkspaceMetricCard, WorkspaceSectionHeader } from "@/components/workspace/chrome";
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
      tone: "sky" as const,
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

  return (
    <PageEntrance className="mx-auto min-h-0 flex-1 overflow-y-auto max-w-[1080px] space-y-6">
      {!isProfessional && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className={cn("h-2 w-2 rounded-full", botDotColor)} />
          <span>{botActivity.label}</span>
        </div>
      )}

      <AnimatedList className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      {operationalAlerts.length > 0 ? (
        <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[30px]">
          <CardContent className="p-5 sm:p-6 lg:p-7">
            <WorkspaceSectionHeader eyebrow="Atencion" title="Alertas operativas" />

            <div className="mt-5 space-y-3">
              {operationalAlerts.map((item) => {
                const Icon = item.icon;
                const accentClass =
                  item.tone === "sky"
                    ? "bg-[hsl(var(--surface-sky))]"
                    : item.tone === "mint"
                      ? "bg-[hsl(var(--surface-mint))]"
                      : "bg-[hsl(var(--surface-sand))]";

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="interactive-soft flex flex-col gap-4 rounded-[24px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8f9fc_100%)] p-4 sm:flex-row sm:items-start sm:justify-between sm:rounded-[28px]"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={cn("mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] text-slate-900", accentClass)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-500">{item.label}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-950">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{item.note}</p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 rounded-full border border-[#dde1ea] bg-white px-3 py-2 text-sm font-medium text-slate-700">
                      <span>{item.action}</span>
                      <ArrowRight className="h-4 w-4 text-slate-500" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Link
        href="/dashboard/crecimiento"
        className="interactive-soft flex items-center justify-between rounded-[28px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8f9fc_100%)] p-5 sm:p-6"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Crecimiento</p>
          <p className="mt-1 text-lg font-semibold text-slate-950">Actividad de reactivacion</p>
          <p className="mt-1 text-sm text-slate-500">Mensajes enviados, entregabilidad y estado operativo.</p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" />
      </Link>
    </PageEntrance>
  );
}
