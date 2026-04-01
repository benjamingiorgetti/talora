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
      <div className="h-2.5 w-2.5 -ml-[5px] shrink-0 rounded-full bg-red-500" />
      <div className="h-[2px] flex-1 bg-red-500" />
    </div>
  );
}
