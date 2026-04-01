"use client";

import {
  formatTimeRange,
  getAppointmentTimeState,
  hexToRgba,
} from "./utils";
import {
  statusLabel,
  type AppointmentItem,
} from "./calendar-shared-types";

export function AppointmentBlock({
  appointment,
  top,
  height,
  column,
  totalColumns,
  accent,
  onClick,
}: {
  appointment: AppointmentItem;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
  accent: string;
  onClick: (appointment: AppointmentItem) => void;
}) {
  const timeState = getAppointmentTimeState(
    appointment.starts_at,
    appointment.ends_at
  );
  const isPast = timeState === "past";
  const isNow = timeState === "now";
  const isCancelled = appointment.status === "cancelled";
  const timeRange = formatTimeRange(appointment.starts_at, appointment.ends_at);
  const serviceName =
    appointment.service_name ?? appointment.title ?? "Turno";
  const isCompact = height < 32;
  const isMedium = height >= 32 && height < 52;

  return (
    <button
      type="button"
      onClick={() => onClick(appointment)}
      className={`absolute overflow-hidden rounded-xl text-left transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300 ${
        isPast ? "opacity-50" : ""
      }`}
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 20)}px`,
        left: `calc(${(column / totalColumns) * 100}% + 2px)`,
        width: `calc(${(1 / totalColumns) * 100}% - 4px)`,
        borderLeft: `3px ${isCancelled ? "dashed" : "solid"} ${isPast ? "#cbd5e1" : accent}`,
        backgroundColor: isCancelled
          ? "#f8f9fb"
          : isNow
            ? hexToRgba(accent, 0.12)
            : isPast
              ? hexToRgba(accent, 0.04)
              : hexToRgba(accent, 0.08),
        borderTop: `1px solid ${hexToRgba(accent, isCancelled ? 0.08 : 0.15)}`,
        borderRight: `1px solid ${hexToRgba(accent, isCancelled ? 0.08 : 0.15)}`,
        borderBottom: `1px solid ${hexToRgba(accent, isCancelled ? 0.08 : 0.15)}`,
      }}
    >
      {isNow && (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-[3px] animate-status-pulse"
          style={{ backgroundColor: accent }}
        />
      )}

      <div className="px-2 py-1">
        {isCompact ? (
          /* Single line for short blocks */
          <p
            className={`truncate text-[11px] font-medium leading-tight ${
              isCancelled
                ? "text-slate-400 line-through"
                : isPast
                  ? "text-slate-500"
                  : "text-slate-800"
            }`}
          >
            <span className="tabular-nums text-slate-500">{timeRange}</span>
            <span className="mx-1 text-slate-300">·</span>
            {appointment.client_name}
          </p>
        ) : isMedium ? (
          /* Two lines for medium blocks */
          <>
            <p
              className={`truncate text-[11px] leading-tight ${
                isPast ? "text-slate-400" : "text-slate-500"
              }`}
            >
              <span className="tabular-nums">{timeRange}</span>
              <span className="mx-1">·</span>
              <span
                className={`font-medium ${
                  isCancelled
                    ? "text-slate-400 line-through"
                    : isPast
                      ? "text-slate-500"
                      : "text-slate-800"
                }`}
              >
                {appointment.client_name}
              </span>
            </p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">
              {serviceName}
            </p>
          </>
        ) : (
          /* Full layout for tall blocks */
          <>
            <p
              className={`text-[11px] tabular-nums leading-tight ${
                isPast ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {timeRange}
            </p>
            <p
              className={`mt-0.5 truncate text-[13px] font-semibold leading-tight ${
                isCancelled
                  ? "text-slate-400 line-through"
                  : isPast
                    ? "text-slate-500"
                    : "text-slate-900"
              }`}
            >
              {appointment.client_name}
            </p>
            <p className="mt-0.5 truncate text-[12px] text-slate-500">
              {serviceName}
            </p>
            {isCancelled && (
              <p className="mt-1 text-[10px] font-medium text-[#714a58]">
                {statusLabel.cancelled}
              </p>
            )}
          </>
        )}
      </div>
    </button>
  );
}
