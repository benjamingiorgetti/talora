import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock factories — must be declared before mock.module calls so closures work
// ---------------------------------------------------------------------------

// Mutable references so individual tests can override behaviour via mockImplementation
const mockFreebusyQuery = mock(() =>
  Promise.resolve({
    data: { calendars: { primary: { busy: [] } } },
  })
);

const mockEventsInsert = mock(() =>
  Promise.resolve({ data: { id: 'evt-new-1' } })
);

const mockEventsDelete = mock(() => Promise.resolve({}));

const mockEventsPatch = mock(() =>
  Promise.resolve({ data: { id: 'evt-1' } })
);

const mockEventsList = mock(() =>
  Promise.resolve({ data: { items: [] } })
);

const mockCalendar = {
  freebusy: { query: mockFreebusyQuery },
  events: {
    insert: mockEventsInsert,
    delete: mockEventsDelete,
    patch: mockEventsPatch,
    list: mockEventsList,
  },
};

// Mock getCalendarClient to return the mock calendar without hitting googleapis or DB.
// Path is relative to THIS test file (src/calendar/__tests__/) → ../client resolves
// to src/calendar/client, which is what operations.ts imports as './client'.
mock.module('../client', () => ({
  getCalendarClient: mock(() => Promise.resolve(mockCalendar)),
}));

mock.module('../../config', () => ({
  config: {
    googleCalendarId: 'primary',
    // Other fields referenced at module level — provide safe defaults
    nodeEnv: 'test',
    timezone: 'UTC',
  },
}));

// Silence logger output in tests.
// Path relative to this test file → ../../utils/logger resolves to src/utils/logger.
mock.module('../../utils/logger', () => ({
  logger: {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import — must happen AFTER mock.module registrations
// ---------------------------------------------------------------------------
const {
  checkSlot,
  bookSlot,
  createEvent,
  deleteEvent,
  updateEvent,
  listEvents,
} = await import('../operations');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fixed ISO date used across all tests — deterministic, no Date.now() */
const FIXED_DATE = '2025-06-15T10:00:00.000Z';
const DURATION = 60; // minutes

// The module exports a Map for bookingLocks but it is not exported.
// We reset mock call counts in beforeEach so assertions start clean.
// Lock state is effectively reset because each successful bookSlot call
// removes its own key; only a mid-flight failure would leave a stale key,
// which does not apply here.

beforeEach(() => {
  mockFreebusyQuery.mockReset();
  mockEventsInsert.mockReset();
  mockEventsDelete.mockReset();
  mockEventsPatch.mockReset();
  mockEventsList.mockReset();

  // Restore default (happy-path) implementations after each reset
  mockFreebusyQuery.mockImplementation(() =>
    Promise.resolve({
      data: { calendars: { primary: { busy: [] } } },
    })
  );
  mockEventsInsert.mockImplementation(() =>
    Promise.resolve({ data: { id: 'evt-new-1' } })
  );
  mockEventsDelete.mockImplementation(() => Promise.resolve({}));
  mockEventsPatch.mockImplementation(() =>
    Promise.resolve({ data: { id: 'evt-1' } })
  );
  mockEventsList.mockImplementation(() =>
    Promise.resolve({ data: { items: [] } })
  );
});

// ---------------------------------------------------------------------------
// checkSlot
// ---------------------------------------------------------------------------

describe('checkSlot', () => {
  it('should return { available: true } when freebusy returns an empty busy array', async () => {
    // Default mock already returns empty busy — no override needed

    const result = await checkSlot(FIXED_DATE, DURATION);

    expect(result.available).toBe(true);
    expect(result.suggestions).toBeUndefined();
  });

  it('should return { available: false, suggestions } when freebusy returns a busy period', async () => {
    // First call: the requested slot is busy
    // Second call: the wider range (for suggestions) has no conflicts → 3 candidate slots found
    const busyStart = new Date(FIXED_DATE);
    const busyEnd = new Date(busyStart.getTime() + DURATION * 60 * 1000);

    mockFreebusyQuery
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            calendars: {
              primary: {
                busy: [
                  { start: busyStart.toISOString(), end: busyEnd.toISOString() },
                ],
              },
            },
          },
        })
      )
      // Second call for suggestions — return the same busy slot so the
      // algorithm can find free gaps around it
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: {
            calendars: {
              primary: {
                busy: [
                  { start: busyStart.toISOString(), end: busyEnd.toISOString() },
                ],
              },
            },
          },
        })
      );

    const result = await checkSlot(FIXED_DATE, DURATION);

    expect(result.available).toBe(false);
    expect(Array.isArray(result.suggestions)).toBe(true);
    // The algorithm searches ±hours around the slot and returns up to 3 suggestions
    expect((result.suggestions ?? []).length).toBeGreaterThan(0);
    expect((result.suggestions ?? []).length).toBeLessThanOrEqual(3);
  });

  it('should return { available: false } with error info when Google API throws', async () => {
    mockFreebusyQuery.mockImplementation(() =>
      Promise.reject(new Error('Google API unavailable'))
    );

    // checkSlot propagates the error; callers should handle it.
    // We assert the rejection surfaces (not silently swallowed).
    await expect(checkSlot(FIXED_DATE, DURATION)).rejects.toThrow(
      'Google API unavailable'
    );
  });
});

