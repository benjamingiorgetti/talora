"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import type { GrowthStats, ReactivationMessage } from "@talora/shared";
import {
  ArrowRight,
  CheckCircle2,
  DollarSign,
  MessageCircle,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageEntrance } from "@/components/ui/page-entrance";
import { AnimatedList, AnimatedItem } from "@/components/ui/animated-list";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { WorkspaceMetricCard, WorkspaceSectionHeader } from "@/components/workspace/chrome";
import { WorkspaceErrorState } from "@/components/workspace/error-state";

type PeriodKey = "month" | "30d" | "90d";

function getDateRange(periodKey: PeriodKey): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (periodKey === "month") {
    from.setDate(1);
  } else if (periodKey === "30d") {
    from.setDate(from.getDate() - 30);
  } else {
    from.setDate(from.getDate() - 90);
  }
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRelativeDays(days: number): string {
  if (days === 0) return "hoy";
  if (days === 1) return "hace 1 dia";
  return `hace ${days} dias`;
}

function MessageStatusBadge({ status }: { status: ReactivationMessage["status"] }) {
  const map: Record<ReactivationMessage["status"], { label: string; className: string }> = {
    sent: { label: "Enviado", className: "bg-[hsl(var(--surface-sky))] text-[#305363]" },
    converted: { label: "Convertido", className: "bg-[hsl(var(--surface-mint))] text-[#517261]" },
    failed: { label: "Fallido", className: "bg-[hsl(var(--surface-rose))] text-[#7c5b66]" },
    pending: { label: "Pendiente", className: "border border-[#dde1ea] bg-white text-slate-500" },
  };
  const { label, className } = map[status];
  return (
    <span className={cn("inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", className)}>
      {label}
    </span>
  );
}

