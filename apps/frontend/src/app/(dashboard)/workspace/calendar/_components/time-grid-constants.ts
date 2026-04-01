export const HOUR_HEIGHT = 64;
export const HOUR_HEIGHT_MOBILE = 48;
export const MINUTE_HEIGHT = HOUR_HEIGHT / 60;
export const MINUTE_HEIGHT_MOBILE = HOUR_HEIGHT_MOBILE / 60;
export const DEFAULT_BUSINESS_START = 8;
export const DEFAULT_BUSINESS_END = 21;
export const MIN_BLOCK_HEIGHT = 20;

export function getTopOffset(
  startsAt: string,
  businessStart: number
): number {
  const date = new Date(startsAt);
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = (hour - businessStart) * 60 + minutes;
  return Math.max(0, totalMinutes * MINUTE_HEIGHT);
}

export function getBlockHeight(startsAt: string, endsAt: string): number {
  const durationMs =
    new Date(endsAt).getTime() - new Date(startsAt).getTime();
  const durationMinutes = Math.max(15, durationMs / 60_000);
  return Math.max(MIN_BLOCK_HEIGHT, durationMinutes * MINUTE_HEIGHT);
}

export function getTopOffsetMobile(
  startsAt: string,
  businessStart: number
): number {
  const date = new Date(startsAt);
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = (hour - businessStart) * 60 + minutes;
  return Math.max(0, totalMinutes * MINUTE_HEIGHT_MOBILE);
}

export function getBlockHeightMobile(
  startsAt: string,
  endsAt: string
): number {
  const durationMs =
    new Date(endsAt).getTime() - new Date(startsAt).getTime();
  const durationMinutes = Math.max(15, durationMs / 60_000);
  return Math.max(MIN_BLOCK_HEIGHT, durationMinutes * MINUTE_HEIGHT_MOBILE);
}

export function generateHourSlots(
  businessStart: number,
  businessEnd: number
): { hour: number; label: string }[] {
  const slots: { hour: number; label: string }[] = [];
  for (let h = businessStart; h <= businessEnd; h++) {
    slots.push({
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
    });
  }
  return slots;
}

export function getCurrentTimeOffset(
  businessStart: number,
  businessEnd: number
): number | null {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  if (hour < businessStart || hour >= businessEnd) return null;
  const totalMinutes = (hour - businessStart) * 60 + minutes;
  return totalMinutes * MINUTE_HEIGHT;
}

export function getGridHeight(
  businessStart: number,
  businessEnd: number
): number {
  return (businessEnd - businessStart) * HOUR_HEIGHT;
}
