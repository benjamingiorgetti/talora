"use client";

import { useEffect, useRef, useMemo } from "react";
import type { Appointment } from "@talora/shared";
import {
  type CalendarDay,
  type GridHour,
  HOUR_HEIGHT,
  getAccentColor,
  getDateKey,
  minutesToPx,
  sameDay,
} from "./utils";
import { TimeRail } from "./time-rail";
import { CurrentTimeLine } from "./current-time-line";
import { AppointmentBlock } from "./appointment-block";
import { getOverlapGroups, timeToMinutes } from "./utils";

type AppointmentItem = Appointment & {
  professional_name?: string | null;
  service_name?: string | null;
};

type BoardProfessional = {
  id: string;
  name: string;
  color_hex: string | null;
  is_active: boolean;
};

export function WeekView({
  days,
  appointments,
  professionals,
  selectedProfessionalId,
  hours,
  openingMinutes,
  closingMinutes,
  onAppointmentClick,
}: {
  days: CalendarDay[];
  appointments: AppointmentItem[];
  professionals: BoardProfessional[];
  selectedProfessionalId: string;
  hours: GridHour[];
  openingMinutes: number;
  closingMinutes: number;
  onAppointmentClick: (appt: AppointmentItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const gridHeight = hours.length * HOUR_HEIGHT;

  // Auto-scroll to current time
  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const offset = minutesToPx(nowMinutes, openingMinutes, HOUR_HEIGHT);
    scrollRef.current.scrollTo({
      top: Math.max(0, offset - 200),
      behavior: "smooth",
    });
  }, [openingMinutes]);

  const defaultColor = useMemo(() => {
    if (selectedProfessionalId === "all") return "#667085";
    const prof = professionals.find((p) => p.id === selectedProfessionalId);
    const idx = professionals.findIndex((p) => p.id === selectedProfessionalId);
    return prof ? getAccentColor(prof, idx) : "#667085";
  }, [selectedProfessionalId, professionals]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e6e7ec] bg-white">
      {/* Day headers */}
      <div className="flex border-b border-[#e6e7ec] bg-[#f7f8fc]">
        <div className="shrink-0" style={{ width: 58 }} />
        {days.map((day, i) => {
          const isToday = sameDay(day.date, today);
          const count = appointments.filter(
            (a) => getDateKey(new Date(a.starts_at)) === day.key,
          ).length;

          return (
            <div
              key={day.key}
              className={`flex flex-1 flex-col items-center py-2.5 ${i > 0 ? "border-l border-[#e6e7ec]" : ""} ${isToday ? "bg-[#FAFBFD]" : ""}`}
            >
              <span
                className={`text-[11px] font-medium tracking-[0.1em] ${
                  isToday ? "text-[#5E4AE3]" : "text-slate-400"
                }`}
              >
                {day.weekday}
              </span>
              <span
                className={`mt-0.5 text-lg font-semibold leading-tight ${
                  isToday
                    ? "flex h-8 w-8 items-center justify-center rounded-full bg-[#1c1d22] text-white"
                    : "text-slate-900"
                }`}
              >
                {day.dayNumber}
              </span>
              {count > 0 && (
                <span className="mt-1 text-[10px] text-slate-400">
                  {count}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 220px)" }}
      >
        <div className="flex" style={{ height: gridHeight }}>
          <TimeRail hours={hours} />
          <div className="relative flex flex-1">
            {days.map((day, dayIdx) => {
              const isToday = sameDay(day.date, today);
              const dayAppts = appointments.filter(
                (a) => getDateKey(new Date(a.starts_at)) === day.key,
              );
              const overlaps = getOverlapGroups(dayAppts);

              return (
                <div
                  key={day.key}
                  className={`relative flex-1 ${dayIdx > 0 ? "border-l border-[#E2E4EC]" : ""}`}
                >
                  {/* Hour lines */}
                  {hours.map((h, i) => (
                    <div key={`h-${h.hour}`}>
                      <div
                        className="absolute left-0 right-0 border-b border-[#E2E4EC]"
                        style={{ top: i * HOUR_HEIGHT }}
                      />
                      <div
                        className="absolute left-0 right-0 border-b border-dashed border-[#F0F1F5]"
                        style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                      />
                    </div>
                  ))}
                  <div
                    className="absolute left-0 right-0 border-b border-[#E2E4EC]"
                    style={{ top: gridHeight }}
                  />

                  {isToday && (
                    <div className="absolute inset-0 bg-[#FAFBFD] pointer-events-none" />
                  )}

                  {dayAppts.map((appt) => {
                    const startMin = timeToMinutes(appt.starts_at);
                    const endMin = timeToMinutes(appt.ends_at);
                    const top = minutesToPx(
                      Math.max(startMin, openingMinutes),
                      openingMinutes,
                    );
                    const height =
                      minutesToPx(
                        Math.min(endMin, closingMinutes),
                        openingMinutes,
                      ) - top;
                    const overlap = overlaps.get(appt.id) ?? {
                      column: 0,
                      totalColumns: 1,
                    };

                    const profIdx = professionals.findIndex(
                      (p) => p.id === appt.professional_id,
                    );
                    const prof =
                      profIdx >= 0 ? professionals[profIdx] : null;
                    const color = prof
                      ? getAccentColor(prof, profIdx)
                      : defaultColor;

                    return (
                      <AppointmentBlock
                        key={appt.id}
                        appointment={appt}
                        top={top}
                        height={height}
                        column={overlap.column}
                        totalColumns={overlap.totalColumns}
                        color={color}
                        onClick={() => onAppointmentClick(appt)}
                      />
                    );
                  })}
                </div>
              );
            })}

            {/* Current time line across all day columns */}
            {days.some((d) => sameDay(d.date, today)) && (
              <CurrentTimeLine
                openingMinutes={openingMinutes}
                closingMinutes={closingMinutes}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