export default function CrecimientoPage() {
  const { activeCompanyId } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>("month");

  const { from, to } = getDateRange(period);

  const {
    data: stats,
    error: statsError,
    mutate: mutateStats,
  } = useSWR(
    companyScopedKey(`/growth/stats?from=${from}&to=${to}`, activeCompanyId),
    companyScopedFetcher<GrowthStats>
  );

  const {
    data: messages,
    error: messagesError,
    mutate: mutateMessages,
  } = useSWR(
    companyScopedKey("/growth/reactivation", activeCompanyId),
    companyScopedFetcher<ReactivationMessage[]>
  );

  const hasError = statsError || messagesError;
  if (hasError && !stats && !messages) {
    return (
      <WorkspaceErrorState
        className="min-h-[50vh]"
        onRetry={() => {
          void mutateStats();
          void mutateMessages();
        }}
      />
    );
  }

  const chartData = [
    { month: "Oct", sent: 3, converted: 1 },
    { month: "Nov", sent: 8, converted: 3 },
    { month: "Dic", sent: 12, converted: 5 },
    { month: "Ene", sent: 15, converted: 7 },
    { month: "Feb", sent: 22, converted: 10 },
    { month: "Mar", sent: stats?.messages_sent ?? 0, converted: stats?.clients_reactivated ?? 0 },
  ];

  const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: "month", label: "Este mes" },
    { key: "30d", label: "30 dias" },
    { key: "90d", label: "90 dias" },
  ];

  const statCards = [
    {
      label: "Clientes recuperados",
      value: stats?.clients_reactivated ?? 0,
      icon: Users,
      tone: "mint" as const,
      caption: "Clientes que volvieron a sacar turno.",
    },
    {
      label: "Revenue atribuido",
      value: stats ? formatCurrency(stats.revenue_attributed) : "$0",
      icon: DollarSign,
      tone: "sky" as const,
      caption: "Revenue generado por reactivaciones.",
    },
    {
      label: "Tasa de conversion",
      value: stats ? `${Math.round(stats.conversion_rate)}%` : "0%",
      icon: TrendingUp,
      tone: "lilac" as const,
      caption: "Mensajes que generaron un turno.",
    },
    {
      label: "Mensajes enviados",
      value: stats?.messages_sent ?? 0,
      icon: MessageCircle,
      tone: "sand" as const,
      caption: "Total de mensajes de reactivacion.",
    },
  ];

  return (
    <PageEntrance className="mx-auto min-h-0 flex-1 overflow-y-auto max-w-[1080px] space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-700">
          Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-950">Crecimiento</span>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <Button
              key={p.key}
              variant="outline"
              onClick={() => setPeriod(p.key)}
              className={cn(
                "h-10 rounded-2xl border px-4 text-sm",
                period === p.key
                  ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                  : "border-[#dde1ea] bg-white text-slate-600 hover:bg-[#f6f7fb]"
              )}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <Button asChild variant="outline" className="h-10 rounded-2xl border-[#dde1ea] px-4 hover:bg-[#f6f7fb]">
          <Link href="/workspace/growth">
            Ir al CRM
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Stats cards */}
      <AnimatedList className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <AnimatedItem key={card.label}>
            <WorkspaceMetricCard
              label={card.label}
              value={card.value}
              caption={card.caption}
              icon={card.icon}
              tone={card.tone}
            />
          </AnimatedItem>
        ))}
      </AnimatedList>

      {/* Activity chart */}
      <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[30px]">
        <CardContent className="p-5 sm:p-6 lg:p-7">
          <WorkspaceSectionHeader
            eyebrow="Tendencia"
            title="Actividad mensual"
            description="Mensajes de reactivacion enviados y convertidos por mes."
          />

          <div className="mt-6">
            <div className="flex items-end gap-4 h-[140px] px-2">
              {chartData.map((d) => {
                const maxVal = Math.max(...chartData.map((x) => x.sent), 1);
                const sentHeight = (d.sent / maxVal) * 120;
                const convertedHeight = (d.converted / maxVal) * 120;
                return (
                  <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex items-end gap-1 w-full justify-center" style={{ height: 120 }}>
                      <div
                        className="w-3 rounded-t-sm bg-slate-200"
                        style={{ height: sentHeight }}
                      />
                      <div
                        className="w-3 rounded-t-sm bg-slate-900"
                        style={{ height: convertedHeight }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">{d.month}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-200 border border-slate-300" />
                <span className="text-xs text-slate-500">Enviados</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-900" />
                <span className="text-xs text-slate-500">Convertidos</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent messages */}
      <Card className="rounded-[28px] border-[#e6e7ec] bg-white shadow-none sm:rounded-[30px]">
        <CardContent className="p-5 sm:p-6 lg:p-7">
          <WorkspaceSectionHeader
            eyebrow="Historial"
            title="Mensajes recientes"
            description="Ultimos mensajes de reactivacion y su resultado."
          />

          <div className="mt-6 space-y-3">
            {!messages || messages.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#d9dce6] bg-[linear-gradient(180deg,#fbfbfd_0%,#f5f6fa_100%)] px-5 py-8 text-center">
                <p className="text-sm text-slate-500">
                  Cuando envies mensajes de reactivacion desde el CRM, van a aparecer aca.
                </p>
              </div>
            ) : (
              messages.slice(0, 10).map((msg) => (
                <div
                  key={msg.id}
                  className="flex items-center justify-between rounded-[24px] border border-[#e6e7ec] bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px]",
                        msg.status === "converted"
                          ? "bg-[hsl(var(--surface-mint))] text-[#517261]"
                          : msg.status === "failed"
                            ? "bg-[hsl(var(--surface-rose))] text-[#7c5b66]"
                            : "bg-[hsl(var(--surface-sky))] text-[#305363]"
                      )}
                    >
                      {msg.status === "converted" ? (
                        <CheckCircle2 className="h-4.5 w-4.5" />
                      ) : msg.status === "failed" ? (
                        <XCircle className="h-4.5 w-4.5" />
                      ) : (
                        <MessageCircle className="h-4.5 w-4.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">{msg.client_name ?? "Cliente"}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500 max-w-[240px]">{msg.message_text}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <MessageStatusBadge status={msg.status} />
                    <p className="text-xs text-slate-400">
                      {msg.sent_at
                        ? formatRelativeDays(Math.floor((Date.now() - new Date(msg.sent_at).getTime()) / 86_400_000))
                        : "—"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </PageEntrance>
  );
}
