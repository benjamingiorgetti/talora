"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import type { Appointment, Conversation, DashboardMetrics, GrowthStats, Professional } from "@talora/shared";
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
import { DashboardRetentionSummary, DashboardAtRiskTable } from "@/components/dashboard/at-risk-table";

type WorkspaceAppointment = Appointment & {
  professional_name?: string | null;
  service_name?: string | null;
};

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
  const { data: appointments, error: appointmentsError, mutate: mutateAppointments } = useSWR(
    companyScopedKey(appointmentsPath, activeCompanyId),
    companyScopedFetcher<WorkspaceAppointment[]>
  );
  const { data: conversations } = useSWR(
    companyScopedKey(conversationsPath, activeCompanyId),
    companyScopedFetcher<Conversation[]>
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
    <PageEntrance className="mx-auto min-h-0 flex-1 overflow-y-auto max-w-[1120px]">
      {/* ── Level 1: Toolbar ── */}
      <DashboardToolbar
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        professionals={professionals ?? []}
        professionalId={filterProfId}
        onProfessionalChange={setFilterProfId}
        isProfessional={isProfessional}
      />

      {/* ── Level 2: KPI Overview ── */}
      <div className="mt-1">
        <DashboardKpiStrip
          todayCount={todayAppointments.length}
          automationRate={metrics?.automation_rate ?? 0}
          pausedCount={pausedConversations.length}
          atRiskCount={growthStats?.clients_at_risk ?? 0}
          isProfessional={isProfessional}
        />
      </div>

      {/* ── Level 3: Operational Zone ── */}
      <section className="mt-8">
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <DashboardAgendaPanel
            appointments={filteredAppointments}
            professionals={professionals ?? []}
            timeRange={timeRange}
          />
          <DashboardReviewPanel
            reviewQueue={reviewQueue}
          />
        </div>
      </section>

      {/* ── Level 4: Retention Summary ── */}
      <section className="mt-8">
        <DashboardRetentionSummary />
      </section>

      {/* ── Level 5: Detail Table (below fold) ── */}
      <section className="mt-6 mb-6">
        <DashboardAtRiskTable />
      </section>
    </PageEntrance>
  );
}
