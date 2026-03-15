"use client";

import type { Appointment } from "@talora/shared";
import { getDurationLabel, hexToRgba } from "./utils";

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
  const time = new Date(appointment.starts_at).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const duration = getDurationLabel(appointment.starts_at, appointment.ends_at);
  const status = appointment.status ?? "confirmed";

  return (
    <div className="grid grid-cols-[72px_1fr_80px_110px] items-center gap-3 border-b border-[#eceef3] px-5 py-3.5 last:border-b-0">
      <span className="text-sm font-semibold tabular-nums text-slate-950">
        {time}
      </span>

      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">
          {appointment.service_name ?? appointment.title ?? "Turno"}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {appointment.client_name}
        </p>
      </div>

      <span className="text-xs text-slate-500">{duration}</span>

      <span
        className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone[status] ?? statusTone.draft}`}
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
  const time = new Date(appointment.starts_at).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const duration = getDurationLabel(appointment.starts_at, appointment.ends_at);
  const status = appointment.status ?? "confirmed";

  return (
    <article
      className="rounded-[22px] border px-4 py-3.5"
      style={{
        borderColor: hexToRgba(accent, 0.16),
        background: `linear-gradient(180deg, ${hexToRgba(accent, 0.1)}, rgba(255,255,255,0.96))`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950">
            {appointment.service_name ?? appointment.title ?? "Turno"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {appointment.client_name}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {time}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {showProfessional && professionalName && (
          <span className="rounded-full bg-white/80 px-2.5 py-1">
            {professionalName}
          </span>
        )}
        <span className="rounded-full bg-white/80 px-2.5 py-1">{duration}</span>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone[status] ?? statusTone.draft}`}
        >
          {statusLabel[status] ?? status}
        </span>
      </div>
    </article>
  );
}
