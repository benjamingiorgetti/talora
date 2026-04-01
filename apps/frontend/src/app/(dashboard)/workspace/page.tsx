"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import type { Appointment, Company, Conversation, DashboardMetrics, GrowthStats, Professional, WhatsAppInstance } from "@talora/shared";
import { companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { PageEntrance } from "@/components/ui/page-entrance";
import { useAuth } from "@/lib/auth";
import { WorkspaceErrorState } from "@/components/workspace/error-state";
import { useDashboardFilters } from "./_hooks/use-dashboard-filters";
import { DashboardToolbar } from "@/components/dashboard/toolbar";
import { DashboardKpiStrip } from "@/components/dashboard/kpi-strip";
import { DashboardAgendaPanel } from "@/components/dashboard/agenda-panel";
import { DashboardReviewPanel } from "@/components/dashboard/side-panel";
import { DashboardAtRiskTable } from "@/components/dashboard/at-risk-table";

type WorkspaceAppointment = Appointment & {
  professional_name?: string | null;
  service_name?: string | null;
};

function formatBotActivity(isoDate: string | null | undefined): { label: string; tone: "green" | "yellow" | "red" } {
  if (!isoDate) return { label: "Sin actividad", tone: "red" };
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return { label: "Bot activo", tone: "green" };
  if (diffMin < 60) return { label: `Bot ${diffMin}m`, tone: diffMin < 30 ? "green" : "yellow" };
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return { label: `Bot ${diffH}h`, tone: diffH < 2 ? "yellow" : "red" };
  return { label: `Bot ${Math.floor(diffH / 24)}d`, tone: "red" };
}

function getCurrentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function isSameDay(value: string, target: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  );
}

export default function WorkspaceDashboardPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeCompanyId, session } = useAuth();
  const isProfessional = session?.role === "professional";
  const professionalId = session?.professionalId ?? null;

  const { timeRange, setTimeRange, professionalId: filterProfId, setProfessionalId: setFilterProfId, filterAppointments } = useDashboardFilters();

  const appointmentsPath = isProfessional && professionalId
    ? `/appointments?professional_id=${professionalId}`
    : "/appointments";
  const conversationsPath = isProfessional && professionalId
    ? `/conversations?page=1&limit=8&state=active&professional_id=${professionalId}`
    : "/conversations?page=1&limit=8";
  const growthRange = useMemo(() => getCurrentMonthRange(), []);

  // ── Data fetching ──
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
  const { data: professionals } = useSWR(
    companyScopedKey("/professionals", activeCompanyId),
    companyScopedFetcher<Professional[]>
  );

  const today = useMemo(() => new Date(), []);

  // ── Derived data ──
  const filteredAppointments = useMemo(
    () => filterAppointments(appointments ?? []),
    [appointments, filterAppointments]
  );

  const todayAppointments = useMemo(
    () => (appointments ?? []).filter((a) => a.status !== "cancelled" && isSameDay(a.starts_at, today)),
    [appointments, today]
  );

  const pausedConversations = useMemo(
    () => (conversations ?? []).filter((c) => c.bot_paused),
    [conversations]
  );

  const reviewQueue = useMemo(
    () =>
      [...pausedConversations]
        .sort((a, b) =>
          new Date(b.last_message_at ?? b.created_at).getTime() -
          new Date(a.last_message_at ?? a.created_at).getTime()
        )
        .slice(0, 5),
    [pausedConversations]
  );

  const connectedInstances = useMemo(
    () => (instances ?? []).filter((i) => i.status === "connected"),
    [instances]
  );

  const botActivity = formatBotActivity(metrics?.last_bot_activity_at);

  // ── Side effects ──
  useEffect(() => {
    if (pathname === "/workspace") {
      router.replace("/dashboard");
    }
  }, [pathname, router]);

  // ── Loading / error ──
  if (metricsError || appointmentsError) {
    return (
      <WorkspaceErrorState
        className="min-h-[50vh]"
        onRetry={() => { void mutateMetrics(); void mutateAppointments(); }}
      />
    );
  }

  if (!metrics && !appointments) {
    return <LoadingSpinner className="min-h-[70vh]" />;
  }

  return (
    <PageEntrance className="mx-auto min-h-0 flex-1 overflow-y-auto max-w-[1120px] px-1">
      {/* ── Toolbar ── */}
      <DashboardToolbar
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        professionals={professionals ?? []}
        professionalId={filterProfId}
        onProfessionalChange={setFilterProfId}
        botActivity={botActivity}
        whatsappConnected={connectedInstances.length > 0}
        calendarConnected={company?.calendar_connected ?? false}
        isProfessional={isProfessional}
      />

      {/* ── KPI Strip ── */}
      <DashboardKpiStrip
        todayCount={todayAppointments.length}
        automationRate={metrics?.automation_rate ?? 0}
        pausedCount={pausedConversations.length}
        atRiskCount={growthStats?.clients_at_risk ?? 0}
        isProfessional={isProfessional}
      />

      {/* ── Main content: agenda + side panel ── */}
      <div className="grid gap-5 xl:grid-cols-[1.8fr_1fr] mt-3">
        <DashboardAgendaPanel
          appointments={filteredAppointments}
          professionals={professionals ?? []}
          timeRange={timeRange}
        />
        <DashboardReviewPanel
          reviewQueue={reviewQueue}
        />
      </div>

      {/* ── Dense table ── */}
      <DashboardAtRiskTable />
    </PageEntrance>
  );
}
