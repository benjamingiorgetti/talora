import { getCalendarClient } from './client';
import { config } from '../config';
import { logger } from '../utils/logger';

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
): Promise<{ success: boolean; eventId?: string; error?: string; suggestions?: string[] }> {
  const slotKey = getSlotKey(date, durationMinutes);

  // Wait for any pending booking on the same slot
  const pending = bookingLocks.get(slotKey) ?? Promise.resolve();

  let resolve!: () => void;
  const lockPromise = new Promise<void>((r) => { resolve = r; });
  bookingLocks.set(slotKey, lockPromise);

  try {
    // Wait for any pending booking on the same slot to complete
    await pending;

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
    return await createEvent(name, date, durationMinutes, description);
  } finally {
    // Release the lock so the next queued booking can proceed
    resolve();
    if (bookingLocks.get(slotKey) === lockPromise) {
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

  // toISOString() already produces UTC strings, so no timeZone hint needed
  const freeBusyResponse = await calendar.freebusy.query({
    requestBody: {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
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
      // UTC ISO strings — no timeZone hint needed
      start: {
        dateTime: start.toISOString(),
      },
      end: {
        dateTime: end.toISOString(),
      },
    },
  });

  return { success: true, eventId: event.data.id || undefined };
}

export async function deleteEvent(
  eventId: string
): Promise<{ success: boolean; error?: string }> {
  const calendar = await getCalendarClient();

  try {
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId,
    });
    return { success: true };
  } catch (err: unknown) {
    const status = (err as { code?: number }).code;
    if (status === 404) {
      logger.warn(`deleteEvent: event ${eventId} already deleted (404)`);
      return { success: true }; // Idempotent — already gone
    }
    if (status === 403) {
      logger.error(`deleteEvent: no permission to delete event ${eventId} (403)`);
      return { success: false, error: 'No permission to delete this event' };
    }
    logger.error(`deleteEvent: unexpected error for event ${eventId}:`, err);
    return { success: false, error: 'Failed to delete event' };
  }
}
