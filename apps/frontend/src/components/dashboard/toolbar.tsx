"use client";

import type { Professional } from "@talora/shared";
import type { TimeRange } from "@/app/(dashboard)/workspace/_hooks/use-dashboard-filters";

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

export function DashboardToolbar({
  timeRange,
  onTimeRangeChange,
  professionals,
  professionalId,
  onProfessionalChange,
  botActivity,
  whatsappConnected,
  calendarConnected,
  isProfessional,
}: {
  timeRange: TimeRange;
  onTimeRangeChange: (v: TimeRange) => void;
  professionals: Professional[];
  professionalId: string;
  onProfessionalChange: (v: string) => void;
  botActivity: { label: string; tone: "green" | "yellow" | "red" };
  whatsappConnected: boolean;
  calendarConnected: boolean;
  isProfessional: boolean;
}) {
  const dotColor = {
    green: "bg-emerald-500",
    yellow: "bg-amber-400",
    red: "bg-red-400",
  };

  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#dde1ea] pb-3 mb-1">
      {/* Left: Time range segmented control */}
      <div className="flex items-center gap-1 rounded-lg bg-[#ecedf2] p-0.5">
        {timeRangeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onTimeRangeChange(opt.value)}
            className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-all ${
              timeRange === opt.value
                ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Center: Professional filter */}
      {!isProfessional && professionals.length > 0 && (
        <select
          value={professionalId}
          onChange={(e) => onProfessionalChange(e.target.value)}
          className="rounded-lg border border-[#e2e4ec] bg-white px-2.5 py-1 text-[12px] font-medium text-slate-700 outline-none focus:border-slate-400"
        >
          <option value="all">Todos los profesionales</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      {/* Right: System health indicators */}
      {!isProfessional && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${dotColor[botActivity.tone]}`} />
            <span className="text-[11px] text-slate-600">{botActivity.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${whatsappConnected ? "bg-emerald-500" : "bg-red-400"}`} />
            <span className="text-[11px] text-slate-600">WhatsApp</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${calendarConnected ? "bg-emerald-500" : "bg-red-400"}`} />
            <span className="text-[11px] text-slate-600">Calendar</span>
          </div>
        </div>
      )}
    </div>
  );
}
