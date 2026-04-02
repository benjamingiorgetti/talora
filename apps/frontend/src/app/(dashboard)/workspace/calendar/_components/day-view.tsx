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
    <div className="overflow-hidden">
      {/* Column headers */}
      {columns.length > 1 && (
        <div className="flex border-b border-[#E2E4EC]">
          {/* Spacer for time rail */}
          <div className="shrink-0" style={{ width: 64 }} />
          {columns.map((col, i) => {
            const count = dayAppointments.filter(
              (a) =>
                a.professional_id === col.id ||
                (!a.professional_id && col.id === UNASSIGNED_PROFESSIONAL_ID),
            ).length;

            return (
              <div
                key={col.id}
                className={`flex flex-1 items-center gap-2.5 px-4 py-3 ${i > 0 ? "border-l border-[#E2E4EC]/60" : ""}`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <span className="truncate text-[13px] font-semibold tracking-[-0.01em] text-[#1C1D22]">
                  {col.label}
                </span>
                {count > 0 && (
                  <span className="rounded-md bg-[#F5F6FA] px-1.5 py-px text-[10px] font-medium tabular-nums text-[#6B7280]">
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
        style={{ maxHeight: "calc(100vh - 200px)" }}
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
            <div className="absolute left-0 right-0 flex justify-center pointer-events-none" style={{ top: '40%' }}>
              <p className="text-[13px] font-medium text-[#6B7280]/60">Sin turnos</p>
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
