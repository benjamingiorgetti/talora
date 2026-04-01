"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  formatTimeRange,
  getDurationLabel,
  getAppointmentTimeState,
  getAccentColor,
} from "./utils";
import {
  statusLabel,
  statusTone,
  type AppointmentItem,
  type BoardProfessional,
} from "./calendar-shared-types";
import { Calendar, Clock, User, Phone, FileText, Briefcase } from "lucide-react";

export function AppointmentDetailSheet({
  appointment,
  professionals,
  professionalMap,
  open,
  onOpenChange,
}: {
  appointment: AppointmentItem | null;
  professionals: BoardProfessional[];
  professionalMap: Map<string, { id: string; color_hex: string | null; name: string; specialty?: string | null }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!appointment) {
    return (
      <Sheet open={false} onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle />
            <SheetDescription />
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  const professional = appointment.professional_id
    ? professionalMap.get(appointment.professional_id)
    : null;
  const profIndex = professional
    ? professionals.findIndex((p) => p.id === professional.id)
    : 0;
  const accent = professional
    ? getAccentColor(professional, Math.max(0, profIndex))
    : "#667085";
  const status = appointment.status ?? "confirmed";
  const timeState = getAppointmentTimeState(
    appointment.starts_at,
    appointment.ends_at
  );
  const timeRange = formatTimeRange(
    appointment.starts_at,
    appointment.ends_at
  );
  const duration = getDurationLabel(
    appointment.starts_at,
    appointment.ends_at
  );
  const dateDisplay = new Date(appointment.starts_at).toLocaleDateString(
    "es-AR",
    { weekday: "long", day: "numeric", month: "long" }
  );
  const sourceLabel =
    appointment.source === "bot"
      ? "WhatsApp Bot"
      : appointment.source === "manual"
        ? "Manual"
        : appointment.source === "google_calendar"
          ? "Google Calendar"
          : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {/* Accent bar */}
        <div
          className="h-1.5 w-full shrink-0"
          style={{ backgroundColor: accent }}
        />

        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="font-display text-xl font-semibold text-slate-950">
            {appointment.client_name}
          </SheetTitle>
          <SheetDescription className="text-sm text-slate-500">
            {appointment.service_name ?? appointment.title ?? "Turno"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 pb-6">
          {/* Time */}
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-800">{timeRange}</p>
              <p className="text-xs text-slate-500">{duration}</p>
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
            <p className="text-sm text-slate-800">
              {dateDisplay.charAt(0).toUpperCase() + dateDisplay.slice(1)}
            </p>
          </div>

          {/* Professional */}
          {professional && (
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: accent }}
                />
                <p className="text-sm text-slate-800">{professional.name}</p>
                {professional.specialty && (
                  <span className="text-xs text-slate-400">
                    {professional.specialty}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Phone */}
          {appointment.phone_number && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 shrink-0 text-slate-400" />
              <a
                href={`tel:${appointment.phone_number}`}
                className="text-sm text-slate-800 hover:underline"
              >
                {appointment.phone_number}
              </a>
            </div>
          )}

          {/* Status + source */}
          <div className="flex items-center gap-3">
            <Briefcase className="h-4 w-4 shrink-0 text-slate-400" />
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                  statusTone[status] ?? statusTone.draft
                }`}
              >
                {statusLabel[status] ?? status}
              </span>
              {sourceLabel && (
                <span className="inline-flex items-center rounded-full border border-[#e6e7ec] bg-[#f7f8fc] px-2.5 py-1 text-xs font-medium text-slate-600">
                  {sourceLabel}
                </span>
              )}
            </div>
          </div>

          {/* Notes */}
          {appointment.notes && (
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="whitespace-pre-wrap text-sm text-slate-600">
                {appointment.notes}
              </p>
            </div>
          )}

          {/* Active indicator */}
          {timeState === "now" && (
            <div className="animate-status-pulse rounded-xl bg-slate-950 px-4 py-2.5 text-center text-sm font-medium text-white">
              En curso ahora
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
