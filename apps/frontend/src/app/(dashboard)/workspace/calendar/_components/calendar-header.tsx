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
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Left: View toggles */}
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-full border border-[#e6e7ec] bg-white p-1">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onViewModeChange(v.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                viewMode === v.id
                  ? "bg-[#1c1d22] text-white shadow-sm"
                  : "text-slate-600 hover:bg-[#f7f8fc]"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Center: Date navigation */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e6e7ec] bg-white text-slate-600 transition-colors hover:bg-[#f6f7fb]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[140px] text-center text-sm font-medium text-slate-900">
          {dateLabel}
        </span>
        <button
          type="button"
          onClick={onNext}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e6e7ec] bg-white text-slate-600 transition-colors hover:bg-[#f6f7fb]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {!isToday && (
          <button
            type="button"
            onClick={onToday}
            className="rounded-full border border-[#e6e7ec] bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-[#f6f7fb]"
          >
            Hoy
          </button>
        )}
        {weekTotal > 0 && (
          <span className="hidden text-sm text-slate-500 lg:inline-flex">
            {weekTotal === 1 ? "1 turno" : `${weekTotal} turnos`}
          </span>
        )}
      </div>

      {/* Right: Professional filters + CTA */}
      <div className="flex flex-wrap items-center gap-2">
        {!isProfessionalSession && (
          <button
            type="button"
            onClick={() => onProfessionalChange("all")}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              selectedProfessionalId === "all"
                ? "border-[#1c1d22] bg-[#1c1d22] text-white"
                : "border-[#dde1ea] bg-[#f7f8fc] text-slate-700 hover:border-[#cfd5e0] hover:bg-white"
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
              className="rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50"
              style={{
                borderColor: isSelected ? accent : hexToRgba(accent, 0.16),
                background: isSelected ? accent : hexToRgba(accent, 0.09),
                color: isSelected ? "#ffffff" : "#24323f",
              }}
            >
              {professional.name}
            </button>
          );
        })}
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#1c1d22] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#2a2b33]"
        >
          <Plus className="h-4 w-4" />
          Nuevo turno
        </button>
      </div>
    </div>
  );
}
