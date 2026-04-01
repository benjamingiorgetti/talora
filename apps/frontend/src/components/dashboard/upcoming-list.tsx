"use client";

import Link from "next/link";
import type { Appointment } from "@talora/shared";
import { ArrowRight } from "lucide-react";

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

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function DashboardUpcomingList({
  appointments,
  appointmentsHref,
}: {
  appointments: WorkspaceAppointment[];
  appointmentsHref: string;
}) {
  return (
    <div className="rounded-2xl border border-[#dde1ea] bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#f0f1f5]">
        <h3 className="text-sm font-semibold text-slate-900">
          Proximos turnos
        </h3>
        <Link
          href={appointmentsHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-700"
        >
          Ver agenda
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Rows */}
      {appointments.length > 0 ? (
        <div>
          {appointments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 border-b border-[#f0f1f5] px-4 py-2.5 last:border-b-0"
            >
              <div className="w-[72px] shrink-0">
                <p className="text-xs font-medium tabular-nums text-slate-500">
                  {formatDay(a.starts_at)}
                </p>
                <p className="text-sm font-semibold tabular-nums text-slate-900">
                  {formatTime(a.starts_at)}
                </p>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {a.client_name || "Cliente sin nombre"}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {a.service_name ?? a.title ?? "Turno"}
                </p>
              </div>

              <span className="hidden truncate text-xs text-slate-400 lg:block lg:max-w-[100px]">
                {a.professional_name ?? ""}
              </span>

              <span className="shrink-0 rounded-full bg-[#dbf0dd] px-2 py-0.5 text-[10px] font-medium text-[#2d5e3a]">
                Confirmado
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-2.5">
          <p className="text-xs text-slate-500">Sin turnos proximos</p>
          <div className="flex items-center gap-2">
            <Link
              href={appointmentsHref}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Ver agenda
            </Link>
            <Link
              href="/calendar"
              className="rounded-lg border border-[#dde1ea] bg-[#f7f8fb] px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-[#eef0f4]"
            >
              Crear turno
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
