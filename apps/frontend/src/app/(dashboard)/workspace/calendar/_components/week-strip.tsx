"use client";

import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import type { CalendarDay } from "./utils";
import { sameDay } from "./utils";

export function WeekStrip({
  days,
  selectedIndex,
  onSelect,
  appointmentCountByDay,
  maxCount,
}: {
  days: CalendarDay[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  appointmentCountByDay: Map<string, number>;
  maxCount: number;
}) {
  const today = new Date();

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-7 gap-2 lg:gap-3"
    >
      {days.map((day, index) => {
        const isSelected = index === selectedIndex;
        const isToday = sameDay(day.date, today);
        const count = appointmentCountByDay.get(day.key) ?? 0;
        const barWidth = maxCount > 0 ? Math.max(8, (count / maxCount) * 100) : 0;

        return (
          <motion.button
            key={day.key}
            type="button"
            variants={staggerItem}
            onClick={() => onSelect(index)}
            className={`
              relative flex flex-col items-start rounded-[20px] border px-3 py-3 text-left transition-colors
              sm:px-4 sm:py-3.5
              ${
                isSelected
                  ? "border-[#1c1d22] bg-[#1c1d22] text-white shadow-[0_8px_24px_rgba(28,29,34,0.18)]"
                  : "border-[#e6e7ec] bg-white hover:border-[#cfd5e0] hover:bg-[#f7f8fc]"
              }
            `}
          >
            <div className="flex w-full items-center gap-1.5">
              <span
                className={`text-[11px] font-medium tracking-[0.14em] ${
                  isSelected ? "text-white/70" : "text-slate-400"
                }`}
              >
                {day.weekday}
              </span>
              {isToday && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isSelected ? "bg-white" : "bg-[#5E4AE3]"
                  }`}
                />
              )}
            </div>

            <span
              className={`mt-1 text-lg font-semibold leading-tight sm:text-xl ${
                isSelected ? "text-white" : "text-slate-900"
              }`}
            >
              {day.dayNumber}
            </span>

            <span
              className={`mt-2 text-xs ${
                isSelected ? "text-white/60" : "text-slate-500"
              }`}
            >
              {count === 0
                ? "Libre"
                : count === 1
                  ? "1 turno"
                  : `${count} turnos`}
            </span>

            {count > 0 && (
              <div
                className={`mt-2 h-1 rounded-full ${
                  isSelected ? "bg-white/20" : "bg-[#e6e7ec]"
                }`}
                style={{ width: "100%" }}
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    isSelected ? "bg-white/50" : "bg-[#5E4AE3]/40"
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            )}
          </motion.button>
        );
      })}
    </motion.div>
  );
}

export function WeekStripMobile({
  days,
  selectedIndex,
  onSelect,
  appointmentCountByDay,
}: {
  days: CalendarDay[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  appointmentCountByDay: Map<string, number>;
}) {
  const today = new Date();

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-none">
      {days.map((day, index) => {
        const isSelected = index === selectedIndex;
        const isToday = sameDay(day.date, today);
        const count = appointmentCountByDay.get(day.key) ?? 0;

        return (
          <button
            key={day.key}
            type="button"
            onClick={() => onSelect(index)}
            className={`
              flex min-w-[80px] snap-start flex-col items-center rounded-[18px] border px-3 py-3 transition-colors
              ${
                isSelected
                  ? "border-[#1c1d22] bg-[#1c1d22] text-white"
                  : "border-[#e6e7ec] bg-white"
              }
            `}
          >
            <span
              className={`text-[10px] font-medium tracking-[0.12em] ${
                isSelected ? "text-white/70" : "text-slate-400"
              }`}
            >
              {day.weekday}
            </span>

            <span
              className={`relative mt-1 text-lg font-semibold ${
                isSelected ? "text-white" : "text-slate-900"
              }`}
            >
              {day.dayNumber}
              {isToday && (
                <span
                  className={`absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                    isSelected ? "bg-white" : "bg-[#5E4AE3]"
                  }`}
                />
              )}
            </span>

            <span
              className={`mt-1.5 text-[10px] ${
                isSelected ? "text-white/60" : "text-slate-500"
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
