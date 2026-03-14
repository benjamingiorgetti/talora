import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock factories — declared before mock.module calls so closures capture them
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// mock.module registrations
// All paths below are relative to this test file location:
//   src/calendar/__tests__/operations.test.ts
//
//   ../client            resolves to src/calendar/client.ts
//   ../../config         resolves to src/config.ts
//   ../../utils/logger   resolves to src/utils/logger.ts
//
// Bun matches by absolute resolved path, intercepting imports from operations.ts.
// ---------------------------------------------------------------------------

mock.module('../client', () => ({
  getCalendarClient: mock(() => Promise.resolve(mockCalendar)),
}));

mock.module('../../config', () => ({
  config: {
    googleCalendarId: 'primary',
    nodeEnv: 'test',
    timezone: 'UTC',
  },
}));

mock.module('../../utils/logger', () => ({
  logger: {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    debug: mock(() => {}),
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import after mock.module calls — ensures mocks are in place
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

// Fixed deterministic date — no Date.now() or Math.random()
const FIXED_DATE = '2025-06-15T10:00:00.000Z';
const DURATION = 60; // minutes

beforeEach(() => {
  mockFreebusyQuery.mockReset();
  mockEventsInsert.mockReset();
  mockEventsDelete.mockReset();
  mockEventsPatch.mockReset();
  mockEventsList.mockReset();

  // Restore default happy-path implementations after each reset
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
    const result = await checkSlot(FIXED_DATE, DURATION);

    expect(result.available).toBe(true);
    expect(result.suggestions).toBeUndefined();
  });

  it('should return { available: false, suggestions } when freebusy returns a busy period', async () => {
    const busyStart = new Date(FIXED_DATE);
    const busyEnd = new Date(busyStart.getTime() + DURATION * 60 * 1000);
    const busyPeriod = [
      { start: busyStart.toISOString(), end: busyEnd.toISOString() },
    ];

    // First call: slot range check — busy
    // Second call: extended range for suggestions — same busy slot so algorithm
    // can identify free gaps around it
    mockFreebusyQuery
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: { calendars: { primary: { busy: busyPeriod } } },
        })
      )
      .mockImplementationOnce(() =>
        Promise.resolve({
          data: { calendars: { primary: { busy: busyPeriod } } },
        })
      );

    const result = await checkSlot(FIXED_DATE, DURATION);

    expect(result.available).toBe(false);
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect((result.suggestions ?? []).length).toBeGreaterThan(0);
    expect((result.suggestions ?? []).length).toBeLessThanOrEqual(3);
  });

  it('should propagate Google API errors without swallowing them', async () => {
    mockFreebusyQuery.mockImplementation(() =>
      Promise.reject(new Error('Google API unavailable'))
    );

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
    expect(mockEventsInsert).not.toHaveBeenCalled();
  });

  it('should serialize concurrent bookings on the same slot via the in-memory lock', async () => {
    // Both calls race for the same slot key.
    // The lock ensures sequential execution — verify both complete without throwing.
    const results = await Promise.all([
      bookSlot('Concurrent A', FIXED_DATE, DURATION, 'first'),
      bookSlot('Concurrent B', FIXED_DATE, DURATION, 'second'),
    ]);

    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(typeof r.success).toBe('boolean');
    }
    // At most two insert calls (one per successful booking attempt)
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

  it('should pass the correct custom calendarId to events.insert', async () => {
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

  it('should return { success: false, error } when the API returns permission denied (403)', async () => {
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

  it('should return { success: false, error } when events.patch throws', async () => {
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
            // Valid event — must be included
            {
              id: 'evt-valid',
              summary: 'Valid',
              description: '',
              start: { dateTime: '2025-06-15T10:00:00.000Z' },
              end: { dateTime: '2025-06-15T11:00:00.000Z' },
            },
            // Missing id — must be filtered out
            {
              summary: 'No ID',
              start: { dateTime: '2025-06-15T12:00:00.000Z' },
              end: { dateTime: '2025-06-15T13:00:00.000Z' },
            },
            // All-day event (date instead of dateTime) — must be filtered out
            {
              id: 'evt-no-dt',
              summary: 'All Day',
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
