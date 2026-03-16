import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mock pool.query — must use the specifier as written in the source file's import
const mockQuery = mock(() => Promise.resolve({ rows: [], rowCount: 0 }));

mock.module('../../db/pool', () => ({
  pool: { query: mockQuery },
}));
mock.module('../../calendar/operations', () => ({
  checkSlot: mock(() => Promise.resolve({ available: true })),
  bookSlot: mock(() => Promise.resolve({ success: true, eventId: 'evt-1' })),
  createEvent: mock(() => Promise.resolve({ success: true, eventId: 'evt-2' })),
  deleteEvent: mock(() => Promise.resolve({ success: true })),
  updateEvent: mock(() => Promise.resolve({ success: true })),
  listEvents: mock(() => Promise.resolve({ events: [] })),
}));
mock.module('../../utils/url-validator', () => ({
  validateWebhookUrl: mock(() => Promise.resolve()),
}));
mock.module('../../utils/logger', () => ({
  logger: { error: mock(), warn: mock(), info: mock(), debug: mock() },
}));
mock.module('../../evolution/client', () => ({
  EvolutionClient: mock(() => ({ sendText: mock(() => Promise.resolve()) })),
}));

const { executeTool } = await import('../tool-executor');

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const COMPANY_A = 'aaaaaaaa-0000-1000-8000-000000000001';
const PROF_A = 'aaaaaaaa-0000-1000-8000-000000000002';
const PROF_B = 'bbbbbbbb-0000-1000-8000-000000000003';
const APPT_ID = 'aaaaaaaa-0000-1000-8000-000000000004';
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
// Gap 2: Unassigned conversations attempt resolution (no early guard)
// ──────────────────────────────────────────────────────────

