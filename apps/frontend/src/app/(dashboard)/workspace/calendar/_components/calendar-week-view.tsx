"use client";

import { useMemo, useRef, useEffect } from "react";
import { TimeGrid } from "./time-grid";
import { AppointmentBlock } from "./appointment-block";
import { layoutAppointments } from "./overlap-layout";
import { getCurrentTimeOffset } from "./time-grid-constants";
import { getAccentColor, getDateKey, sameDay } from "./utils";
import type { CalendarDay } from "./utils";
import type {
  AppointmentItem,
  BoardProfessional,
} from "./calendar-shared-types";

export function CalendarWeekView({
  calendarDays,
  appointments,
  professionals,
  professionalMap,
  businessStart,
  businessEnd,
  onAppointmentClick,
}: {
  calendarDays: CalendarDay[];
  appointments: AppointmentItem[];
  professionals: BoardProfessional[];
  professionalMap: Map<string, { id: string; color_hex: string | null }>;
  businessStart: number;
  businessEnd: number;
  onAppointmentClick: (appointment: AppointmentItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, AppointmentItem[]>();
    for (const a of appointments) {
      const key = getDateKey(new Date(a.starts_at));
      const list = map.get(key) ?? [];
      list.push(a);
      map.set(key, list);
    }
    return map;
  }, [appointments]);

  // Auto-scroll to current time
  useEffect(() => {
    const offset = getCurrentTimeOffset(businessStart, businessEnd);
    if (offset !== null && scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, offset - 200);
    }
  }, [businessStart, businessEnd]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#e6e7ec] bg-white">
      {/* Day column headers */}
      <div className="sticky top-0 z-20 flex border-b border-[#eceef3] bg-white/95 backdrop-blur-sm">
        <div className="w-[60px] shrink-0" />
        {calendarDays.map((day) => {
          const isToday = sameDay(day.date, today);
          return (
            <div
              key={day.key}
              className="flex flex-1 flex-col items-center border-r border-[#f0f1f5] py-2.5 last:border-r-0"
            >
              <span className="text-[11px] font-medium tracking-wide text-slate-400">
                {day.weekday}
              </span>
              <span
                className={`mt-0.5 flex h-8 w-8 items-center justify-center text-base font-semibold ${
                  isToday
                    ? "rounded-full bg-[#1c1d22] text-white"
                    : "text-slate-800"
                }`}
              >
                {day.dayNumber}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <TimeGrid businessStart={businessStart} businessEnd={businessEnd}>
          <div className="flex h-full">
            {calendarDays.map((day) => {
              const dayAppts = appointmentsByDay.get(day.key) ?? [];
              const positioned = layoutAppointments(dayAppts, businessStart);
              const isToday = sameDay(day.date, today);

              return (
                <div
                  key={day.key}
                  className={`relative flex-1 border-r border-[#f0f1f5] last:border-r-0 ${
                    isToday ? "bg-[#fafbff]" : ""
                  }`}
                >
                  {positioned.map((pos) => {
                    const prof = pos.appointment.professional_id
                      ? professionalMap.get(pos.appointment.professional_id)
                      : null;
                    const profIndex = prof
                      ? professionals.findIndex((p) => p.id === prof.id)
                      : 0;
                    const accent = prof
                      ? getAccentColor(prof, Math.max(0, profIndex))
                      : "#667085";
                    return (
                      <AppointmentBlock
                        key={pos.appointment.id}
                        appointment={pos.appointment}
                        top={pos.top}
                        height={pos.height}
                        column={pos.column}
                        totalColumns={pos.totalColumns}
                        accent={accent}
                        onClick={onAppointmentClick}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </TimeGrid>
      </div>
    </div>
  );
}
