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

export function formatTimeRange(startsAt: string, endsAt: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  return `${fmt(startsAt)} – ${fmt(endsAt)}`;
}

export type AppointmentTimeState = "past" | "now" | "future";

export function getAppointmentTimeState(
  startsAt: string,
  endsAt: string
): AppointmentTimeState {
  const now = Date.now();
  const end = new Date(endsAt).getTime();
  if (now > end) return "past";
  const start = new Date(startsAt).getTime();
  if (now >= start && now <= end) return "now";
  return "future";
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

// ── Grid constants ──

export const HOUR_HEIGHT = 64;
export const MIN_BLOCK_HEIGHT = 24;
export const TIME_RAIL_WIDTH = 56;

// ── Grid math ──

export function parseHourString(h: string): number {
  const [hours, minutes] = h.split(":").map(Number);
  return hours * 60 + (minutes ?? 0);
}

export function timeToMinutes(isoString: string): number {
  const d = new Date(isoString);
  return d.getHours() * 60 + d.getMinutes();
}

export function minutesToPx(
  minutes: number,
  openMinutes: number,
  hourHeight: number = HOUR_HEIGHT,
): number {
  return ((minutes - openMinutes) / 60) * hourHeight;
}

export type GridHour = { hour: number; label: string };

export function gridHours(openHour: string, closeHour: string): GridHour[] {
  const openMin = parseHourString(openHour);
  const closeMin = parseHourString(closeHour);
  const hours: GridHour[] = [];
  for (let m = openMin; m < closeMin; m += 60) {
    const h = Math.floor(m / 60);
    hours.push({
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
    });
  }
  return hours;
}

export type OverlapInfo = { column: number; totalColumns: number };

export function getOverlapGroups<T extends { id: string; starts_at: string; ends_at: string }>(
  appointments: T[],
): Map<string, OverlapInfo> {
  if (appointments.length === 0) return new Map();

  const sorted = [...appointments].sort((a, b) => {
    const diff = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    if (diff !== 0) return diff;
    return (
      new Date(b.ends_at).getTime() -
      new Date(b.starts_at).getTime() -
      (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime())
    );
  });

  const result = new Map<string, OverlapInfo>();
  const columnEnds: number[] = [];
  const clusterMembers: string[][] = [];
  let clusterEnd = 0;
  let currentCluster: string[] = [];

  for (const appt of sorted) {
    const start = new Date(appt.starts_at).getTime();
    const end = new Date(appt.ends_at).getTime();

    if (start >= clusterEnd && currentCluster.length > 0) {
      const totalCols = columnEnds.length;
      for (const id of currentCluster) {
        const info = result.get(id)!;
        result.set(id, { ...info, totalColumns: totalCols });
      }
      clusterMembers.push(currentCluster);
      currentCluster = [];
      columnEnds.length = 0;
    }

    let placed = false;
    for (let c = 0; c < columnEnds.length; c++) {
      if (columnEnds[c] <= start) {
        columnEnds[c] = end;
        result.set(appt.id, { column: c, totalColumns: 0 });
        currentCluster.push(appt.id);
        placed = true;
        break;
      }
    }

    if (!placed) {
      const col = columnEnds.length;
      columnEnds.push(end);
      result.set(appt.id, { column: col, totalColumns: 0 });
      currentCluster.push(appt.id);
    }

    clusterEnd = Math.max(clusterEnd, end);
  }

  if (currentCluster.length > 0) {
    const totalCols = columnEnds.length;
    for (const id of currentCluster) {
      const info = result.get(id)!;
      result.set(id, { ...info, totalColumns: totalCols });
    }
  }

  return result;
}

export function formatDayLong(date: Date): string {
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
