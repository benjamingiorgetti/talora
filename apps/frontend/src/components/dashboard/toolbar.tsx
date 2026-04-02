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
  isProfessional,
  className,
}: {
  timeRange: TimeRange;
  onTimeRangeChange: (v: TimeRange) => void;
  professionals: Professional[];
  professionalId: string;
  onProfessionalChange: (v: string) => void;
  isProfessional: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 mb-4 ${className ?? ""}`}>
      {/* Time range segmented control */}
      <div className="flex items-center gap-1 rounded-lg bg-[#f0f1f5] p-[3px]">
        {timeRangeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onTimeRangeChange(opt.value)}
            className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-all ${
              timeRange === opt.value
                ? "bg-white text-[#111318] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-[#6B7280] hover:text-[#111318]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Professional filter */}
      {!isProfessional && professionals.length > 0 && (
        <select
          value={professionalId}
          onChange={(e) => onProfessionalChange(e.target.value)}
          className="rounded-lg border border-[#dde1ea] bg-white px-2.5 py-1 text-[11px] font-medium text-[#4B5563] outline-none focus:border-[#9AA1AE]"
        >
          <option value="all">Todos los profesionales</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
