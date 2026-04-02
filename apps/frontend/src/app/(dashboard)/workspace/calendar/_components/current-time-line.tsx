"use client";

import { useEffect, useState } from "react";
import { HOUR_HEIGHT, minutesToPx } from "./utils";

export function CurrentTimeLine({
  openingMinutes,
  closingMinutes,
}: {
  openingMinutes: number;
  closingMinutes: number;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes < openingMinutes || nowMinutes > closingMinutes) return null;

  const top = minutesToPx(nowMinutes, openingMinutes, HOUR_HEIGHT);

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
      style={{ top }}
    >
      <div className="h-1.5 w-1.5 -ml-[3px] shrink-0 rounded-full bg-[#1C1D22]" />
      <div className="h-px flex-1 bg-[#1C1D22]/40" />
      <span className="ml-1 shrink-0 rounded bg-[#1C1D22] px-1.5 py-px text-[10px] font-medium tabular-nums text-white">
        {now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}
