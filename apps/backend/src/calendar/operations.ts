import { getCalendarClient } from './client';
import { config } from '../config';

const TIMEZONE = 'America/Argentina/Buenos_Aires';
const CALENDAR_ID = config.googleCalendarId;

// In-memory lock for booking slots to prevent double-booking (single-instance only)
// TODO: Use PostgreSQL advisory locks for multi-instance deployments
const bookingLocks = new Map<string, Promise<unknown>>();

function getSlotKey(date: string, durationMinutes: number): string {
  const start = new Date(date);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return `${start.toISOString()}-${end.toISOString()}`;
}

export async function bookSlot(
  name: string,
  date: string,
  durationMinutes: number,
  description: string
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const slotKey = getSlotKey(date, durationMinutes);

  // Wait for any pending booking on the same slot
  const pending = bookingLocks.get(slotKey) ?? Promise.resolve();

  const booking = pending.then(async () => {
    // Check availability first
    const availability = await checkSlot(date, durationMinutes);
    if (!availability.available) {
      return {
        success: false,
        error: 'Slot not available',
        suggestions: availability.suggestions,
      };
    }
    // Create the event
    return createEvent(name, date, durationMinutes, description);
  });

  const swallowed = booking.catch(() => {});
  bookingLocks.set(slotKey, swallowed);
  try {
    return await booking;
  } finally {
    if (bookingLocks.get(slotKey) === swallowed) {
      bookingLocks.delete(slotKey);
    }
  }
}

export async function checkSlot(
  date: string,
  durationMinutes: number
): Promise<{ available: boolean; suggestions?: string[] }> {
  const calendar = await getCalendarClient();

  const start = new Date(date);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const freeBusyResponse = await calendar.freebusy.query({
    requestBody: {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      timeZone: TIMEZONE,
      items: [{ id: CALENDAR_ID }],
    },
  });

  const busySlots = freeBusyResponse.data.calendars?.[CALENDAR_ID]?.busy || [];
  const isAvailable = busySlots.length === 0;

  if (isAvailable) {
    return { available: true };
  }

  // Find 3 nearby free slots
  const suggestions: string[] = [];
  const searchStart = new Date(start.getTime() - 3 * 60 * 60 * 1000); // 3 hours before
  const searchEnd = new Date(start.getTime() + 6 * 60 * 60 * 1000); // 6 hours after

  const extendedFreeBusy = await calendar.freebusy.query({
    requestBody: {
      timeMin: searchStart.toISOString(),
      timeMax: searchEnd.toISOString(),
      timeZone: TIMEZONE,
      items: [{ id: CALENDAR_ID }],
    },
  });

  const allBusy = extendedFreeBusy.data.calendars?.[CALENDAR_ID]?.busy || [];

  // Check each 30-minute slot
  let candidateTime = new Date(searchStart);
  while (suggestions.length < 3 && candidateTime < searchEnd) {
    const candidateEnd = new Date(candidateTime.getTime() + durationMinutes * 60 * 1000);

    const conflicts = allBusy.some((busy) => {
      const busyStart = new Date(busy.start!);
      const busyEnd = new Date(busy.end!);
      return candidateTime < busyEnd && candidateEnd > busyStart;
    });

    if (!conflicts && candidateTime.getTime() !== start.getTime()) {
      suggestions.push(candidateTime.toISOString());
    }

    candidateTime = new Date(candidateTime.getTime() + 30 * 60 * 1000);
  }

  return { available: false, suggestions };
}

export async function createEvent(
  name: string,
  date: string,
  durationMinutes: number,
  description: string
): Promise<{ success: boolean; eventId?: string }> {
  const calendar = await getCalendarClient();

  const start = new Date(date);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const event = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: name,
      description,
      start: {
        dateTime: start.toISOString(),
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: TIMEZONE,
      },
    },
  });

  return { success: true, eventId: event.data.id || undefined };
}

export async function deleteEvent(
  eventId: string
): Promise<{ success: boolean }> {
  const calendar = await getCalendarClient();

  await calendar.events.delete({
    calendarId: CALENDAR_ID,
    eventId,
  });

  return { success: true };
}
