import { getCalendarClient } from './client';
import { classifyGoogleError } from './errors';
import { config } from '../config';
import { logger } from '../utils/logger';

const DEFAULT_CALENDAR_ID = config.googleCalendarId;

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
  description: string,
  calendarId = DEFAULT_CALENDAR_ID,
  professionalId?: string | null
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
    const availability = await checkSlot(date, durationMinutes, calendarId, professionalId);
    if (!availability.available) {
      return {
        success: false,
        error: availability.error ?? 'Slot not available',
        suggestions: availability.suggestions,
      };
    }
    // Create the event
    return await createEvent(name, date, durationMinutes, description, calendarId, professionalId);
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
  durationMinutes: number,
  calendarId = DEFAULT_CALENDAR_ID,
  professionalId?: string | null
): Promise<{ available: boolean; suggestions?: string[]; error?: string }> {
  try {
    const calendar = await getCalendarClient(professionalId);

    const start = new Date(date);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    // toISOString() already produces UTC strings, so no timeZone hint needed
    const freeBusyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: calendarId }],
      },
    });

    const busySlots = freeBusyResponse.data.calendars?.[calendarId]?.busy || [];
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
        items: [{ id: calendarId }],
      },
    });

    const allBusy = extendedFreeBusy.data.calendars?.[calendarId]?.busy || [];

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
  } catch (err) {
    const info = classifyGoogleError(err);
    logger.error(`checkSlot: Google Calendar error [${info.code}]:`, err);
    return { available: false, error: info.message };
  }
}

export async function createEvent(
  name: string,
  date: string,
  durationMinutes: number,
  description: string,
  calendarId = DEFAULT_CALENDAR_ID,
  professionalId?: string | null
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const calendar = await getCalendarClient(professionalId);

    const start = new Date(date);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const event = await calendar.events.insert({
      calendarId,
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
  } catch (err) {
    const info = classifyGoogleError(err);
    logger.error(`createEvent: Google Calendar error [${info.code}]:`, err);
    return { success: false, error: info.message };
  }
}

export async function deleteEvent(
  eventId: string,
  calendarId = DEFAULT_CALENDAR_ID,
  professionalId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = await getCalendarClient(professionalId);
    await calendar.events.delete({ calendarId, eventId });
    return { success: true };
  } catch (err: unknown) {
    const status = (err as { code?: number }).code;
    if (status === 404) {
      logger.warn(`deleteEvent: event ${eventId} already deleted (404)`);
      return { success: true };
    }
    if (status === 403) {
      logger.error(`deleteEvent: no permission to delete event ${eventId} (403)`);
      return { success: false, error: 'No permission to delete this event' };
    }
    const info = classifyGoogleError(err);
    logger.error(`deleteEvent: Google Calendar error [${info.code}] for event ${eventId}:`, err);
    return { success: false, error: info.message };
  }
}

export async function updateEvent(
  eventId: string,
  date: string,
  durationMinutes: number,
  calendarId = DEFAULT_CALENDAR_ID,
  professionalId?: string | null,
  summary?: string,
  description?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = await getCalendarClient(professionalId);
    const start = new Date(date);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        ...(summary ? { summary } : {}),
        ...(description ? { description } : {}),
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    });
    return { success: true };
  } catch (err) {
    const info = classifyGoogleError(err);
    logger.error(`updateEvent: Google Calendar error [${info.code}] for event ${eventId}:`, err);
    return { success: false, error: info.message };
  }
}

export async function listEvents(
  start: string,
  end: string,
  calendarId = DEFAULT_CALENDAR_ID,
  professionalId?: string | null
): Promise<{ events: Array<{ id: string; summary: string; description: string; starts_at: string; ends_at: string }>; error?: string }> {
  try {
    const calendar = await getCalendarClient(professionalId);
    const result = await calendar.events.list({
      calendarId,
      timeMin: new Date(start).toISOString(),
      timeMax: new Date(end).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (result.data.items ?? [])
      .filter((item) => item.id && item.start?.dateTime && item.end?.dateTime)
      .map((item) => ({
        id: item.id!,
        summary: item.summary ?? '',
        description: item.description ?? '',
        starts_at: item.start!.dateTime!,
        ends_at: item.end!.dateTime!,
      }));

    return { events };
  } catch (err) {
    const info = classifyGoogleError(err);
    logger.error(`listEvents: Google Calendar error [${info.code}]:`, err);
    return { events: [], error: info.message };
  }
}
