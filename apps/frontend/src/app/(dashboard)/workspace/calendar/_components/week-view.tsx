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
    <div className="overflow-hidden">
      {/* Day headers */}
      <div className="flex border-b border-[#E2E4EC]">
        <div className="shrink-0" style={{ width: 64 }} />
        {days.map((day, i) => {
          const isToday = sameDay(day.date, today);

          return (
            <div
              key={day.key}
              className={`flex flex-1 flex-col items-center py-3 ${i > 0 ? "border-l border-[#E2E4EC]/60" : ""}`}
            >
              <span
                className={`text-[10px] font-medium uppercase tracking-[0.12em] ${
                  isToday ? "text-[#1C1D22]" : "text-[#6B7280]"
                }`}
              >
                {day.weekday}
              </span>
              <span
                className={`mt-0.5 font-semibold leading-tight ${
                  isToday
                    ? "flex h-7 w-7 items-center justify-center rounded-full bg-[#1c1d22] text-[15px] text-white"
                    : "text-[15px] text-[#1C1D22]"
                }`}
              >
                {day.dayNumber}
              </span>
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 200px)" }}
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
                  className={`relative flex-1 ${dayIdx > 0 ? "border-l border-[#E2E4EC]/60" : ""}`}
                >
                  {/* Hour lines */}
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
                  <div
                    className="absolute left-0 right-0 border-b border-[#E2E4EC]/70"
                    style={{ top: gridHeight }}
                  />

                  {isToday && (
                    <div className="absolute inset-0 bg-[#F5F6FA]/40 pointer-events-none" />
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
