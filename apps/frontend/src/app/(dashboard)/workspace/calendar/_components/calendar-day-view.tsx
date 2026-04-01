"use client";

import { useMemo, useRef, useEffect } from "react";
import { TimeGrid } from "./time-grid";
import { AppointmentBlock } from "./appointment-block";
import { layoutAppointments } from "./overlap-layout";
import { getCurrentTimeOffset } from "./time-grid-constants";
import {
  getAccentColor,
  getDateKey,
  UNASSIGNED_PROFESSIONAL_ID,
} from "./utils";
import type {
  AppointmentItem,
  BoardProfessional,
} from "./calendar-shared-types";

export function CalendarDayView({
  date,
  appointments,
  professionals,
  selectedProfessionalId,
  businessStart,
  businessEnd,
  onAppointmentClick,
}: {
  date: Date;
  appointments: AppointmentItem[];
  professionals: BoardProfessional[];
  selectedProfessionalId: string;
  businessStart: number;
  businessEnd: number;
  onAppointmentClick: (appointment: AppointmentItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dateKey = getDateKey(date);

  const dayAppointments = useMemo(
    () =>
      appointments.filter((a) => {
        const aDate = new Date(a.starts_at);
        return getDateKey(aDate) === dateKey;
      }),
    [appointments, dateKey]
  );

  const visibleProfessionals = useMemo(() => {
    if (selectedProfessionalId === "all") return professionals;
    return professionals.filter((p) => p.id === selectedProfessionalId);
  }, [professionals, selectedProfessionalId]);

  // Auto-scroll to current time
  useEffect(() => {
    const offset = getCurrentTimeOffset(businessStart, businessEnd);
    if (offset !== null && scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, offset - 200);
    }
  }, [businessStart, businessEnd, dateKey]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#e6e7ec] bg-white">
      {/* Column headers */}
      {visibleProfessionals.length > 1 && (
        <div className="sticky top-0 z-20 flex border-b border-[#eceef3] bg-white/95 backdrop-blur-sm">
          <div className="w-[60px] shrink-0" />
          {visibleProfessionals.map((prof, i) => {
            const accent = getAccentColor(prof, i);
            return (
              <div
                key={prof.id}
                className="flex min-w-[180px] flex-1 items-center justify-center gap-2 border-r border-[#f0f1f5] py-3 last:border-r-0"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <span className="truncate text-sm font-medium text-slate-800">
                  {prof.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable grid */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-auto"
      >
        <TimeGrid businessStart={businessStart} businessEnd={businessEnd}>
          <div className="flex h-full">
            {visibleProfessionals.map((prof, i) => {
              const accent = getAccentColor(prof, i);
              const profAppts = dayAppointments.filter(
                (a) =>
                  a.professional_id === prof.id ||
                  (!a.professional_id &&
                    prof.id === UNASSIGNED_PROFESSIONAL_ID)
              );
              const positioned = layoutAppointments(profAppts, businessStart);

              return (
                <div
                  key={prof.id}
                  className="relative flex-1 border-r border-[#f0f1f5] last:border-r-0"
                  style={{
                    minWidth:
                      visibleProfessionals.length > 1 ? 180 : undefined,
                  }}
                >
                  {positioned.map((pos) => (
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
                  ))}
                </div>
              );
            })}
          </div>
        </TimeGrid>
      </div>
    </div>
  );
}
