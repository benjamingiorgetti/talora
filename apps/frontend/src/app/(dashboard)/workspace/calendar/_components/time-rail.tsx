"use client";

import { HOUR_HEIGHT, type GridHour } from "./utils";

export function TimeRail({ hours }: { hours: GridHour[] }) {
  return (
    <div
      className="relative shrink-0 border-r-2 border-[#E2E4EC]"
      style={{ width: 56, height: hours.length * HOUR_HEIGHT }}
    >
      {hours.map((h, i) => (
        <div
          key={h.hour}
          className="absolute right-0 flex items-start justify-end pr-3"
          style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
        >
          <span className="relative -top-[7px] text-xs font-medium tabular-nums text-[#6B7280]">
            {h.label}
          </span>
        </div>
      ))}
    </div>
  );
}
