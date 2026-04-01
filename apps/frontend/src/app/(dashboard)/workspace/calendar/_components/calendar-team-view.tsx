"use client";

import { CalendarDayView } from "./calendar-day-view";
import type {
  AppointmentItem,
  BoardProfessional,
} from "./calendar-shared-types";

export function CalendarTeamView({
  date,
  appointments,
  professionals,
  businessStart,
  businessEnd,
  onAppointmentClick,
}: {
  date: Date;
  appointments: AppointmentItem[];
  professionals: BoardProfessional[];
  businessStart: number;
  businessEnd: number;
  onAppointmentClick: (appointment: AppointmentItem) => void;
}) {
  return (
    <CalendarDayView
      date={date}
      appointments={appointments}
      professionals={professionals}
      selectedProfessionalId="all"
      businessStart={businessStart}
      businessEnd={businessEnd}
      onAppointmentClick={onAppointmentClick}
    />
  );
}