describe('professional resolution: unassigned conversations attempt resolution, not early block', () => {
  beforeEach(() => mockQuery.mockReset());

  it('google_calendar_book returns resolution error (not early guard message) when no professionals exist', async () => {
    setupQueryMock([
      ['FROM professionals', []],
    ]);

    const result = await executeTool(
      'google_calendar_book',
      { date: '2026-03-14T10:00:00Z', professionalId: PROF_A, serviceId: 'svc-1' },
      makeContext({ professionalId: null })
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeDefined();
    expect(parsed.error).not.toBe('No hay profesional asignado a esta conversación. No se pueden gestionar turnos automáticamente. Contactar al administrador para asignar un profesional.');
    // technical_detail is logged server-side, not exposed to the agent
    expect(parsed.technical_detail).toBeUndefined();
  });

  it('google_calendar_book returns resolution error when professionalId is undefined and no professionals exist', async () => {
    setupQueryMock([
      ['FROM professionals', []],
    ]);

    const result = await executeTool(
      'google_calendar_book',
      { date: '2026-03-14T10:00:00Z' },
      makeContext({ professionalId: undefined })
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeDefined();
    expect(parsed.error).not.toBe('No hay profesional asignado a esta conversación. No se pueden gestionar turnos automáticamente. Contactar al administrador para asignar un profesional.');
  });

  it('google_calendar_reprogram returns resolution error (not early guard message) when no professionals exist', async () => {
    setupQueryMock([
      ['FROM professionals', []],
    ]);

    const result = await executeTool(
      'google_calendar_reprogram',
      { appointmentId: APPT_ID, startsAt: '2026-03-15T10:00:00Z', professionalId: PROF_A },
      makeContext({ professionalId: null })
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeDefined();
    expect(parsed.error).not.toBe('No hay profesional asignado a esta conversación. No se pueden gestionar turnos automáticamente. Contactar al administrador para asignar un profesional.');
    expect(parsed.technical_detail).toBeUndefined();
  });

  it('google_calendar_cancel skips professional resolution — looks up appointment directly', async () => {
    const appt = fakeAppointment(PROF_A);
    const prof = fakeProfessional(PROF_A);

    setupQueryMock([
      ['FROM appointments WHERE', [appt]],
      ['FROM professionals WHERE id =', [prof]],
      ['UPDATE appointments', []],
    ]);

    const result = await executeTool(
      'google_calendar_cancel',
      { appointmentId: APPT_ID },
      makeContext({ professionalId: null })
    );
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.appointmentId).toBe(APPT_ID);
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
    const prof = fakeProfessional(PROF_A);
    const corteService = {
      id: 'svc-corte',
      company_id: COMPANY_A,
      name: 'Corte',
      duration_minutes: 30,
      professional_id: PROF_A,
      is_active: true,
      aliases: [],
    };

    setupQueryMock([
      ['FROM professionals WHERE id =', [prof]],
      ['FROM services', [corteService]],
      ['UPDATE conversations SET professional_id', []],
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
      ['FROM professionals WHERE id =', [prof]],
      ['FROM services', []],
      ['UPDATE conversations SET professional_id', []],
      ['FROM appointments WHERE', [appt]],
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

describe('cancel: appointment-based lookup (no professional resolution)', () => {
  beforeEach(() => mockQuery.mockReset());

  it('cancels appointment by ID without needing service or professional hints', async () => {
    const appt = fakeAppointment(PROF_A);
    const prof = fakeProfessional(PROF_A);

    setupQueryMock([
      ['FROM appointments WHERE', [appt]],
      ['FROM professionals WHERE id =', [prof]],
      ['UPDATE appointments', []],
    ]);

    const result = await executeTool(
      'google_calendar_cancel',
      { appointmentId: APPT_ID },
      makeContext({ professionalId: null })
    );
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
    expect(parsed.appointmentId).toBe(APPT_ID);
  });

  it('cancels appointment belonging to any professional in the company', async () => {
    // Appointment belongs to PROF_B, context has PROF_A — should still cancel
    const appt = fakeAppointment(PROF_B);
    const prof = fakeProfessional(PROF_B);

    setupQueryMock([
      ['FROM appointments WHERE', [appt]],
      ['FROM professionals WHERE id =', [prof]],
      ['UPDATE appointments', []],
    ]);

    const result = await executeTool(
      'google_calendar_cancel',
      { appointmentId: APPT_ID },
      makeContext({ professionalId: PROF_A })
    );
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });

  it('returns error when appointment not found and no eventId', async () => {
    setupQueryMock([
      ['FROM appointments WHERE', []],
    ]);

    const result = await executeTool(
      'google_calendar_cancel',
      { appointmentId: 'aaaaaaaa-0000-0000-0000-nonexistent1' },
      makeContext()
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toContain('No se encontró el turno');
  });

  it('falls back to deleteEvent with raw eventId when appointment not found', async () => {
    setupQueryMock([
      ['FROM appointments WHERE', []],
    ]);

    const result = await executeTool(
      'google_calendar_cancel',
      { eventId: 'gcal-orphan-event' },
      makeContext()
    );
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });

  it('succeeds with primary calendar when professional is deactivated', async () => {
    const appt = fakeAppointment(PROF_A);

    setupQueryMock([
      ['FROM appointments WHERE', [appt]],
      // getProfessional returns null — professional was deactivated
      ['FROM professionals WHERE id =', []],
      ['UPDATE appointments', []],
    ]);

    const result = await executeTool(
      'google_calendar_cancel',
      { appointmentId: APPT_ID },
      makeContext({ professionalId: null })
    );
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────
// Verify SQL includes professional_id filter
// ──────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────
// google_calendar_check: null calendar_id handling
// ──────────────────────────────────────────────────────────

describe('google_calendar_check: professional with no calendar configured', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns actionable error when professional has null calendar_id', async () => {
    const juliProf = {
      id: PROF_A,
      company_id: COMPANY_A,
      name: 'Juli',
      calendar_id: null,
      is_active: true,
    };
    const corteService = {
      id: 'svc-corte',
      company_id: COMPANY_A,
      name: 'Corte',
      duration_minutes: 20,
      professional_id: PROF_A,
      is_active: true,
    };

    setupQueryMock([
      ['FROM professionals', [juliProf]],
      ['FROM services', [corteService]],
    ]);

    const result = await executeTool(
      'google_calendar_check',
      {
        date: '2026-03-14T15:00:00',
        professionalName: 'Juli',
        serviceName: 'corte',
        durationMinutes: 20,
      },
      makeContext({ professionalId: null })
    );
    const parsed = JSON.parse(result);

    // Should return a clear, actionable error — not a generic "Tool execution failed"
    expect(parsed.error).toBeDefined();
    expect(parsed.error).not.toContain('Tool execution failed');
    expect(parsed.error).toContain('calendario');
    expect(parsed.technical_detail).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────
// Professional resolution: tools resolve from hints when contextProfessionalId is null
// ──────────────────────────────────────────────────────────

describe('professional resolution: tools resolve from hints when contextProfessionalId is null', () => {
  beforeEach(() => mockQuery.mockReset());

  it('google_calendar_book resolves professional from professionalName hint', async () => {
    const juliProf = fakeProfessional(PROF_A);
    juliProf.name = 'Juli';
    const corteService = {
      id: 'svc-corte',
      company_id: COMPANY_A,
      name: 'Corte',
      duration_minutes: 20,
      professional_id: PROF_A,
      is_active: true,
      aliases: [],
      price: 0,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };

    setupQueryMock([
      ['FROM professionals', [juliProf]],
      ['FROM services', [corteService]],
      ['UPDATE conversations SET professional_id', []],
      ['INSERT INTO appointments', [{ id: 'appt-new' }]],
      ['FROM agents WHERE', [{ id: 'agent-1' }]],
      ['INSERT INTO clients', [{ id: 'client-1' }]],
    ]);

    const result = await executeTool(
      'google_calendar_book',
      {
        date: '2026-03-16T15:00:00Z',
        name: 'Benjamin',
        professionalName: 'Juli',
        serviceName: 'corte',
        durationMinutes: 20,
      },
      makeContext({ professionalId: null })
    );
    const parsed = JSON.parse(result);
    // Should succeed, NOT return "No hay profesional asignado"
    expect(parsed.error).toBeUndefined();
    expect(parsed.success).toBe(true);
  });

  it('google_calendar_book returns structured error with technical_detail when hint does not match', async () => {
    setupQueryMock([
      ['FROM professionals', [fakeProfessional(PROF_A)]],
    ]);

    const result = await executeTool(
      'google_calendar_book',
      {
        date: '2026-03-16T15:00:00Z',
        professionalName: 'Zzzzzz',
      },
      makeContext({ professionalId: null })
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).toBeDefined();
    expect(parsed.error).not.toContain('No hay profesional asignado a esta conversación');
    // technical_detail is logged server-side, not exposed to the agent
    expect(parsed.technical_detail).toBeUndefined();
  });

  it('google_calendar_reprogram resolves professional from hint and filters appointment', async () => {
    const juliProf = fakeProfessional(PROF_A);
    juliProf.name = 'Juli';
    const appt = fakeAppointment(PROF_A);

    setupQueryMock([
      ['FROM professionals', [juliProf]],
      ['FROM services', []],
      ['UPDATE conversations SET professional_id', []],
      ['FROM appointments WHERE', [appt]],
    ]);

    const result = await executeTool(
      'google_calendar_reprogram',
      {
        appointmentId: APPT_ID,
        startsAt: '2026-03-17T10:00:00Z',
        professionalName: 'Juli',
      },
      makeContext({ professionalId: null })
    );
    const parsed = JSON.parse(result);
    expect(parsed.error).not.toBe('No hay profesional asignado a esta conversación. No se pueden gestionar turnos automáticamente. Contactar al administrador para asignar un profesional.');
  });

  it('google_calendar_cancel does not need professional hints — resolves from appointment', async () => {
    const juliProf = fakeProfessional(PROF_A);
    juliProf.name = 'Juli';
    const appt = fakeAppointment(PROF_A);

    setupQueryMock([
      ['FROM appointments WHERE', [appt]],
      ['FROM professionals WHERE id =', [juliProf]],
      ['UPDATE appointments', []],
    ]);

    const result = await executeTool(
      'google_calendar_cancel',
      { appointmentId: APPT_ID },
      makeContext({ professionalId: null })
    );
    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────
// Timezone: starts_at must be normalized to ISO UTC before INSERT
// ──────────────────────────────────────────────────────────

describe('timezone: starts_at normalization', () => {
  beforeEach(() => mockQuery.mockReset());

  it('google_calendar_book normalizes timezone-naive date to UTC ISO for starts_at', async () => {
    const juliProf = fakeProfessional(PROF_A);
    juliProf.name = 'Juli';
    const corteService = {
      id: 'svc-corte',
      company_id: COMPANY_A,
      name: 'Corte',
      duration_minutes: 20,
      professional_id: PROF_A,
      is_active: true,
      aliases: [],
      price: 0,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };

    setupQueryMock([
      ['FROM professionals', [juliProf]],
      ['FROM services', [corteService]],
      ['UPDATE conversations SET professional_id', []],
      ['INSERT INTO appointments', [{ id: 'appt-new' }]],
      ['FROM agents WHERE', [{ id: 'agent-1' }]],
      ['INSERT INTO clients', [{ id: 'client-1' }]],
    ]);

    await executeTool(
      'google_calendar_book',
      {
        date: '2026-03-16T15:00:00',  // No Z suffix — timezone-naive
        name: 'Benjamin',
        professionalName: 'Juli',
        serviceName: 'corte',
      },
      makeContext({ professionalId: null })
    );

    // Find the INSERT INTO appointments call
    const calls = mockQuery.mock.calls as unknown[][];
    const insertCall = calls.find(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('INSERT INTO appointments')
    );
    expect(insertCall).toBeDefined();

    const params = insertCall![1] as string[];
    const startsAt = params[8];  // $9 = starts_at
    const endsAt = params[9];    // $10 = ends_at

    // Both must be proper ISO UTC strings ending with Z
    expect(startsAt).toMatch(/Z$/);
    expect(endsAt).toMatch(/Z$/);

    // Duration should be exactly 20 minutes (service duration)
    const durationMs = new Date(endsAt).getTime() - new Date(startsAt).getTime();
    expect(durationMs).toBe(20 * 60 * 1000);
  });

  it('google_calendar_reprogram normalizes timezone-naive date to UTC ISO for starts_at', async () => {
    const juliProf = fakeProfessional(PROF_A);
    juliProf.name = 'Juli';
    const appt = fakeAppointment(PROF_A);
    const corteService = {
      id: 'svc-corte',
      company_id: COMPANY_A,
      name: 'Corte',
      duration_minutes: 20,
      professional_id: PROF_A,
      is_active: true,
      aliases: [],
    };

    setupQueryMock([
      ['FROM professionals', [juliProf]],
      ['FROM services', [corteService]],
      ['UPDATE conversations SET professional_id', []],
      ['FROM appointments WHERE', [appt]],
      ['UPDATE appointments', []],
    ]);

    await executeTool(
      'google_calendar_reprogram',
      {
        appointmentId: APPT_ID,
        startsAt: '2026-03-17T15:00:00',  // No Z suffix
        professionalName: 'Juli',
        serviceName: 'corte',
      },
      makeContext({ professionalId: null })
    );

    // Find the UPDATE appointments call
    const calls = mockQuery.mock.calls as unknown[][];
    const updateCall = calls.find(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('UPDATE appointments')
      && (call[0] as string).includes('starts_at')
    );
    expect(updateCall).toBeDefined();

    const params = updateCall![1] as string[];
    const startsAtParam = params[2];  // $3 = starts_at
    const endsAtParam = params[3];    // $4 = ends_at

    expect(startsAtParam).toMatch(/Z$/);
    expect(endsAtParam).toMatch(/Z$/);

    const durationMs = new Date(endsAtParam).getTime() - new Date(startsAtParam).getTime();
    expect(durationMs).toBe(20 * 60 * 1000);
  });
});

describe('cancel: SQL does NOT include professional_id filter', () => {
  beforeEach(() => mockQuery.mockReset());

  it('queries appointments by id + company_id only, without professional_id', async () => {
    const appt = fakeAppointment(PROF_A);
    const prof = fakeProfessional(PROF_A);

    setupQueryMock([
      ['FROM appointments WHERE', [appt]],
      ['FROM professionals WHERE id =', [prof]],
      ['UPDATE appointments', []],
    ]);

    await executeTool(
      'google_calendar_cancel',
      { appointmentId: APPT_ID },
      makeContext({ professionalId: PROF_A })
    );

    const calls = mockQuery.mock.calls as unknown[][];
    const appointmentCall = calls.find(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('FROM appointments WHERE')
    );
    expect(appointmentCall).toBeDefined();
    const sql = appointmentCall![0] as string;
    // Cancel should NOT filter by professional_id — any appointment in the company can be cancelled
    expect(sql).not.toContain('professional_id');
  });
});

// ──────────────────────────────────────────────────────────
// Bug fix: cancel must NOT require service selection
// ──────────────────────────────────────────────────────────

describe('cancel: does not require service selection', () => {
  beforeEach(() => mockQuery.mockReset());

  it('cancels by appointmentId without serviceName — no service selection error', async () => {
    const prof = fakeProfessional(PROF_A);
    const appt = fakeAppointment(PROF_A);

    setupQueryMock([
      ['FROM professionals WHERE id =', [prof]],
      ['FROM appointments WHERE', [appt]],
      ['UPDATE appointments', []],
    ]);

    const result = await executeTool(
      'google_calendar_cancel',
      { appointmentId: APPT_ID },
      makeContext({ professionalId: PROF_A })
    );
    const parsed = JSON.parse(result);
    expect(parsed.needsServiceSelection).toBeUndefined();
    expect(parsed.success).toBe(true);
    expect(parsed.appointmentId).toBe(APPT_ID);
  });

  it('cancels by eventId without serviceName — no service selection error', async () => {
    const prof = fakeProfessional(PROF_A);
    const appt = fakeAppointment(PROF_A);

    setupQueryMock([
      ['FROM professionals WHERE id =', [prof]],
      ['FROM appointments WHERE', [appt]],
      ['UPDATE appointments', []],
    ]);

    const result = await executeTool(
      'google_calendar_cancel',
      { eventId: EVENT_ID },
      makeContext({ professionalId: PROF_A })
    );
    const parsed = JSON.parse(result);
    expect(parsed.needsServiceSelection).toBeUndefined();
    expect(parsed.success).toBe(true);
  });

  it('cancels appointment even when multiple services exist (no ambiguity prompt)', async () => {
    const prof = fakeProfessional(PROF_A);
    const appt = fakeAppointment(PROF_A);

    setupQueryMock([
      ['FROM professionals WHERE id =', [prof]],
      ['FROM appointments WHERE', [appt]],
      ['UPDATE appointments', []],
    ]);

    // No serviceName, no serviceId — should still cancel without asking
    const result = await executeTool(
      'google_calendar_cancel',
      { appointmentId: APPT_ID },
      makeContext({ professionalId: PROF_A })
    );
    const parsed = JSON.parse(result);
    expect(parsed.serviceOptions).toBeUndefined();
    expect(parsed.success).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────
// Bug fix: list enriches events with Talora appointmentId
// ──────────────────────────────────────────────────────────

describe('list: enriches events with appointmentId from DB', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns appointmentId when google_event_id matches an appointment', async () => {
    const prof = fakeProfessional(PROF_A);
    const corteService = {
      id: 'svc-corte',
      company_id: COMPANY_A,
      name: 'Corte',
      duration_minutes: 20,
      professional_id: PROF_A,
      is_active: true,
      aliases: [],
    };

    setupQueryMock([
      ['FROM professionals WHERE id =', [prof]],
      ['FROM services', [corteService]],
      ['UPDATE conversations SET professional_id', []],
      // Cross-reference query for enrichment
      ['google_event_id IN', [
        { id: APPT_ID, google_event_id: 'gcal-evt-1' },
      ]],
    ]);

    // Mock listEvents to return an event with a google_event_id
    const { listEvents } = await import('../../calendar/operations');
    (listEvents as ReturnType<typeof mock>).mockImplementation(() =>
      Promise.resolve({
        events: [
          { id: 'gcal-evt-1', summary: 'Corte con Juli', description: '', starts_at: '2026-03-16T10:00:00-03:00', ends_at: '2026-03-16T10:30:00-03:00' },
        ],
      })
    );

    const result = await executeTool(
      'google_calendar_list',
      { startDate: '2026-03-16T00:00:00Z', endDate: '2026-03-17T00:00:00Z' },
      makeContext({ professionalId: PROF_A })
    );
    const parsed = JSON.parse(result);
    expect(parsed.events).toBeDefined();
    expect(parsed.events[0].appointmentId).toBe(APPT_ID);
  });
});
