"use client";

import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import type { Client, ClientDetailAnalytics } from "@talora/shared";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Hash,
  Mail,
  MessageCircle,
  Phone,
  Repeat,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { companyScopedFetcher, companyScopedKey } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { PageEntrance } from "@/components/ui/page-entrance";
import { useAuth } from "@/lib/auth";
import { WorkspaceErrorState } from "@/components/workspace/error-state";

interface ClientDetail extends Client {
  appointments: Array<{
    id: string;
    starts_at: string;
    ends_at: string | null;
    status: string;
    service_name: string | null;
    professional_name: string | null;
  }>;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit" });

  if (isToday) return `Hoy ${time}`;
  if (isTomorrow) return `Mañana ${time}`;
  return d.toLocaleString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `Hace ${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
  }
  const months = Math.floor(diffDays / 30);
  return `Hace ${months} ${months === 1 ? "mes" : "meses"}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const statusLabels: Record<string, { label: string; className: string }> = {
  confirmed: { label: "Confirmado", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Cancelado", className: "bg-red-50 text-red-600 border-red-200" },
  completed: { label: "Completado", className: "bg-slate-100 text-slate-600 border-slate-200" },
  pending: { label: "Pendiente", className: "bg-amber-50 text-amber-700 border-amber-200" },
};

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  color?: string;
}

function KpiCard({ icon, label, value, subtitle, color = "text-slate-700" }: KpiCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#e6e7ec] bg-white px-4 py-3.5">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--surface-lilac))]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">{label}</p>
        <p className={`text-lg font-semibold leading-tight ${color}`}>{value}</p>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-[84px] animate-pulse rounded-2xl border border-[#e6e7ec] bg-white" />
      ))}
    </div>
  );
}

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { activeCompanyId } = useAuth();
  const clientId = params.id as string;

  const { data: client, error, mutate } = useSWR(
    companyScopedKey(`/clients/${clientId}`, activeCompanyId),
    companyScopedFetcher<ClientDetail>
  );

  const { data: analytics } = useSWR(
    companyScopedKey(`/clients/${clientId}/analytics`, activeCompanyId),
    companyScopedFetcher<ClientDetailAnalytics>
  );

  if (error) {
    return <WorkspaceErrorState className="min-h-[50vh]" onRetry={() => { void mutate(); }} />;
  }

  if (!client) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
      </div>
    );
  }

  const upcomingAppointments = client.appointments.filter(
    (a) => a.status === "confirmed" && new Date(a.starts_at).getTime() >= Date.now()
  );
  const pastAppointments = client.appointments.filter(
    (a) => a.status !== "confirmed" || new Date(a.starts_at).getTime() < Date.now()
  );

  return (
    <PageEntrance className="min-h-0 flex-1 overflow-y-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push("/workspace/clients")}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Clientes
      </button>

      {/* Client header */}
      <div className="rounded-[28px] border border-[#e6e7ec] bg-white p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[hsl(var(--surface-lilac))]">
            <UserRound className="h-6 w-6 text-slate-700" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-950 truncate">
                {client.name || "Cliente sin nombre"}
              </h1>
              {client.is_active && (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">Activo</Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {client.phone_number}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                WhatsApp
              </span>
            </div>
            {client.booked_services && client.booked_services.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {client.booked_services.map((s) => (
                  <Badge key={s.id} variant="secondary" className="border-0 bg-[hsl(var(--surface-lilac))] text-slate-700 text-xs font-medium">
                    {s.name}
                  </Badge>
                ))}
              </div>
            )}
            {client.notes && (
              <p className="mt-3 text-sm text-slate-500">{client.notes}</p>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {!analytics ? (
        <KpiCardsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard
            icon={<Clock className="h-4 w-4 text-slate-500" />}
            label="Ultimo Turno"
            value={analytics.last_appointment_at ? formatRelativeTime(analytics.last_appointment_at) : "\u2014"}
            color={analytics.last_appointment_at ? "text-slate-900" : "text-slate-400"}
          />
          <KpiCard
            icon={<DollarSign className="h-4 w-4 text-slate-500" />}
            label="Ticket Promedio"
            value={analytics.avg_ticket > 0 ? formatCurrency(analytics.avg_ticket) : "\u2014"}
            color={analytics.avg_ticket > 0 ? "text-emerald-600" : "text-slate-400"}
          />
          <KpiCard
            icon={<Repeat className="h-4 w-4 text-slate-500" />}
            label="Frecuencia"
            value={analytics.avg_frequency_days !== null ? `${analytics.avg_frequency_days} días` : "\u2014"}
            subtitle="promedio entre turnos"
          />
          <KpiCard
            icon={<Hash className="h-4 w-4 text-slate-500" />}
            label="Total Turnos"
            value={String(analytics.total_appointments)}
            color={analytics.total_appointments > 0 ? "text-slate-900" : "text-slate-400"}
          />
          <KpiCard
            icon={<DollarSign className="h-4 w-4 text-slate-500" />}
            label="Revenue Total"
            value={analytics.total_revenue > 0 ? formatCurrency(analytics.total_revenue) : "\u2014"}
            color={analytics.total_revenue > 0 ? "text-emerald-600" : "text-slate-400"}
          />
          <KpiCard
            icon={<Mail className="h-4 w-4 text-slate-500" />}
            label="Mensajes Enviados"
            value={String(analytics.messages_sent)}
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4 text-slate-500" />}
            label="Tasa de Respuesta"
            value={`${analytics.response_rate}%`}
            subtitle={analytics.messages_sent > 0 ? `${analytics.messages_sent} enviados` : "0 enviados"}
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4 text-slate-500" />}
            label="Tasa de Conversion"
            value={`${analytics.conversion_rate}%`}
            color={analytics.conversion_rate > 0 ? "text-emerald-600" : "text-slate-400"}
          />
        </div>
      )}

      {/* Preferred day badge */}
      {analytics?.preferred_day && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">Dia preferido:</span>
          <Badge variant="secondary" className="border-0 bg-[hsl(var(--surface-lilac))] text-slate-700 text-xs font-medium">
            {analytics.preferred_day}
          </Badge>
        </div>
      )}

      {/* Upcoming appointments */}
      {upcomingAppointments.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
            Proximos turnos
          </h2>
          <div className="space-y-2">
            {upcomingAppointments.map((apt) => (
              <div key={apt.id} className="flex items-center gap-4 rounded-2xl border border-[#e6e7ec] bg-white px-5 py-3">
                <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-950">{formatDate(apt.starts_at)}</p>
                  <p className="text-xs text-slate-500">
                    {[apt.service_name, apt.professional_name].filter(Boolean).join(" \u2014 ") || "Sin servicio asignado"}
                  </p>
                </div>
                {(() => {
                  const s = statusLabels[apt.status] ?? { label: apt.status, className: "bg-slate-100 text-slate-600" };
                  return <Badge variant="outline" className={`text-xs ${s.className}`}>{s.label}</Badge>;
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past appointments */}
      {pastAppointments.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
            Historial
          </h2>
          <div className="rounded-[28px] border border-[#e6e7ec] bg-white overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#f0f1f5]">
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">Fecha</th>
                  <th className="hidden sm:table-cell px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">Servicio</th>
                  <th className="hidden sm:table-cell px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">Profesional</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-[0.16em] text-slate-400 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {pastAppointments.map((apt) => {
                  const s = statusLabels[apt.status] ?? { label: apt.status, className: "bg-slate-100 text-slate-600" };
                  return (
                    <tr key={apt.id} className="border-b border-[#f0f1f5] last:border-0">
                      <td className="px-5 py-3 text-sm text-slate-700">{formatDate(apt.starts_at)}</td>
                      <td className="hidden sm:table-cell px-5 py-3 text-sm text-slate-500">{apt.service_name ?? "--"}</td>
                      <td className="hidden sm:table-cell px-5 py-3 text-sm text-slate-500">{apt.professional_name ?? "--"}</td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className={`text-xs ${s.className}`}>{s.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No appointments at all */}
      {client.appointments.length === 0 && (
        <div className="rounded-[28px] border border-[#e6e7ec] bg-white px-6 py-10 text-center">
          <Calendar className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Este cliente no tiene turnos registrados.</p>
        </div>
      )}
    </PageEntrance>
  );
}
