export const UNASSIGNED_PROFESSIONAL_ID = "__unassigned__";

export const fallbackPalette = [
  "#1F6F78",
  "#9F4D34",
  "#4D6B50",
  "#5E4AE3",
  "#9A6D38",
  "#7A4154",
];

export function startOfWeek(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function formatDayLabel(date: Date) {
  return date.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit" });
}

export function formatWeekdayShort(date: Date) {
  return date.toLocaleDateString("es-AR", { weekday: "short" }).toUpperCase();
}

export function formatDayNumber(date: Date) {
  return date.getDate().toString();
}

export function formatDayMeta(date: Date) {
  return date.toLocaleDateString("es-AR", { month: "short" });
}

export function formatWeekRange(start: Date, end: Date) {
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()}-${end.getDate()} ${start.toLocaleDateString("es-AR", { month: "long" })}`;
  }
  return `${start.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })} - ${end.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}`;
}

export function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function sameDay(left: Date, right: Date) {
  return getDateKey(left) === getDateKey(right);
}

export function normalizeHex(hex: string | null | undefined) {
  if (!hex) return null;
  const trimmed = hex.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getAccentColor(
  professional: { id: string; color_hex: string | null },
  index: number
) {
  return (
    normalizeHex(professional.color_hex) ??
    fallbackPalette[index % fallbackPalette.length]
  );
}

export function getDurationLabel(startsAt: string, endsAt: string) {
  const durationMinutes = Math.max(
    15,
    Math.round(
      (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000
    )
  );
  if (durationMinutes % 60 === 0) {
    return `${durationMinutes / 60}h`;
  }
  return `${durationMinutes} min`;
}

export type CalendarDay = {
  date: Date;
  key: string;
  label: string;
  weekday: string;
  dayNumber: string;
  meta: string;
};

export function buildCalendarDays(weekStart: Date): CalendarDay[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return {
      date,
      key: getDateKey(date),
      label: formatDayLabel(date),
      weekday: formatWeekdayShort(date),
      dayNumber: formatDayNumber(date),
      meta: formatDayMeta(date),
    };
  });
}

export function getTodayIndex(calendarDays: CalendarDay[]): number {
  const todayKey = getDateKey(new Date());
  const index = calendarDays.findIndex((day) => day.key === todayKey);
  return index >= 0 ? index : 0;
}
