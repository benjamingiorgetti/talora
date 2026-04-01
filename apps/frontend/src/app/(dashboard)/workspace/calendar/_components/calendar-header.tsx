"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatWeekRange, sameDay, startOfWeek, getAccentColor, hexToRgba } from "./utils";
import type { BoardProfessional, CalendarViewMode } from "./calendar-shared-types";

const viewLabels: { value: CalendarViewMode; label: string }[] = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "team", label: "Equipo" },
];

function formatDayDisplay(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isCurrentWeek(date: Date): boolean {
  const today = new Date();
  const weekStart = startOfWeek(date);
  const todayWeekStart = startOfWeek(today);
  return weekStart.getTime() === todayWeekStart.getTime();
}

export function CalendarHeader({
  view,
  onViewChange,
  currentDate,
  onDateChange,
  onToday,
  professionals,
  selectedProfessionalId,
  onProfessionalChange,
  isProfessionalSession,
  weekTotal,
}: {
  view: CalendarViewMode;
  onViewChange: (view: CalendarViewMode) => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onToday: () => void;
  professionals: BoardProfessional[];
  selectedProfessionalId: string;
  onProfessionalChange: (id: string) => void;
  isProfessionalSession: boolean;
  weekTotal: number;
}) {
  const isToday = sameDay(currentDate, new Date());
  const showTodayButton =
    view === "week" ? !isCurrentWeek(currentDate) : !isToday;

  function handlePrev() {
    const next = new Date(currentDate);
    if (view === "week") {
      next.setDate(next.getDate() - 7);
    } else {
      next.setDate(next.getDate() - 1);
    }
    onDateChange(next);
  }

  function handleNext() {
    const next = new Date(currentDate);
    if (view === "week") {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    onDateChange(next);
  }

  const dateDisplay =
    view === "week"
      ? (() => {
          const ws = startOfWeek(currentDate);
          const we = new Date(ws);
          we.setDate(we.getDate() + 6);
          return formatWeekRange(ws, we);
        })()
      : capitalize(formatDayDisplay(currentDate));

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Left: view switcher + date nav */}
      <div className="flex flex-wrap items-center gap-2">
        {/* View switcher */}
        <div className="flex rounded-2xl border border-[#e6e7ec] bg-[#f7f8fc] p-1">
          {viewLabels.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onViewChange(value)}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                view === value
                  ? "bg-[#1c1d22] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrev}
            className="h-9 w-9 rounded-2xl border-muted bg-white hover:bg-[#f6f7fb]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNext}
            className="h-9 w-9 rounded-2xl border-muted bg-white hover:bg-[#f6f7fb]"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {showTodayButton && (
          <button
            type="button"
            onClick={onToday}
            className="rounded-2xl border border-muted bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-[#f6f7fb]"
          >
            Hoy
          </button>
        )}

        {/* Date display */}
        <span className="text-sm font-medium text-slate-800">
          {dateDisplay}
        </span>

        {weekTotal > 0 && (
          <span className="hidden text-sm text-slate-500 sm:inline-flex">
            · {weekTotal === 1 ? "1 turno" : `${weekTotal} turnos`}
          </span>
        )}
      </div>

      {/* Right: professional filter pills */}
      {view !== "team" && (
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
          {professionals
            .filter((p) => p.id !== "__unassigned__")
            .map((professional, index) => {
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
                    borderColor: isSelected
                      ? accent
                      : hexToRgba(accent, 0.16),
                    background: isSelected
                      ? accent
                      : hexToRgba(accent, 0.09),
                    color: isSelected ? "#ffffff" : "#24323f",
                  }}
                >
                  {professional.name}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
