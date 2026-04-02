"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Appointment, Professional } from "@talora/shared";
import { ArrowRight, CalendarPlus } from "lucide-react";
import type { TimeRange } from "@/app/(dashboard)/workspace/_hooks/use-dashboard-filters";

type WorkspaceAppointment = Appointment & {
  professional_name?: string | null;
  service_name?: string | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  confirmed: { bg: "bg-[#dbf0dd]", text: "text-[#2d5e3a]", label: "Confirmado" },
  draft: { bg: "bg-[#f0f1f5]", text: "text-[#4B5563]", label: "Borrador" },
  rescheduled: { bg: "bg-[#fef3c7]", text: "text-[#92400e]", label: "Reprogramado" },
  cancelled: { bg: "bg-[#fce4ec]", text: "text-[#881337]", label: "Cancelado" },
};

export function DashboardAgendaPanel({
  appointments,
  professionals,
  timeRange,
}: {
  appointments: WorkspaceAppointment[];
  professionals: Professional[];
  timeRange: TimeRange;
}) {
  const profMap = useMemo(() => {
    const m = new Map<string | null, Professional>();
    for (const p of professionals) m.set(p.id, p);
    return m;
  }, [professionals]);

  const groupedByProfessional = useMemo(() => {
    if (timeRange !== "today") return [];
    const groups = new Map<string, { professional: Professional | null; appointments: WorkspaceAppointment[] }>();
    for (const a of appointments) {
      const key = a.professional_id ?? "__none__";
      if (!groups.has(key)) {
        groups.set(key, {
          professional: a.professional_id ? profMap.get(a.professional_id) ?? null : null,
          appointments: [],
        });
      }
      groups.get(key)!.appointments.push(a);
    }
    return Array.from(groups.values()).sort((a, b) => {
      const nameA = a.professional?.name ?? "zzz";
      const nameB = b.professional?.name ?? "zzz";
      return nameA.localeCompare(nameB);
    });
  }, [appointments, profMap, timeRange]);

  const periodSummary = useMemo(() => {
    if (timeRange === "today") return null;
    const confirmed = appointments.filter((a) => a.status === "confirmed").length;
    const cancelled = appointments.filter((a) => a.status === "cancelled").length;
    const uniqueProfessionals = new Set(appointments.map((a) => a.professional_id).filter(Boolean)).size;
    const topProfessional = (() => {
      const counts = new Map<string, { name: string; count: number }>();
      for (const a of appointments) {
        if (!a.professional_id || !a.professional_name) continue;
        const existing = counts.get(a.professional_id);
        if (existing) existing.count++;
        else counts.set(a.professional_id, { name: a.professional_name, count: 1 });
      }
      let top: { name: string; count: number } | null = null;
      for (const v of counts.values()) {
        if (!top || v.count > top.count) top = v;
      }
      return top;
    })();
    return { total: appointments.length, confirmed, cancelled, uniqueProfessionals, topProfessional };
  }, [appointments, timeRange]);

  return (
    <div className="rounded-2xl border border-[#dde1ea] bg-white p-5">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-[1.1rem] font-semibold text-[#111318]">
          {timeRange === "today" ? "Agenda del dia" : timeRange === "7d" ? "Ultimos 7 dias" : "Ultimos 30 dias"}
        </h3>
        <Link
          href="/calendar"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B7280] hover:text-[#111318]"
        >
          Ver calendario
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Content by time range */}
      {timeRange === "today" ? (
        appointments.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {groupedByProfessional.map((group) => (
              <div key={group.professional?.id ?? "__none__"}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: group.professional?.color_hex ?? "#9AA1AE" }}
                  />
                  <span className="text-[12px] font-medium text-[#4B5563]">
                    {group.professional?.name ?? "Sin asignar"}
                  </span>
                  <span className="text-[11px] text-[#9AA1AE]">
                    {group.appointments.length}
                  </span>
                </div>
                {group.appointments.map((a) => (
                  <AppointmentRow key={a.id} appointment={a} profMap={profMap} />
                ))}
              </div>
            ))}
          </div>
        )
      ) : periodSummary && periodSummary.total > 0 ? (
        <div className="space-y-2.5">
          <div className="flex items-baseline gap-6">
            <div>
              <span className="text-[11px] font-semibold text-[#4B5563]">Total</span>
              <span className="ml-1.5 text-[15px] font-bold tabular-nums text-[#111318]">{periodSummary.total}</span>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-[#4B5563]">Confirmados</span>
              <span className="ml-1.5 text-[15px] font-bold tabular-nums text-[#2d5e3a]">{periodSummary.confirmed}</span>
            </div>
            {periodSummary.cancelled > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-[#4B5563]">Cancelados</span>
                <span className="ml-1.5 text-[15px] font-bold tabular-nums text-[#9e3553]">{periodSummary.cancelled}</span>
              </div>
            )}
          </div>
          {periodSummary.uniqueProfessionals > 0 && (
            <p className="text-[12px] text-[#6B7280]">
              {periodSummary.uniqueProfessionals} profesional{periodSummary.uniqueProfessionals > 1 ? "es" : ""} con turnos
              {periodSummary.topProfessional && (
                <span className="text-[#4B5563]"> · {periodSummary.topProfessional.name} ({periodSummary.topProfessional.count})</span>
              )}
            </p>
          )}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#F8F9FC] px-5 py-4">
      <div>
        <p className="text-[14px] font-semibold text-[#111318]">
          Sin turnos hoy
        </p>
        <p className="mt-0.5 text-[11px] text-[#6B7280]">
          Tu agenda esta libre
        </p>
      </div>
      <Link
        href="/calendar"
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C1D22] px-3.5 py-2 text-[12px] font-semibold text-white transition-all hover:bg-[#111318]"
      >
        <CalendarPlus className="h-3.5 w-3.5" />
        Crear turno
      </Link>
    </div>
  );
}

function AppointmentRow({
  appointment: a,
  profMap,
}: {
  appointment: WorkspaceAppointment;
  profMap: Map<string | null, Professional>;
}) {
  const badge = statusBadge[a.status] ?? statusBadge.confirmed;

  return (
    <div className="grid grid-cols-[52px_1fr_72px] items-center gap-2 rounded-lg px-2 -mx-2 py-1.5 transition-colors hover:bg-[#F8F9FC]">
      <span className="text-[13px] font-semibold tabular-nums text-[#111318]">
        {formatTime(a.starts_at)}
      </span>
      <div className="min-w-0">
        <span className="truncate text-[13px] font-medium text-[#111318]">
          {a.client_name || "Cliente"}
        </span>
        <span className="mx-1.5 text-[#dde1ea]">·</span>
        <span className="truncate text-[12px] text-[#6B7280]">
          {a.service_name ?? a.title ?? "Turno"}
        </span>
      </div>
      <span className={`justify-self-end rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    </div>
  );
}
