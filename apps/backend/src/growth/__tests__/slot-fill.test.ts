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

const mockSendReactivationMessage = mock(() =>
  Promise.resolve({ success: true, reactivationId: 'react-111' })
);

mock.module('../reactivation', () => ({
  sendReactivationMessage: mockSendReactivationMessage,
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
const CLIENT_B = 'ccccc-bbb-2222-3333-444444444444';
const APPT_ID = TEST_IDS.APPT_A;
const CANCELLER_ID = 'cancel-aaa-1111-2222-333333333333';

// Future slot: 24 hours from now
const FUTURE_SLOT = new Date(Date.now() + 24 * 3_600_000).toISOString();
// Past slot: 1 hour from now (< MIN_HOURS_BEFORE_SLOT)
const SOON_SLOT = new Date(Date.now() + 1 * 3_600_000).toISOString();

function baseEvent() {
  return {
    appointmentId: APPT_ID,
    companyId: COMPANY_ID,
    serviceId: SERVICE_ID,
    professionalId: null,
    startsAt: FUTURE_SLOT,
    cancelledClientId: CANCELLER_ID,
  };
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
  mockSendReactivationMessage.mockReset();
  mockSendReactivationMessage.mockImplementation(() =>
    Promise.resolve({ success: true, reactivationId: 'react-111' })
  );
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

function setupHappyPathMocks(eligibleClients = [{ client_id: CLIENT_A, client_name: 'Maria' }]) {
  mockQuery.mockImplementation((sql: string) => {
    const s = String(sql);
    // company_settings check
    if (s.includes('slot_fill_enabled')) {
      return Promise.resolve({
        rows: [{ slot_fill_enabled: true, slot_fill_message_template: null }],
        rowCount: 1,
      });
    }
    // service + company name
    if (s.includes('service_name') && s.includes('company_name')) {
      return Promise.resolve({
        rows: [{ service_name: 'Corte de pelo', company_name: 'Barberia Cool' }],
        rowCount: 1,
      });
    }
    // eligible clients
    if (s.includes('DISTINCT ON')) {
      return Promise.resolve({ rows: eligibleClients, rowCount: eligibleClients.length });
    }
    // trigger_type update
    if (s.includes('trigger_type')) {
      return Promise.resolve({ rows: [], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('initSlotFillListener', () => {
  it('should send slot-fill messages to eligible clients when enabled', async () => {
    initSlotFillListener();
    setupHappyPathMocks();

    await emitAndWait('appointment:cancelled', baseEvent());

    // Should have called sendReactivationMessage once
    expect(mockSendReactivationMessage).toHaveBeenCalledTimes(1);
    const [companyId, clientId, message] = mockSendReactivationMessage.mock.calls[0] as unknown[];
    expect(companyId).toBe(COMPANY_ID);
    expect(clientId).toBe(CLIENT_A);
    expect(String(message)).toContain('Maria');
    expect(String(message)).toContain('Corte de pelo');
    expect(String(message)).toContain('Barberia Cool');

    // Should have updated trigger_type
    const triggerUpdate = mockQuery.mock.calls.find(c => String(c[0]).includes('trigger_type'));
    expect(triggerUpdate).toBeDefined();
  });

  it('should send to multiple clients (up to MAX_RECIPIENTS)', async () => {
    initSlotFillListener();
    setupHappyPathMocks([
      { client_id: CLIENT_A, client_name: 'Maria' },
      { client_id: CLIENT_B, client_name: 'Juan' },
    ]);

    await emitAndWait('appointment:cancelled', baseEvent());

    expect(mockSendReactivationMessage).toHaveBeenCalledTimes(2);
  });

  it('should not send when slot_fill_enabled is false', async () => {
    initSlotFillListener();
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('slot_fill_enabled')) {
        return Promise.resolve({
          rows: [{ slot_fill_enabled: false, slot_fill_message_template: null }],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await emitAndWait('appointment:cancelled', baseEvent());

    expect(mockSendReactivationMessage).not.toHaveBeenCalled();
  });

  it('should not send when no company_settings row exists', async () => {
    initSlotFillListener();
    // Default mock returns empty rows for everything

    await emitAndWait('appointment:cancelled', baseEvent());

    expect(mockSendReactivationMessage).not.toHaveBeenCalled();
  });

  it('should skip when serviceId is null', async () => {
    initSlotFillListener();
    setupHappyPathMocks();

    await emitAndWait('appointment:cancelled', { ...baseEvent(), serviceId: null });

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockSendReactivationMessage).not.toHaveBeenCalled();
  });

  it('should skip when slot is less than 2 hours away', async () => {
    initSlotFillListener();
    setupHappyPathMocks();

    await emitAndWait('appointment:cancelled', { ...baseEvent(), startsAt: SOON_SLOT });

    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockSendReactivationMessage).not.toHaveBeenCalled();
  });

  it('should skip when no eligible clients found', async () => {
    initSlotFillListener();
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('slot_fill_enabled')) {
        return Promise.resolve({
          rows: [{ slot_fill_enabled: true, slot_fill_message_template: null }],
          rowCount: 1,
        });
      }
      if (s.includes('service_name')) {
        return Promise.resolve({
          rows: [{ service_name: 'Corte', company_name: 'Shop' }],
          rowCount: 1,
        });
      }
      // No eligible clients
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await emitAndWait('appointment:cancelled', baseEvent());

    expect(mockSendReactivationMessage).not.toHaveBeenCalled();
  });

  it('should stop sending on rate limit (429)', async () => {
    initSlotFillListener();
    setupHappyPathMocks([
      { client_id: CLIENT_A, client_name: 'Maria' },
      { client_id: CLIENT_B, client_name: 'Juan' },
    ]);

    // First call succeeds, second hits rate limit
    mockSendReactivationMessage
      .mockImplementationOnce(() => Promise.resolve({ success: true, reactivationId: 'r1' }))
      .mockImplementationOnce(() =>
        Promise.resolve({ success: false, error: 'Rate limit', status: 429 })
      );

    await emitAndWait('appointment:cancelled', baseEvent());

    expect(mockSendReactivationMessage).toHaveBeenCalledTimes(2);
    // Only 1 trigger_type update (the successful one)
    const triggerUpdates = mockQuery.mock.calls.filter(c => String(c[0]).includes('trigger_type'));
    expect(triggerUpdates.length).toBe(1);
  });

  it('should continue sending when individual message fails (non-429)', async () => {
    initSlotFillListener();
    setupHappyPathMocks([
      { client_id: CLIENT_A, client_name: 'Maria' },
      { client_id: CLIENT_B, client_name: 'Juan' },
    ]);

    // First fails with 502, second succeeds
    mockSendReactivationMessage
      .mockImplementationOnce(() =>
        Promise.resolve({ success: false, error: 'WhatsApp down', status: 502 })
      )
      .mockImplementationOnce(() => Promise.resolve({ success: true, reactivationId: 'r2' }));

    await emitAndWait('appointment:cancelled', baseEvent());

    expect(mockSendReactivationMessage).toHaveBeenCalledTimes(2);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
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

  it('should use custom template when configured', async () => {
    initSlotFillListener();
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('slot_fill_enabled')) {
        return Promise.resolve({
          rows: [{
            slot_fill_enabled: true,
            slot_fill_message_template: 'Hey {{client_name}}, hay lugar para {{service_name}}!',
          }],
          rowCount: 1,
        });
      }
      if (s.includes('service_name') && s.includes('company_name')) {
        return Promise.resolve({
          rows: [{ service_name: 'Masajes', company_name: 'Spa' }],
          rowCount: 1,
        });
      }
      if (s.includes('DISTINCT ON')) {
        return Promise.resolve({
          rows: [{ client_id: CLIENT_A, client_name: 'Ana' }],
          rowCount: 1,
        });
      }
      if (s.includes('trigger_type')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await emitAndWait('appointment:cancelled', baseEvent());

    const [, , message] = mockSendReactivationMessage.mock.calls[0] as unknown[];
    expect(String(message)).toBe('Hey Ana, hay lugar para Masajes!');
  });

  it('should pass canceller exclusion to SQL query', async () => {
    initSlotFillListener();
    setupHappyPathMocks();

    await emitAndWait('appointment:cancelled', baseEvent());

    // Find the eligible clients query
    const eligibleQuery = mockQuery.mock.calls.find(c => String(c[0]).includes('DISTINCT ON'));
    expect(eligibleQuery).toBeDefined();
    const params = eligibleQuery![1] as unknown[];
    expect(params[2]).toBe(CANCELLER_ID); // cancelledClientId passed as $3
  });

  it('should pass LIMIT to SQL query for max recipients cap', async () => {
    initSlotFillListener();
    setupHappyPathMocks();

    await emitAndWait('appointment:cancelled', baseEvent());

    const eligibleQuery = mockQuery.mock.calls.find(c => String(c[0]).includes('DISTINCT ON'));
    expect(eligibleQuery).toBeDefined();
    const params = eligibleQuery![1] as unknown[];
    expect(params[3]).toBe(5); // MAX_RECIPIENTS
  });
});
