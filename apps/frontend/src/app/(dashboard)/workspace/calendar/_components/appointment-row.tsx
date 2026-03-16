"use client";

import type { Appointment } from "@talora/shared";
import {
  formatTimeRange,
  getDurationLabel,
  getAppointmentTimeState,
  hexToRgba,
} from "./utils";

type AppointmentItem = Appointment & {
  professional_name?: string | null;
  service_name?: string | null;
};

const statusLabel: Record<string, string> = {
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  rescheduled: "Reprogramado",
  draft: "Borrador",
};

const statusTone: Record<string, string> = {
  confirmed: "bg-[#dbf0dd] text-[#2d5e3a]",
  cancelled: "bg-[#f5dbe4] text-[#714a58]",
  rescheduled: "bg-[#f3dfc1] text-[#6c5338]",
  draft: "bg-[#e6e7ec] text-slate-600",
};

export function AppointmentRowDesktop({
  appointment,
  accent,
}: {
  appointment: AppointmentItem;
  accent: string;
}) {
  const timeRange = formatTimeRange(appointment.starts_at, appointment.ends_at);
  const status = appointment.status ?? "confirmed";
  const timeState = getAppointmentTimeState(
    appointment.starts_at,
    appointment.ends_at
  );
  const isPast = timeState === "past";
  const isNow = timeState === "now";

  return (
    <div
      className={`flex items-center gap-3 border-b border-[#eceef3] px-5 py-3.5 last:border-b-0 transition-opacity ${
        isPast ? "opacity-45" : ""
      }`}
      style={
        isNow
          ? { backgroundColor: hexToRgba(accent, 0.05) }
          : undefined
      }
    >
      <div
        className={`w-[3px] self-stretch shrink-0 rounded-full ${
          isNow ? "animate-status-pulse" : ""
        }`}
        style={{ backgroundColor: isPast ? "#cbd5e1" : accent }}
      />

      <span
        className={`w-[110px] shrink-0 text-sm font-semibold tabular-nums ${
          isPast ? "text-slate-400" : "text-slate-950"
        }`}
      >
        {timeRange}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${
            isPast ? "text-slate-400" : "text-slate-900"
          }`}
        >
          {appointment.client_name}
        </p>
        <p
          className={`mt-0.5 truncate text-xs ${
            isPast ? "text-slate-300" : "text-slate-500"
          }`}
        >
          {appointment.service_name ?? appointment.title ?? "Turno"}
        </p>
      </div>

      {isNow && (
        <span className="inline-flex shrink-0 items-center rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-white animate-status-pulse">
          Ahora
        </span>
      )}

      <span
        className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
          isPast
            ? "bg-[#e6e7ec] text-slate-400"
            : (statusTone[status] ?? statusTone.draft)
        }`}
      >
        {statusLabel[status] ?? status}
      </span>
    </div>
  );
}

export function AppointmentCardMobile({
  appointment,
  accent,
  showProfessional,
  professionalName,
}: {
  appointment: AppointmentItem;
  accent: string;
  showProfessional?: boolean;
  professionalName?: string;
}) {
  const timeRange = formatTimeRange(appointment.starts_at, appointment.ends_at);
  const duration = getDurationLabel(appointment.starts_at, appointment.ends_at);
  const status = appointment.status ?? "confirmed";
  const timeState = getAppointmentTimeState(
    appointment.starts_at,
    appointment.ends_at
  );
  const isPast = timeState === "past";
  const isNow = timeState === "now";

  return (
    <article
      className={`rounded-[22px] border px-4 py-3.5 transition-opacity ${
        isPast ? "opacity-45" : ""
      }`}
      style={{
        borderColor: isPast
          ? "#e2e4ea"
          : isNow
            ? hexToRgba(accent, 0.4)
            : hexToRgba(accent, 0.16),
        background: isPast
          ? "#f8f9fb"
          : `linear-gradient(180deg, ${hexToRgba(accent, 0.1)}, rgba(255,255,255,0.96))`,
        ...(isNow
          ? { boxShadow: `0 0 12px ${hexToRgba(accent, 0.15)}` }
          : {}),
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-semibold ${
              isPast ? "text-slate-400" : "text-slate-950"
            }`}
          >
            {appointment.client_name}
          </p>
          <p
            className={`mt-1 text-sm ${
              isPast ? "text-slate-300" : "text-slate-600"
            }`}
          >
            {appointment.service_name ?? appointment.title ?? "Turno"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isNow && (
            <span className="rounded-full bg-slate-950 px-2 py-1 text-[11px] font-semibold text-white animate-status-pulse">
              Ahora
            </span>
          )}
          <span
            className={`rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold ${
              isPast ? "text-slate-400" : "text-slate-700"
            }`}
          >
            {timeRange}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {showProfessional && professionalName && (
          <span className="rounded-full bg-white/80 px-2.5 py-1">
            {professionalName}
          </span>
        )}
        <span className="rounded-full bg-white/80 px-2.5 py-1">{duration}</span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
            isPast
              ? "bg-[#e6e7ec] text-slate-400"
              : (statusTone[status] ?? statusTone.draft)
          }`}
        >
          {statusLabel[status] ?? status}
        </span>
      </div>
    </article>
  );
}
