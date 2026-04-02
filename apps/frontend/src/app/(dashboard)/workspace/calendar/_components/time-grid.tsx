"use client";

import type { Appointment } from "@talora/shared";
import {
  HOUR_HEIGHT,
  type GridHour,
  getOverlapGroups,
  hexToRgba,
  minutesToPx,
  timeToMinutes,
  getDateKey,
} from "./utils";
import { TimeRail } from "./time-rail";
import { CurrentTimeLine } from "./current-time-line";
import { AppointmentBlock } from "./appointment-block";

type AppointmentItem = Appointment & {
  professional_name?: string | null;
  service_name?: string | null;
};

export type GridColumn = {
  id: string;
  label: string;
  color: string;
};

export function TimeGrid({
  columns,
  appointments,
  hours,
  openingMinutes,
  closingMinutes,
  isToday,
  dayKey,
  onAppointmentClick,
}: {
  columns: GridColumn[];
  appointments: AppointmentItem[];
  hours: GridHour[];
  openingMinutes: number;
  closingMinutes: number;
  isToday: boolean;
  dayKey: string;
  onAppointmentClick: (appointment: AppointmentItem) => void;
}) {
  const gridHeight = hours.length * HOUR_HEIGHT;

  return (
    <div className="flex" style={{ height: gridHeight }}>
      <TimeRail hours={hours} />
      <div className="relative flex flex-1">
        {columns.map((col, colIdx) => {
          const colAppointments = appointments.filter((a) => {
            const apptDay = getDateKey(new Date(a.starts_at));
            if (apptDay !== dayKey) return false;
            if (columns.length === 1) return true;
            return a.professional_id === col.id || (!a.professional_id && col.id === "__unassigned__");
          });

          const overlaps = getOverlapGroups(colAppointments);

          return (
            <div
              key={col.id}
              className={`relative flex-1 ${colIdx > 0 ? "border-l border-[#E2E4EC]/50" : ""}`}
            >
              {/* Hour grid lines */}
              {hours.map((h, i) => (
                <div key={`h-${h.hour}`}>
                  <div
                    className="absolute left-0 right-0 border-b border-[#E2E4EC]/70"
                    style={{ top: i * HOUR_HEIGHT }}
                  />
                  <div
                    className="absolute left-0 right-0 border-b border-dashed border-[#E2E4EC]/25"
                    style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                  />
                </div>
              ))}
              {/* Bottom line */}
              <div
                className="absolute left-0 right-0 border-b border-[#E2E4EC]/70"
                style={{ top: gridHeight }}
              />

              {/* Today column tint */}
              {isToday && columns.length > 1 && (
                <div className="absolute inset-0 bg-[#F5F6FA]/40 pointer-events-none" />
              )}

              {/* Appointment blocks */}
              {colAppointments.map((appt) => {
                const startMin = timeToMinutes(appt.starts_at);
                const endMin = timeToMinutes(appt.ends_at);
                const top = minutesToPx(
                  Math.max(startMin, openingMinutes),
                  openingMinutes,
                );
                const height = minutesToPx(
                  Math.min(endMin, closingMinutes),
                  openingMinutes,
                ) - top;
                const overlap = overlaps.get(appt.id) ?? {
                  column: 0,
                  totalColumns: 1,
                };

                return (
                  <AppointmentBlock
                    key={appt.id}
                    appointment={appt}
                    top={top}
                    height={height}
                    column={overlap.column}
                    totalColumns={overlap.totalColumns}
                    color={col.color}
                    onClick={() => onAppointmentClick(appt)}
                  />
                );
              })}
            </div>
          );
        })}

        {/* Current time line */}
        {isToday && (
          <CurrentTimeLine
            openingMinutes={openingMinutes}
            closingMinutes={closingMinutes}
          />
        )}
      </div>
    </div>
  );
}
