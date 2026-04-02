"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { hexToRgba, getAccentColor } from "./utils";

export type ViewMode = "dia" | "semana" | "equipo";

type Professional = {
  id: string;
  name: string;
  color_hex: string | null;
};

export function CalendarHeader({
  viewMode,
  onViewModeChange,
  dateLabel,
  isToday,
  onPrev,
  onNext,
  onToday,
  professionals,
  selectedProfessionalId,
  onProfessionalChange,
  isProfessionalSession,
  weekTotal,
}: {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  dateLabel: string;
  isToday: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  professionals: Professional[];
  selectedProfessionalId: string;
  onProfessionalChange: (id: string) => void;
  isProfessionalSession: boolean;
  weekTotal: number;
}) {
  const views: { id: ViewMode; label: string }[] = [
    { id: "dia", label: "Dia" },
    { id: "semana", label: "Semana" },
    { id: "equipo", label: "Equipo" },
  ];

  return (
    <div className="flex items-center gap-2">
      {/* View toggles */}
      <div className="inline-flex rounded-full border border-[#E2E4EC] bg-[#F5F6FA] p-0.5">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onViewModeChange(v.id)}
            className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors ${
              viewMode === v.id
                ? "bg-[#1c1d22] text-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-[#6B7280] hover:text-[#1C1D22]"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrev}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E2E4EC] text-[#6B7280] transition-colors hover:bg-[#F5F6FA] hover:text-[#1C1D22]"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[140px] text-center text-[13px] font-semibold tracking-[-0.01em] text-[#1C1D22]">
          {dateLabel}
        </span>
        <button
          type="button"
          onClick={onNext}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#E2E4EC] text-[#6B7280] transition-colors hover:bg-[#F5F6FA] hover:text-[#1C1D22]"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        {!isToday && (
          <button
            type="button"
            onClick={onToday}
            className="rounded-full border border-[#E2E4EC] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#6B7280] transition-colors hover:bg-[#F5F6FA] hover:text-[#1C1D22]"
          >
            Hoy
          </button>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Professional filters + CTA */}
      <div className="flex items-center gap-1.5">
        {!isProfessionalSession && (
          <button
            type="button"
            onClick={() => onProfessionalChange("all")}
            className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors ${
              selectedProfessionalId === "all"
                ? "border-[#1c1d22] bg-[#1c1d22] text-white"
                : "border-[#dde1ea] text-[#6B7280] hover:border-[#cfd5e0] hover:text-[#1C1D22]"
            }`}
          >
            Todos
          </button>
        )}
        {professionals.map((professional, index) => {
          const accent = getAccentColor(professional, index);
          const isSelected = professional.id === selectedProfessionalId;
          return (
            <button
              key={professional.id}
              type="button"
              onClick={() => {
                if (!isProfessionalSession) {
                  onProfessionalChange(professional.id);
                }
              }}
              disabled={isProfessionalSession}
              className="rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
              style={{
                borderColor: isSelected ? accent : hexToRgba(accent, 0.16),
                background: isSelected ? accent : hexToRgba(accent, 0.06),
                color: isSelected ? "#ffffff" : "#24323f",
              }}
            >
              {professional.name}
            </button>
          );
        })}
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1c1d22] px-3.5 py-1 text-[13px] font-medium text-white transition-colors hover:bg-[#2a2b33]"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo turno
        </button>
      </div>
    </div>
  );
}
