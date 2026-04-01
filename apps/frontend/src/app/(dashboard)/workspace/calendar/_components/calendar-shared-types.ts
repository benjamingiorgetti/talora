import type { Appointment } from "@talora/shared";

export type AppointmentItem = Appointment & {
  professional_name?: string | null;
  service_name?: string | null;
};

export type BoardProfessional = {
  id: string;
  name: string;
  specialty?: string | null;
  color_hex: string | null;
  calendar_id?: string;
  is_active: boolean;
};

export type CalendarViewMode = "day" | "week" | "team";

export const statusLabel: Record<string, string> = {
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  rescheduled: "Reprogramado",
  draft: "Borrador",
};

export const statusTone: Record<string, string> = {
  confirmed: "bg-[#dbf0dd] text-[#2d5e3a]",
  cancelled: "bg-[#f5dbe4] text-[#714a58]",
  rescheduled: "bg-[#f3dfc1] text-[#6c5338]",
  draft: "bg-[#e6e7ec] text-slate-600",
};
