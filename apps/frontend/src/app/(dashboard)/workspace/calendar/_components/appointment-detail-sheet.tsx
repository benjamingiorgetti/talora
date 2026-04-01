"use client";

import type { Appointment } from "@talora/shared";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  formatTimeRange,
  getDurationLabel,
  hexToRgba,
} from "./utils";
import {
  Clock,
  User,
  Phone,
  Tag,
  FileText,
  MessageSquare,
} from "lucide-react";

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

const statusTone: Record<string, string> = {
  confirmed: "bg-[#dbf0dd] text-[#2d5e3a]",
  cancelled: "bg-[#f5dbe4] text-[#714a58]",
  rescheduled: "bg-[#f3dfc1] text-[#6c5338]",
  draft: "bg-[#e6e7ec] text-slate-600",
};

const sourceLabel: Record<string, string> = {
  bot: "WhatsApp Bot",
  manual: "Manual",
  google_calendar: "Google Calendar",
};

export function AppointmentDetailSheet({
  appointment,
  professionalColor,
  onClose,
}: {
  appointment: AppointmentItem | null;
  professionalColor?: string;
  onClose: () => void;
}) {
  if (!appointment) return null;

  const status = appointment.status ?? "confirmed";
  const timeRange = formatTimeRange(appointment.starts_at, appointment.ends_at);
  const duration = getDurationLabel(appointment.starts_at, appointment.ends_at);
  const color = professionalColor ?? "#667085";

  const dateLabel = new Date(appointment.starts_at).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[380px] sm:w-[420px]">
        <SheetHeader>
          <SheetTitle className="text-left text-lg font-semibold text-slate-900">
            {appointment.client_name}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Status + Source */}
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone[status] ?? statusTone.draft}`}
            >
              {statusLabel[status] ?? status}
            </span>
            <span className="rounded-full bg-[#f7f8fc] px-3 py-1 text-xs font-medium text-slate-500">
              {sourceLabel[appointment.source] ?? appointment.source}
            </span>
          </div>

          {/* Date & Time */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900 capitalize">
                  {dateLabel}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {timeRange} · {duration}
                </p>
              </div>
            </div>

            {/* Professional */}
            {appointment.professional_name && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 shrink-0 text-slate-400" />
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm text-slate-700">
                    {appointment.professional_name}
                  </span>
                </div>
              </div>
            )}

            {/* Service */}
            {(appointment.service_name ?? appointment.title) && (
              <div className="flex items-center gap-3">
                <Tag className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="text-sm text-slate-700">
                  {appointment.service_name ?? appointment.title}
                </span>
              </div>
            )}

            {/* Phone */}
            {appointment.phone_number && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="text-sm text-slate-700 tabular-nums">
                  {appointment.phone_number}
                </span>
              </div>
            )}

            {/* Notes */}
            {appointment.notes && (
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  {appointment.notes}
                </p>
              </div>
            )}

            {/* Conversation link */}
            {appointment.conversation_id && (
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="text-sm text-slate-500">
                  Tiene conversacion asociada
                </span>
              </div>
            )}
          </div>

          {/* Action buttons (placeholder) */}
          <div className="flex gap-2 border-t border-[#e6e7ec] pt-5">
            <button
              type="button"
              className="flex-1 rounded-full border border-[#e6e7ec] px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-[#f7f8fc]"
            >
              Reprogramar
            </button>
            <button
              type="button"
              className="flex-1 rounded-full border border-[#f5dbe4] px-4 py-2 text-sm font-medium text-[#714a58] transition-colors hover:bg-[#fdf2f6]"
            >
              Cancelar
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