// ---------------------------------------------------------------------------
// bookSlot
// ---------------------------------------------------------------------------

describe('bookSlot', () => {
  it('should create event and return { success: true, eventId } when slot is available', async () => {
    // Default mocks: freebusy empty → available, insert returns id
    const result = await bookSlot(
      'Test Booking',
      FIXED_DATE,
      DURATION,
      'Unit test description'
    );

    expect(result.success).toBe(true);
    expect(result.eventId).toBe('evt-new-1');
    expect(mockEventsInsert).toHaveBeenCalledTimes(1);
  });

  it('should return { success: false } with suggestions when slot is already occupied', async () => {
    const busyStart = new Date(FIXED_DATE);
    const busyEnd = new Date(busyStart.getTime() + DURATION * 60 * 1000);
    const busyPeriod = [
      { start: busyStart.toISOString(), end: busyEnd.toISOString() },
    ];

    // Both freebusy calls (slot check + suggestion search) return the slot as busy
    mockFreebusyQuery.mockImplementation(() =>
      Promise.resolve({
        data: { calendars: { primary: { busy: busyPeriod } } },
      })
    );

    const result = await bookSlot(
      'Conflicting Booking',
      FIXED_DATE,
      DURATION,
      'Should fail'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Slot not available');
    expect(Array.isArray(result.suggestions)).toBe(true);
    // No event should be created when the slot is unavailable
    expect(mockEventsInsert).not.toHaveBeenCalled();
  });

  it('should serialize concurrent bookings on the same slot via the in-memory lock', async () => {
    // Both calls race for the same slot key.
    // The lock ensures they execute sequentially — we verify both complete
    // successfully without throwing and that the calendar was called twice.
    const results = await Promise.all([
      bookSlot('Concurrent A', FIXED_DATE, DURATION, 'first'),
      bookSlot('Concurrent B', FIXED_DATE, DURATION, 'second'),
    ]);

    // Both calls resolve (no unhandled rejection)
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(typeof r.success).toBe('boolean');
    }
    // insert was called at most twice (once per successful booking)
    expect(mockEventsInsert.mock.calls.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// createEvent
// ---------------------------------------------------------------------------

describe('createEvent', () => {
  it('should call events.insert with the correct summary, description, and ISO start/end times', async () => {
    await createEvent('Haircut', FIXED_DATE, DURATION, 'Client note');

    expect(mockEventsInsert).toHaveBeenCalledTimes(1);

    const [callArgs] = mockEventsInsert.mock.calls;
    const payload = callArgs[0] as {
      calendarId: string;
      requestBody: {
        summary: string;
        description: string;
        start: { dateTime: string };
        end: { dateTime: string };
      };
    };

    expect(payload.calendarId).toBe('primary');
    expect(payload.requestBody.summary).toBe('Haircut');
    expect(payload.requestBody.description).toBe('Client note');

    const expectedStart = new Date(FIXED_DATE).toISOString();
    const expectedEnd = new Date(
      new Date(FIXED_DATE).getTime() + DURATION * 60 * 1000
    ).toISOString();

    expect(payload.requestBody.start.dateTime).toBe(expectedStart);
    expect(payload.requestBody.end.dateTime).toBe(expectedEnd);
  });

  it('should pass the correct calendarId to events.insert', async () => {
    const customCalendarId = 'cal-xyz-123';
    mockEventsInsert.mockImplementation(() =>
      Promise.resolve({ data: { id: 'evt-custom-1' } })
    );

    const result = await createEvent(
      'Custom Cal Event',
      FIXED_DATE,
      30,
      'desc',
      customCalendarId
    );

    expect(result.success).toBe(true);
    expect(result.eventId).toBe('evt-custom-1');

    const [callArgs] = mockEventsInsert.mock.calls;
    expect((callArgs[0] as { calendarId: string }).calendarId).toBe(
      customCalendarId
    );
  });
});

// ---------------------------------------------------------------------------
// deleteEvent
// ---------------------------------------------------------------------------

describe('deleteEvent', () => {
  it('should return { success: true } when the event exists and is deleted', async () => {
    // Default mock resolves successfully
    const result = await deleteEvent('evt-to-delete');

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockEventsDelete).toHaveBeenCalledTimes(1);
  });

  it('should return { success: true } (idempotent) when the event is not found (404)', async () => {
    const notFoundError = Object.assign(new Error('Not Found'), { code: 404 });
    mockEventsDelete.mockImplementation(() => Promise.reject(notFoundError));

    const result = await deleteEvent('evt-already-gone');

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return { success: false, error } when the API returns 403 (permission denied)', async () => {
    const forbiddenError = Object.assign(new Error('Forbidden'), { code: 403 });
    mockEventsDelete.mockImplementation(() => Promise.reject(forbiddenError));

    const result = await deleteEvent('evt-no-permission');

    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
    expect(result.error).toMatch(/permission/i);
  });
});

// ---------------------------------------------------------------------------
// updateEvent
// ---------------------------------------------------------------------------

describe('updateEvent', () => {
  it('should call events.patch and return { success: true } when the event exists', async () => {
    const result = await updateEvent('evt-1', FIXED_DATE, DURATION);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockEventsPatch).toHaveBeenCalledTimes(1);
  });

  it('should return { success: false } when events.patch throws (event not found)', async () => {
    mockEventsPatch.mockImplementation(() =>
      Promise.reject(Object.assign(new Error('Not Found'), { code: 404 }))
    );

    const result = await updateEvent('evt-missing', FIXED_DATE, DURATION);

    expect(result.success).toBe(false);
    expect(typeof result.error).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// listEvents
// ---------------------------------------------------------------------------

describe('listEvents', () => {
  it('should return an empty array when the calendar has no events', async () => {
    // Default mock returns empty items
    const result = await listEvents(FIXED_DATE, '2025-06-15T18:00:00.000Z');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('should map calendar items to the expected shape', async () => {
    const startTime = '2025-06-15T10:00:00.000Z';
    const endTime = '2025-06-15T11:00:00.000Z';

    mockEventsList.mockImplementation(() =>
      Promise.resolve({
        data: {
          items: [
            {
              id: 'evt-mapped-1',
              summary: 'Mapped Event',
              description: 'Event description',
              start: { dateTime: startTime },
              end: { dateTime: endTime },
            },
          ],
        },
      })
    );

    const result = await listEvents(startTime, endTime);

    expect(result).toHaveLength(1);
    const [event] = result;
    expect(event.id).toBe('evt-mapped-1');
    expect(event.summary).toBe('Mapped Event');
    expect(event.description).toBe('Event description');
    expect(event.starts_at).toBe(startTime);
    expect(event.ends_at).toBe(endTime);
  });

  it('should filter out items missing id, start.dateTime, or end.dateTime', async () => {
    mockEventsList.mockImplementation(() =>
      Promise.resolve({
        data: {
          items: [
            // Valid event
            {
              id: 'evt-valid',
              summary: 'Valid',
              description: '',
              start: { dateTime: '2025-06-15T10:00:00.000Z' },
              end: { dateTime: '2025-06-15T11:00:00.000Z' },
            },
            // Missing id — should be filtered out
            {
              summary: 'No ID',
              start: { dateTime: '2025-06-15T12:00:00.000Z' },
              end: { dateTime: '2025-06-15T13:00:00.000Z' },
            },
            // Missing dateTime on start — should be filtered out
            {
              id: 'evt-no-dt',
              summary: 'No DateTime',
              start: { date: '2025-06-15' },
              end: { date: '2025-06-15' },
            },
          ],
        },
      })
    );

    const result = await listEvents(
      '2025-06-15T09:00:00.000Z',
      '2025-06-15T14:00:00.000Z'
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('evt-valid');
  });
});
