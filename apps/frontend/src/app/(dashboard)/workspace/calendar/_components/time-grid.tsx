"use client";

import { useEffect, useState } from "react";
import {
  HOUR_HEIGHT,
  generateHourSlots,
  getCurrentTimeOffset,
  getGridHeight,
} from "./time-grid-constants";

function CurrentTimeLine({
  businessStart,
  businessEnd,
}: {
  businessStart: number;
  businessEnd: number;
}) {
  const [offset, setOffset] = useState<number | null>(() =>
    getCurrentTimeOffset(businessStart, businessEnd)
  );

  useEffect(() => {
    setOffset(getCurrentTimeOffset(businessStart, businessEnd));
    const id = setInterval(() => {
      setOffset(getCurrentTimeOffset(businessStart, businessEnd));
    }, 60_000);
    return () => clearInterval(id);
  }, [businessStart, businessEnd]);

  if (offset === null) return null;

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-30"
      style={{ top: offset }}
    >
      <div className="absolute -left-[5px] -top-[4px] h-[10px] w-[10px] rounded-full bg-red-500" />
      <div className="h-[2px] w-full bg-red-500" />
    </div>
  );
}

export function TimeGrid({
  businessStart,
  businessEnd,
  children,
}: {
  businessStart: number;
  businessEnd: number;
  children: React.ReactNode;
}) {
  const hourSlots = generateHourSlots(businessStart, businessEnd);
  const height = getGridHeight(businessStart, businessEnd);

  return (
    <div className="relative flex" style={{ height }}>
      {/* Hour rail */}
      <div className="sticky left-0 z-10 w-[60px] shrink-0 border-r border-[#f0f1f5] bg-white">
        {hourSlots.map((slot) => (
          <div
            key={slot.hour}
            className="absolute right-3"
            style={{
              top: (slot.hour - businessStart) * HOUR_HEIGHT,
              transform: "translateY(-50%)",
            }}
          >
            <span className="text-[11px] font-medium leading-none text-slate-400 tabular-nums">
              {slot.label}
            </span>
          </div>
        ))}
      </div>

      {/* Grid area */}
      <div className="relative flex-1">
        {/* Hour lines */}
        {hourSlots.map((slot) => (
          <div
            key={`line-${slot.hour}`}
            className="absolute left-0 right-0 border-t border-[#eceef3]"
            style={{ top: (slot.hour - businessStart) * HOUR_HEIGHT }}
          />
        ))}

        {/* Half-hour dashed lines */}
        {hourSlots.slice(0, -1).map((slot) => (
          <div
            key={`half-${slot.hour}`}
            className="absolute left-0 right-0 border-t border-dashed border-[#f3f4f6]"
            style={{
              top: (slot.hour - businessStart) * HOUR_HEIGHT + HOUR_HEIGHT / 2,
            }}
          />
        ))}

        {/* Current time line */}
        <CurrentTimeLine
          businessStart={businessStart}
          businessEnd={businessEnd}
        />

        {/* Column content */}
        {children}
      </div>
    </div>
  );
}
