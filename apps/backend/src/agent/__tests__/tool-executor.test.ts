import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mock pool.query — must use the specifier as written in the source file's import
const mockQuery = mock(() => Promise.resolve({ rows: [], rowCount: 0 }));

mock.module('../../db/pool', () => ({
  pool: { query: mockQuery },
}));
mock.module('../../calendar/operations', () => ({
  checkSlot: mock(() => Promise.resolve({ available: true })),
  bookSlot: mock(() => Promise.resolve({ success: true, eventId: 'evt-1' })),
  deleteEvent: mock(() => Promise.resolve({ success: true })),
  updateEvent: mock(() => Promise.resolve({ success: true })),
}));
mock.module('../../utils/url-validator', () => ({
  validateWebhookUrl: mock(() => Promise.resolve()),
}));
mock.module('../../utils/logger', () => ({
  logger: { error: mock(), warn: mock(), info: mock(), debug: mock() },
}));

const { executeTool } = await import('../tool-executor');

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const COMPANY_A = 'company-aaa-1111';
const PROF_A = 'prof-aaa-1111';
const PROF_B = 'prof-bbb-2222';
const APPT_ID = 'appt-1111';
const EVENT_ID = 'gcal-evt-1';

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    companyId: COMPANY_A,
    conversationId: 'conv-1',
    phoneNumber: '+5491155550000',
    contactName: 'Test Client',
    professionalId: PROF_A,
    ...overrides,
  };
}

function fakeAppointment(professionalId: string) {
  return {
    id: APPT_ID,
    company_id: COMPANY_A,
    professional_id: professionalId,
    google_event_id: EVENT_ID,
    starts_at: '2026-03-14T10:00:00Z',
    ends_at: '2026-03-14T11:00:00Z',
    status: 'confirmed',
    client_name: 'Test Client',
    title: 'Test',
    notes: '',
  };
}

function fakeProfessional(id: string) {
  return {
    id,
    company_id: COMPANY_A,
    name: 'Professional Test',
    calendar_id: 'cal-1',
    is_active: true,
  };
}

/**
 * Configure mockQuery to return specific results based on SQL pattern matching.
 * Each entry is [sqlSubstring, returnRows].
 */
function setupQueryMock(responses: Array<[string, unknown[]]>) {
  (mockQuery as ReturnType<typeof mock>).mockImplementation((...args: unknown[]) => {
    const sql = typeof args[0] === 'string' ? args[0] : '';
    for (const [pattern, rows] of responses) {
      if (sql.includes(pattern)) {
        return Promise.resolve({ rows, rowCount: rows.length });
      }
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
}

// ──────────────────────────────────────────────────────────
// Gap 2: Guards block unassigned conversations
// ──────────────────────────────────────────────────────────

describe('professional guard: unassigned conversations cannot schedule', () => {
  beforeEach(() => mockQuery.mockReset());

  it('google_calendar_book blocks when professionalId is null, even with scheduling hints', async () => {
    const result = await executeTool(
      'google_calendar_book',
      { date: '2026-03-14T10:00:00Z', professionalId: PROF_A, serviceId: 'svc-1' },
      makeContext({ professionalId: null })
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('No hay profesional asignado');
  });

  it('google_calendar_book blocks when professionalId is undefined', async () => {
    const result = await executeTool(
      'google_calendar_book',
      { date: '2026-03-14T10:00:00Z' },
      makeContext({ professionalId: undefined })
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('No hay profesional asignado');
  });

  it('google_calendar_reprogram blocks when professionalId is null', async () => {
    const result = await executeTool(
      'google_calendar_reprogram',
      { appointmentId: APPT_ID, startsAt: '2026-03-15T10:00:00Z', professionalId: PROF_A },
      makeContext({ professionalId: null })
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('No hay profesional asignado');
  });

  it('google_calendar_cancel blocks when professionalId is null', async () => {
    const result = await executeTool(
      'google_calendar_cancel',
      { appointmentId: APPT_ID, professionalId: PROF_A },
      makeContext({ professionalId: null })
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('No hay profesional asignado');
  });
});

// ──────────────────────────────────────────────────────────
// Gap 1: Appointment resolution filters by professional
// ──────────────────────────────────────────────────────────

describe('reprogram: professional ownership on appointment lookup', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns "not found" when appointment belongs to a different professional', async () => {
    // The appointment exists but belongs to PROF_B, and context has PROF_A.
    // With the professional_id filter, the query returns 0 rows.
    setupQueryMock([
      // resolveAppointmentByReference: no match because professional_id doesn't match
      ['FROM appointments WHERE', []],
    ]);

    const result = await executeTool(
      'google_calendar_reprogram',
      { appointmentId: APPT_ID, startsAt: '2026-03-15T10:00:00Z' },
      makeContext({ professionalId: PROF_A })
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe('Appointment not found');
  });

  it('proceeds when appointment belongs to the same professional', async () => {
    const appt = fakeAppointment(PROF_A);
    const prof = fakeProfessional(PROF_A);

    setupQueryMock([
      ['FROM appointments WHERE', [appt]],
      ['FROM professionals WHERE', [prof]],
      ['FROM services WHERE', []],
    ]);

    // This will proceed past the appointment lookup but may fail later
    // in scheduling resolution — that's fine, we're testing the lookup filter
    const result = await executeTool(
      'google_calendar_reprogram',
      { appointmentId: APPT_ID, startsAt: '2026-03-15T10:00:00Z' },
      makeContext({ professionalId: PROF_A })
    );
    const parsed = JSON.parse(result);
    // Should NOT be "Appointment not found"
    expect(parsed.error).not.toBe('Appointment not found');
  });
});

describe('cancel: professional ownership on appointment lookup', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns "not found" when appointment belongs to a different professional', async () => {
    setupQueryMock([
      ['FROM appointments WHERE', []],
    ]);

    const result = await executeTool(
      'google_calendar_cancel',
      { appointmentId: APPT_ID },
      makeContext({ professionalId: PROF_A })
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toBe('Appointment not found');
  });

  it('proceeds when appointment belongs to the same professional', async () => {
    const appt = fakeAppointment(PROF_A);
    const prof = fakeProfessional(PROF_A);

    setupQueryMock([
      ['FROM appointments WHERE', [appt]],
      ['FROM professionals WHERE', [prof]],
    ]);

    const result = await executeTool(
      'google_calendar_cancel',
      { appointmentId: APPT_ID },
      makeContext({ professionalId: PROF_A })
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).not.toBe('Appointment not found');
  });
});

// ──────────────────────────────────────────────────────────
// Verify SQL includes professional_id filter
// ──────────────────────────────────────────────────────────

describe('resolveAppointmentByReference: SQL contains professional_id filter', () => {
  beforeEach(() => mockQuery.mockReset());

  it('includes professional_id in SQL when professionalId is provided', async () => {
    setupQueryMock([['FROM appointments WHERE', []]]);

    await executeTool(
      'google_calendar_cancel',
      { appointmentId: APPT_ID },
      makeContext({ professionalId: PROF_A })
    );

    // Find the call that queries appointments
    const calls = mockQuery.mock.calls as unknown[][];
    const appointmentCall = calls.find(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('FROM appointments WHERE')
    );
    expect(appointmentCall).toBeDefined();
    const sql = appointmentCall![0] as string;
    expect(sql).toContain('professional_id');
    const params = appointmentCall![1] as unknown[];
    expect(params).toContain(PROF_A);
  });
});
