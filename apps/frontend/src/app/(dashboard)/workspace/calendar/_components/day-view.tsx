"use client";

import { useEffect, useRef, useMemo } from "react";
import type { Appointment } from "@talora/shared";
import {
  type CalendarDay,
  type GridHour,
  HOUR_HEIGHT,
  UNASSIGNED_PROFESSIONAL_ID,
  getAccentColor,
  getDateKey,
  minutesToPx,
  sameDay,
} from "./utils";
import { TimeGrid, type GridColumn } from "./time-grid";
import { CalendarDays } from "lucide-react";

type AppointmentItem = Appointment & {
  professional_name?: string | null;
  service_name?: string | null;
};

type BoardProfessional = {
  id: string;
  name: string;
  specialty?: string | null;
  color_hex: string | null;
  is_active: boolean;
};

export function DayView({
  day,
  appointments,
  professionals,
  hours,
  openingMinutes,
  closingMinutes,
  showAllProfessionals,
  onAppointmentClick,
}: {
  day: CalendarDay;
  appointments: AppointmentItem[];
  professionals: BoardProfessional[];
  hours: GridHour[];
  openingMinutes: number;
  closingMinutes: number;
  showAllProfessionals: boolean;
  onAppointmentClick: (appointment: AppointmentItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isToday = sameDay(day.date, new Date());

  const dayAppointments = useMemo(
    () => appointments.filter((a) => getDateKey(new Date(a.starts_at)) === day.key),
    [appointments, day.key],
  );

  const columns: GridColumn[] = useMemo(() => {
    if (!showAllProfessionals || professionals.length <= 1) {
      const prof = professionals[0];
      return [
        {
          id: prof?.id ?? "single",
          label: prof?.name ?? "",
          color: prof ? getAccentColor(prof, 0) : "#667085",
        },
      ];
    }
    return professionals.map((p, i) => ({
      id: p.id,
      label: p.name,
      color: getAccentColor(p, i),
    }));
  }, [professionals, showAllProfessionals]);

  // Auto-scroll to current time
  useEffect(() => {
    if (!isToday || !scrollRef.current) return;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const offset = minutesToPx(nowMinutes, openingMinutes, HOUR_HEIGHT);
    scrollRef.current.scrollTo({
      top: Math.max(0, offset - 200),
      behavior: "smooth",
    });
  }, [isToday, openingMinutes, day.key]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e6e7ec] bg-white">
      {/* Column headers */}
      {columns.length > 1 && (
        <div className="flex border-b border-[#e6e7ec] bg-[#f7f8fc]">
          {/* Spacer for time rail */}
          <div className="shrink-0" style={{ width: 58 }} />
          {columns.map((col, i) => {
            const count = dayAppointments.filter(
              (a) =>
                a.professional_id === col.id ||
                (!a.professional_id && col.id === UNASSIGNED_PROFESSIONAL_ID),
            ).length;

            return (
              <div
                key={col.id}
                className={`flex flex-1 items-center gap-2 px-3 py-3 ${i > 0 ? "border-l border-[#e6e7ec]" : ""}`}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <span className="truncate text-sm font-medium text-slate-900">
                  {col.label}
                </span>
                {count > 0 && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 220px)" }}
      >
        {dayAppointments.length === 0 ? (
          <div className="relative">
            <TimeGrid
              columns={columns}
              appointments={[]}
              hours={hours}
              openingMinutes={openingMinutes}
              closingMinutes={closingMinutes}
              isToday={isToday}
              dayKey={day.key}
              onAppointmentClick={onAppointmentClick}
            />
            {/* Empty state overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-2 pointer-events-auto">
                <CalendarDays className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400">Sin turnos en este dia</p>
              </div>
            </div>
          </div>
        ) : (
          <TimeGrid
            columns={columns}
            appointments={dayAppointments}
            hours={hours}
            openingMinutes={openingMinutes}
            closingMinutes={closingMinutes}
            isToday={isToday}
            dayKey={day.key}
            onAppointmentClick={onAppointmentClick}
          />
        )}
      </div>
    </div>
  );
}
