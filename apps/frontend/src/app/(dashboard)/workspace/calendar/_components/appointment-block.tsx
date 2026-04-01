"use client";

import type { Appointment } from "@talora/shared";
import {
  MIN_BLOCK_HEIGHT,
  formatTimeRange,
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

export function AppointmentBlock({
  appointment,
  top,
  height,
  column,
  totalColumns,
  color,
  onClick,
}: {
  appointment: AppointmentItem;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
  color: string;
  onClick: () => void;
}) {
  const status = appointment.status ?? "confirmed";
  const timeState = getAppointmentTimeState(
    appointment.starts_at,
    appointment.ends_at,
  );
  const isPast = timeState === "past";
  const isNow = timeState === "now";
  const isCancelled = status === "cancelled";
  const isDraft = status === "draft";
  const isRescheduled = status === "rescheduled";

  const blockHeight = Math.max(height, MIN_BLOCK_HEIGHT);
  const isTall = blockHeight >= 48;

  const leftPercent = (column / totalColumns) * 100;
  const widthPercent = (1 / totalColumns) * 100;

  const getBlockStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      top,
      height: blockHeight,
      left: `calc(${leftPercent}% + 2px)`,
      width: `calc(${widthPercent}% - 4px)`,
      borderRadius: 6,
      borderLeft: "3px solid",
      cursor: "pointer",
      overflow: "hidden",
      transition: "box-shadow 0.15s ease, opacity 0.15s ease",
    };

    if (isCancelled) {
      return {
        ...base,
        background: "#f8f9fb",
        borderLeftColor: "#cbd5e1",
        borderLeftStyle: "dashed",
        opacity: isPast ? 0.35 : 0.5,
      };
    }

    if (isDraft) {
      return {
        ...base,
        background: hexToRgba(color, 0.06),
        borderLeftColor: color,
        borderLeftStyle: "dashed",
        opacity: isPast ? 0.4 : 1,
      };
    }

    if (isRescheduled) {
      return {
        ...base,
        background: hexToRgba("#9A6D38", 0.08),
        borderLeftColor: "#9A6D38",
        opacity: isPast ? 0.4 : 1,
      };
    }

    return {
      ...base,
      background: hexToRgba(color, isNow ? 0.18 : 0.12),
      borderLeftColor: color,
      opacity: isPast ? 0.4 : 1,
    };
  };

  const timeRange = formatTimeRange(appointment.starts_at, appointment.ends_at);
  const service = appointment.service_name ?? appointment.title ?? "Turno";
  const client = appointment.client_name;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      style={getBlockStyle()}
      className="group hover:shadow-md hover:z-10"
    >
      <div className="flex h-full flex-col justify-center px-2 py-1">
        {isTall ? (
          <>
            <p
              className={`truncate text-xs font-semibold leading-tight ${
                isCancelled
                  ? "text-slate-400 line-through"
                  : isPast
                    ? "text-slate-500"
                    : "text-slate-900"
              }`}
            >
              {client}
            </p>
            <p
              className={`mt-0.5 truncate text-[11px] leading-tight ${
                isCancelled || isPast ? "text-slate-400" : "text-slate-600"
              }`}
            >
              {service}
            </p>
            {blockHeight >= 64 && (
              <p
                className={`mt-0.5 truncate text-[10px] tabular-nums leading-tight ${
                  isCancelled || isPast ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {timeRange}
              </p>
            )}
          </>
        ) : (
          <p
            className={`truncate text-[11px] font-medium leading-tight ${
              isCancelled
                ? "text-slate-400 line-through"
                : isPast
                  ? "text-slate-500"
                  : "text-slate-800"
            }`}
          >
            {client} · {timeRange.split(" – ")[0]}
          </p>
        )}
      </div>

      {isNow && (
        <div
          className="absolute inset-x-0 bottom-0 h-[2px]"
          style={{ backgroundColor: color }}
        />
      )}
    </div>
  );
}
