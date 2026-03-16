// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
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

// We need a real EventEmitter to test the listener
import { EventEmitter } from 'events';
const testAppEvents = new EventEmitter();

mock.module('../../events', () => ({
  appEvents: testAppEvents,
  // Re-export the type placeholder so imports don't break
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { initAttributionListener } = await import('../attribution');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_ID = TEST_IDS.COMPANY_A;
const CLIENT_ID = TEST_IDS.CLIENT_A;
const APPT_ID = TEST_IDS.APPT_A;
const REACTIVATION_MSG_ID = 'react-aaa-1111-2222-333333333333';

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
  mockLogger.error.mockReset();
  mockLogger.info.mockReset();
  // Remove all listeners to avoid stacking from repeated initAttributionListener calls
  testAppEvents.removeAllListeners('appointment:created');
});

// Helper to emit and wait for async handler
async function emitAndWait(event: string, payload: unknown) {
  const listeners = testAppEvents.listeners(event) as Function[];
  for (const listener of listeners) {
    await listener(payload);
  }
}

// ---------------------------------------------------------------------------
// initAttributionListener
// ---------------------------------------------------------------------------

describe('initAttributionListener', () => {
  it('should attribute within 7 days: message sent 3 days ago, appointment created → status becomes converted', async () => {
    initAttributionListener();

    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      // Find recent reactivation message
      if (s.includes('FROM reactivation_messages') && s.includes('7 days')) {
        return Promise.resolve({ rows: [{ id: REACTIVATION_MSG_ID }], rowCount: 1 });
      }
      // Update to converted
      if (s.includes('UPDATE reactivation_messages') && s.includes('converted')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await emitAndWait('appointment:created', {
      appointmentId: APPT_ID,
      clientId: CLIENT_ID,
      companyId: COMPANY_ID,
      serviceId: null,
      professionalId: null,
    });

    // Verify UPDATE was called with correct params
    const updateCall = mockQuery.mock.calls.find(c =>
      String(c[0]).includes('UPDATE reactivation_messages')
    );
    expect(updateCall).toBeDefined();
    const updateParams = updateCall![1] as unknown[];
    expect(updateParams[0]).toBe(APPT_ID); // attributed_appointment_id
    expect(updateParams[1]).toBe(REACTIVATION_MSG_ID); // reactivation message id
  });

  it('should not attribute when no reactivation message found within 7 days', async () => {
    initAttributionListener();

    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      // No recent reactivation message
      if (s.includes('FROM reactivation_messages')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await emitAndWait('appointment:created', {
      appointmentId: APPT_ID,
      clientId: CLIENT_ID,
      companyId: COMPANY_ID,
      serviceId: null,
      professionalId: null,
    });

    // No UPDATE should have been called
    const updateCall = mockQuery.mock.calls.find(c =>
      String(c[0]).includes('UPDATE reactivation_messages')
    );
    expect(updateCall).toBeUndefined();
  });

  it('should not attribute already converted messages (SQL filters status = sent)', async () => {
    initAttributionListener();

    let capturedSql = '';
    mockQuery.mockImplementation((sql: string) => {
      capturedSql += String(sql);
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await emitAndWait('appointment:created', {
      appointmentId: APPT_ID,
      clientId: CLIENT_ID,
      companyId: COMPANY_ID,
      serviceId: null,
      professionalId: null,
    });

    // The query should only look for status = 'sent'
    expect(capturedSql).toContain("status = 'sent'");
  });

  it('should no-op when clientId is null', async () => {
    initAttributionListener();

    await emitAndWait('appointment:created', {
      appointmentId: APPT_ID,
      clientId: null,
      companyId: COMPANY_ID,
      serviceId: null,
      professionalId: null,
    });

    // No queries should have been made
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('should pick the most recent message (SQL ORDER BY sent_at DESC LIMIT 1)', async () => {
    initAttributionListener();

    let capturedSql = '';
    mockQuery.mockImplementation((sql: string) => {
      capturedSql += String(sql);
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await emitAndWait('appointment:created', {
      appointmentId: APPT_ID,
      clientId: CLIENT_ID,
      companyId: COMPANY_ID,
      serviceId: null,
      professionalId: null,
    });

    expect(capturedSql).toContain('ORDER BY sent_at DESC');
    expect(capturedSql).toContain('LIMIT 1');
  });

  it('should catch and log DB errors without propagating', async () => {
    initAttributionListener();

    const dbError = new Error('DB connection refused');
    mockQuery.mockImplementation(() => {
      throw dbError;
    });

    // Should NOT throw
    await emitAndWait('appointment:created', {
      appointmentId: APPT_ID,
      clientId: CLIENT_ID,
      companyId: COMPANY_ID,
      serviceId: null,
      professionalId: null,
    });

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const errorArgs = mockLogger.error.mock.calls[0] as unknown[];
    expect(String(errorArgs[0])).toContain('attribution');
  });

  it('should log info when attribution succeeds', async () => {
    initAttributionListener();

    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('FROM reactivation_messages') && s.includes('7 days')) {
        return Promise.resolve({ rows: [{ id: REACTIVATION_MSG_ID }], rowCount: 1 });
      }
      if (s.includes('UPDATE reactivation_messages')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await emitAndWait('appointment:created', {
      appointmentId: APPT_ID,
      clientId: CLIENT_ID,
      companyId: COMPANY_ID,
      serviceId: null,
      professionalId: null,
    });

    const infoCalls = mockLogger.info.mock.calls;
    const attributionLog = infoCalls.find(c => String(c[0]).includes('[attribution] Attributed'));
    expect(attributionLog).toBeDefined();
  });
});
