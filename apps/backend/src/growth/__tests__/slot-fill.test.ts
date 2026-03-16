// @ts-nocheck
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TEST_IDS } from '../../__test-utils__/factories';

// ---------------------------------------------------------------------------
// Mocks — MUST precede dynamic imports
// ---------------------------------------------------------------------------

const mockQuery = mock(() => Promise.resolve({ rows: [], rowCount: 0 }));

mock.module('../../db/pool', () => ({
  pool: { query: mockQuery },
}));

const mockLogger = {
  error: mock(() => {}),
  warn: mock(() => {}),
  info: mock(() => {}),
  debug: mock(() => {}),
};

mock.module('../../utils/logger', () => ({
  logger: mockLogger,
}));

const mockSelectSlotFillCandidates = mock(() => Promise.resolve([]));

mock.module('../slot-fill-selector', () => ({
  selectSlotFillCandidates: mockSelectSlotFillCandidates,
}));

const mockBroadcast = mock(() => {});

mock.module('../../ws/server', () => ({
  broadcast: mockBroadcast,
}));

// Real EventEmitter to test the listener
import { EventEmitter } from 'events';
const testAppEvents = new EventEmitter();

mock.module('../../events', () => ({
  appEvents: testAppEvents,
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { initSlotFillListener } = await import('../slot-fill');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_ID = TEST_IDS.COMPANY_A;
const SERVICE_ID = TEST_IDS.SERVICE_A;
const CLIENT_A = TEST_IDS.CLIENT_A;
const APPT_ID = TEST_IDS.APPT_A;
const PROF_ID = TEST_IDS.PROF_A;
const CANCELLER_ID = 'cancel-aaa-1111-2222-333333333333';

// Future slot: 24 hours from now
const FUTURE_SLOT = new Date(Date.now() + 24 * 3_600_000).toISOString();
// Past slot: 1 hour from now (< MIN_HOURS_BEFORE_SLOT)
const SOON_SLOT = new Date(Date.now() + 1 * 3_600_000).toISOString();

const OPP_ID = 'opp-aaaa-1111-2222-333333333333';

function baseEvent() {
  return {
    appointmentId: APPT_ID,
    companyId: COMPANY_ID,
    serviceId: SERVICE_ID,
    professionalId: PROF_ID,
    startsAt: FUTURE_SLOT,
    cancelledClientId: CANCELLER_ID,
  };
}

const DEFAULT_CANDIDATES = [
  {
    client_id: CLIENT_A,
    client_name: 'Maria',
    client_phone: '5491155550000',
    score: 75,
    match_reasons: ['same_service', 'same_weekday'],
    days_overdue: 5,
  },
];

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
  mockSelectSlotFillCandidates.mockReset();
  mockSelectSlotFillCandidates.mockImplementation(() => Promise.resolve([]));
  mockBroadcast.mockReset();
  mockLogger.error.mockReset();
  mockLogger.warn.mockReset();
  mockLogger.info.mockReset();
  testAppEvents.removeAllListeners('appointment:cancelled');
});

// Helper to emit and wait for async handler
async function emitAndWait(event: string, payload: unknown) {
  const listeners = testAppEvents.listeners(event) as Function[];
  for (const listener of listeners) {
    await listener(payload);
  }
}

// ---------------------------------------------------------------------------
// Standard query mock setup for happy path
// ---------------------------------------------------------------------------

function setupHappyPathMocks(candidates = DEFAULT_CANDIDATES) {
  mockQuery.mockImplementation((sql: string) => {
    const s = String(sql);
    // company_settings check
    if (s.includes('slot_fill_enabled')) {
      return Promise.resolve({
        rows: [{ slot_fill_enabled: true, slot_fill_max_candidates: 3 }],
        rowCount: 1,
      });
    }
    // INSERT opportunity (check before context query since both have service_name)
    if (s.includes('INSERT INTO slot_fill_opportunities')) {
      return Promise.resolve({ rows: [{ id: OPP_ID }], rowCount: 1 });
    }
    // context query (appointment + service + company + professional)
    if (s.includes('FROM appointments a') && s.includes('service_name')) {
      return Promise.resolve({
        rows: [{ service_name: 'Corte de pelo', company_name: 'Barberia Cool', professional_name: 'Juan', slot_ends_at: null }],
        rowCount: 1,
      });
    }
    // INSERT candidate
    if (s.includes('INSERT INTO slot_fill_candidates')) {
      return Promise.resolve({ rows: [], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });

  mockSelectSlotFillCandidates.mockImplementation(() => Promise.resolve(candidates));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initSlotFillListener', () => {
  it('should create opportunity and candidates when enabled', async () => {
    initSlotFillListener();
    setupHappyPathMocks();

    await emitAndWait('appointment:cancelled', baseEvent());

    // Should have called selectSlotFillCandidates
    expect(mockSelectSlotFillCandidates).toHaveBeenCalledTimes(1);
    const selectorInput = mockSelectSlotFillCandidates.mock.calls[0][0];
    expect(selectorInput.companyId).toBe(COMPANY_ID);
    expect(selectorInput.serviceId).toBe(SERVICE_ID);
    expect(selectorInput.professionalId).toBe(PROF_ID);
    expect(selectorInput.cancelledClientId).toBe(CANCELLER_ID);
    expect(selectorInput.maxCandidates).toBe(3);

    // Should have inserted opportunity
    const oppInsert = mockQuery.mock.calls.find(c => String(c[0]).includes('INSERT INTO slot_fill_opportunities'));
    expect(oppInsert).toBeDefined();

    // Should have inserted candidate
    const candInsert = mockQuery.mock.calls.find(c => String(c[0]).includes('INSERT INTO slot_fill_candidates'));
    expect(candInsert).toBeDefined();
    const candParams = candInsert![1] as unknown[];
    expect(candParams).toBeDefined();
    expect(candParams[1]).toBe(CLIENT_A); // client_id
    expect(candParams[2]).toBe(75); // score
    expect(candParams[3]).toEqual(['same_service', 'same_weekday']); // match_reasons
  });

  it('should broadcast WebSocket event with correct payload', async () => {
    initSlotFillListener();
    setupHappyPathMocks();

    await emitAndWait('appointment:cancelled', baseEvent());

    expect(mockBroadcast).toHaveBeenCalledTimes(1);
    const wsEvent = mockBroadcast.mock.calls[0][0];
    expect(wsEvent.type).toBe('slot_fill:new_opportunity');
    expect(wsEvent.payload.id).toBe(OPP_ID);
    expect(wsEvent.payload.company_id).toBe(COMPANY_ID);
    expect(wsEvent.payload.service_name).toBe('Corte de pelo');
  });

  it('should not create anything when no valid candidates', async () => {
    initSlotFillListener();
    setupHappyPathMocks([]);

    await emitAndWait('appointment:cancelled', baseEvent());

    expect(mockSelectSlotFillCandidates).toHaveBeenCalledTimes(1);
    const oppInsert = mockQuery.mock.calls.find(c => String(c[0]).includes('INSERT INTO slot_fill_opportunities'));
    expect(oppInsert).toBeUndefined();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('should not create when slot_fill_enabled is false', async () => {
    initSlotFillListener();
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('slot_fill_enabled')) {
        return Promise.resolve({
          rows: [{ slot_fill_enabled: false, slot_fill_max_candidates: 3 }],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await emitAndWait('appointment:cancelled', baseEvent());

    expect(mockSelectSlotFillCandidates).not.toHaveBeenCalled();
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it('should not create when no company_settings row exists', async () => {
    initSlotFillListener();

    await emitAndWait('appointment:cancelled', baseEvent());

    expect(mockSelectSlotFillCandidates).not.toHaveBeenCalled();
  });

  it('should skip when serviceId is null', async () => {
    initSlotFillListener();
    setupHappyPathMocks();

    await emitAndWait('appointment:cancelled', { ...baseEvent(), serviceId: null });

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockSelectSlotFillCandidates).not.toHaveBeenCalled();
  });

  it('should skip when slot is less than 2 hours away', async () => {
    initSlotFillListener();
    setupHappyPathMocks();

    await emitAndWait('appointment:cancelled', { ...baseEvent(), startsAt: SOON_SLOT });

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockSelectSlotFillCandidates).not.toHaveBeenCalled();
  });

  it('should insert multiple candidates', async () => {
    initSlotFillListener();
    const twoCandidates = [
      { client_id: CLIENT_A, client_name: 'Maria', client_phone: '111', score: 75, match_reasons: ['same_service'], days_overdue: 5 },
      { client_id: 'client-bb-1111-2222-333333333333', client_name: 'Juan', client_phone: '222', score: 50, match_reasons: ['same_service'], days_overdue: 0 },
    ];
    setupHappyPathMocks(twoCandidates);

    await emitAndWait('appointment:cancelled', baseEvent());

    const candInserts = mockQuery.mock.calls.filter(c => String(c[0]).includes('INSERT INTO slot_fill_candidates'));
    expect(candInserts).toHaveLength(2);
  });

  it('should catch and log errors without propagating', async () => {
    initSlotFillListener();

    const dbError = new Error('DB connection refused');
    mockQuery.mockImplementation(() => {
      throw dbError;
    });

    // Should NOT throw
    await emitAndWait('appointment:cancelled', baseEvent());

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const errorArgs = mockLogger.error.mock.calls[0] as unknown[];
    expect(String(errorArgs[0])).toContain('slot-fill');
  });

  it('should use max_candidates from settings', async () => {
    initSlotFillListener();
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('slot_fill_enabled')) {
        return Promise.resolve({
          rows: [{ slot_fill_enabled: true, slot_fill_max_candidates: 5 }],
          rowCount: 1,
        });
      }
      if (s.includes('service_name') && s.includes('professional_name')) {
        return Promise.resolve({
          rows: [{ service_name: 'Corte', company_name: 'Shop', professional_name: 'Pro', slot_ends_at: null }],
          rowCount: 1,
        });
      }
      if (s.includes('INSERT INTO slot_fill_opportunities')) {
        return Promise.resolve({ rows: [{ id: OPP_ID }], rowCount: 1 });
      }
      if (s.includes('INSERT INTO slot_fill_candidates')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    mockSelectSlotFillCandidates.mockImplementation(() => Promise.resolve(DEFAULT_CANDIDATES));

    await emitAndWait('appointment:cancelled', baseEvent());

    const selectorInput = mockSelectSlotFillCandidates.mock.calls[0][0];
    expect(selectorInput.maxCandidates).toBe(5);
  });
});
