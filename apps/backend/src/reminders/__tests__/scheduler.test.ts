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

const mockSendOutboundMessage = mock(() =>
  Promise.resolve({ success: true, reactivationId: 'react-111' })
);

mock.module('../../growth/reactivation', () => ({
  sendOutboundMessage: mockSendOutboundMessage,
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { processReminders, generateReminderMessage, DEFAULT_REMINDER_TEMPLATE } =
  await import('../scheduler');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_ID = TEST_IDS.COMPANY_A;
const CLIENT_ID = TEST_IDS.CLIENT_A;
const APPT_ID = TEST_IDS.APPT_A;
const APPT_B_ID = 'appt-bbbb-1111-2222-333333333333';
const SERVICE_NAME = 'Corte de pelo';
const COMPANY_NAME = 'Barberia Cool';
const PROF_NAME = 'Carlos';
const TIMEZONE = 'America/Argentina/Buenos_Aires';

// 2 hours from now — within default 3h window
const WITHIN_WINDOW = new Date(Date.now() + 2 * 3_600_000).toISOString();

function makePendingRow(overrides: Record<string, unknown> = {}) {
  return {
    appointment_id: APPT_ID,
    company_id: COMPANY_ID,
    client_id: CLIENT_ID,
    client_name: 'Maria',
    starts_at: WITHIN_WINDOW,
    service_name: SERVICE_NAME,
    company_name: COMPANY_NAME,
    professional_name: PROF_NAME,
    reminder_message_template: null,
    timezone: TIMEZONE,
    ...overrides,
  };
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
  mockSendOutboundMessage.mockReset();
  mockSendOutboundMessage.mockImplementation(() =>
    Promise.resolve({ success: true, reactivationId: 'react-111' })
  );
  mockLogger.error.mockReset();
  mockLogger.warn.mockReset();
  mockLogger.info.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processReminders', () => {
  it('should send reminder for confirmed appointment within window', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('company_settings')) {
        return Promise.resolve({ rows: [makePendingRow()], rowCount: 1 });
      }
      // batch UPDATE
      if (s.includes('reminder_sent_at')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await processReminders();

    expect(mockSendOutboundMessage).toHaveBeenCalledTimes(1);
    const [companyId, clientId, message] = mockSendOutboundMessage.mock.calls[0] as unknown[];
    expect(companyId).toBe(COMPANY_ID);
    expect(clientId).toBe(CLIENT_ID);
    expect(String(message)).toContain('Maria');
    expect(String(message)).toContain(SERVICE_NAME);
    expect(String(message)).toContain(COMPANY_NAME);
  });

  it('should not send when no pending reminders (reminder_enabled=false handled by query)', async () => {
    // Default mock returns empty rows
    await processReminders();

    expect(mockSendOutboundMessage).not.toHaveBeenCalled();
  });

  it('should use custom template when provided', async () => {
    const customTemplate = 'Hey {{client_name}}, tu turno de {{service_name}} es {{time_description}}!';
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('company_settings')) {
        return Promise.resolve({
          rows: [makePendingRow({ reminder_message_template: customTemplate })],
          rowCount: 1,
        });
      }
      if (s.includes('reminder_sent_at')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await processReminders();

    expect(mockSendOutboundMessage).toHaveBeenCalledTimes(1);
    const [, , message] = mockSendOutboundMessage.mock.calls[0] as unknown[];
    expect(String(message)).toContain('Hey Maria');
    expect(String(message)).toContain(SERVICE_NAME);
    // Should NOT contain default template text
    expect(String(message)).not.toContain('Te esperamos');
  });

  it('should use default template when no custom template', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('company_settings')) {
        return Promise.resolve({ rows: [makePendingRow()], rowCount: 1 });
      }
      if (s.includes('reminder_sent_at')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await processReminders();

    const [, , message] = mockSendOutboundMessage.mock.calls[0] as unknown[];
    expect(String(message)).toContain('Te esperamos');
  });

  it('should stop on 429 rate limit', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('company_settings')) {
        return Promise.resolve({
          rows: [
            makePendingRow(),
            makePendingRow({ appointment_id: APPT_B_ID, client_name: 'Juan' }),
          ],
          rowCount: 2,
        });
      }
      if (s.includes('reminder_sent_at')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    mockSendOutboundMessage
      .mockImplementationOnce(() => Promise.resolve({ success: true, reactivationId: 'r1' }))
      .mockImplementationOnce(() =>
        Promise.resolve({ success: false, error: 'Rate limit', status: 429 })
      );

    await processReminders();

    expect(mockSendOutboundMessage).toHaveBeenCalledTimes(2);
    // Only 1 appointment should be batch-updated
    const updateCall = mockQuery.mock.calls.find(
      (c) => String(c[0]).includes('reminder_sent_at') && String(c[0]).includes('ANY')
    );
    expect(updateCall).toBeDefined();
    const ids = updateCall![1] as unknown[];
    expect((ids[0] as string[]).length).toBe(1);
  });

  it('should continue on non-429 failure', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('company_settings')) {
        return Promise.resolve({
          rows: [
            makePendingRow(),
            makePendingRow({ appointment_id: APPT_B_ID, client_name: 'Juan' }),
          ],
          rowCount: 2,
        });
      }
      if (s.includes('reminder_sent_at')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    mockSendOutboundMessage
      .mockImplementationOnce(() =>
        Promise.resolve({ success: false, error: 'No WhatsApp', status: 503 })
      )
      .mockImplementationOnce(() => Promise.resolve({ success: true, reactivationId: 'r2' }));

    await processReminders();

    expect(mockSendOutboundMessage).toHaveBeenCalledTimes(2);
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    // Second appointment should be in batch update
    const updateCall = mockQuery.mock.calls.find(
      (c) => String(c[0]).includes('reminder_sent_at') && String(c[0]).includes('ANY')
    );
    expect(updateCall).toBeDefined();
    const ids = updateCall![1] as unknown[];
    expect((ids[0] as string[])).toContain(APPT_B_ID);
  });

  it('should catch DB query error without crashing', async () => {
    mockQuery.mockImplementation(() => {
      throw new Error('DB connection refused');
    });

    // Should NOT throw
    await processReminders();

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const errorArgs = mockLogger.error.mock.calls[0] as unknown[];
    expect(String(errorArgs[0])).toContain('reminders');
  });

  it('should batch-update reminder_sent_at for all successful sends', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('company_settings')) {
        return Promise.resolve({
          rows: [
            makePendingRow(),
            makePendingRow({ appointment_id: APPT_B_ID, client_name: 'Juan' }),
          ],
          rowCount: 2,
        });
      }
      if (s.includes('reminder_sent_at')) {
        return Promise.resolve({ rows: [], rowCount: 2 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await processReminders();

    const updateCall = mockQuery.mock.calls.find(
      (c) => String(c[0]).includes('reminder_sent_at') && String(c[0]).includes('ANY')
    );
    expect(updateCall).toBeDefined();
    const ids = updateCall![1] as unknown[];
    expect((ids[0] as string[]).length).toBe(2);
    expect((ids[0] as string[])).toContain(APPT_ID);
    expect((ids[0] as string[])).toContain(APPT_B_ID);
  });

  it('should process multiple companies in single cycle', async () => {
    const companyBRow = makePendingRow({
      appointment_id: APPT_B_ID,
      company_id: TEST_IDS.COMPANY_B,
      client_name: 'Juan',
      company_name: 'Spa Premium',
    });
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('company_settings')) {
        return Promise.resolve({
          rows: [makePendingRow(), companyBRow],
          rowCount: 2,
        });
      }
      if (s.includes('reminder_sent_at')) {
        return Promise.resolve({ rows: [], rowCount: 2 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await processReminders();

    expect(mockSendOutboundMessage).toHaveBeenCalledTimes(2);
    const [companyId1] = mockSendOutboundMessage.mock.calls[0] as unknown[];
    const [companyId2] = mockSendOutboundMessage.mock.calls[1] as unknown[];
    expect(companyId1).toBe(COMPANY_ID);
    expect(companyId2).toBe(TEST_IDS.COMPANY_B);
  });

  it('should not call batch UPDATE when no reminders sent', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('company_settings')) {
        return Promise.resolve({ rows: [makePendingRow()], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    mockSendOutboundMessage.mockImplementation(() =>
      Promise.resolve({ success: false, error: 'No WhatsApp', status: 503 })
    );

    await processReminders();

    const updateCall = mockQuery.mock.calls.find(
      (c) => String(c[0]).includes('ANY')
    );
    expect(updateCall).toBeUndefined();
  });

  it('should use "tu turno" when service_name is null', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('company_settings')) {
        return Promise.resolve({
          rows: [makePendingRow({ service_name: null })],
          rowCount: 1,
        });
      }
      if (s.includes('reminder_sent_at')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await processReminders();

    const [, , message] = mockSendOutboundMessage.mock.calls[0] as unknown[];
    expect(String(message)).toContain('tu turno');
  });
});

describe('generateReminderMessage', () => {
  const baseParams = {
    clientName: 'Maria',
    serviceName: 'Corte de pelo',
    companyName: 'Barberia Cool',
    professionalName: 'Carlos',
    timezone: 'America/Argentina/Buenos_Aires',
  };

  // Fixed "now" for deterministic time_description tests
  // 2026-03-14 12:00 UTC = 2026-03-14 09:00 Argentina time
  const FIXED_NOW = new Date('2026-03-14T12:00:00.000Z');

  it('should generate "hoy a las HH:MM" for same-day appointment', () => {
    // Same day: 2026-03-14 at 15:00 UTC = 12:00 Argentina
    const msg = generateReminderMessage({
      ...baseParams,
      startsAt: '2026-03-14T15:00:00.000Z',
      now: FIXED_NOW,
    });

    expect(msg).toContain('hoy a las');
    expect(msg).toContain('Maria');
    expect(msg).toContain('Corte de pelo');
  });

  it('should generate "manana a las HH:MM" for next-day appointment', () => {
    // Next day: 2026-03-15 at 17:00 UTC = 14:00 Argentina
    const msg = generateReminderMessage({
      ...baseParams,
      startsAt: '2026-03-15T17:00:00.000Z',
      now: FIXED_NOW,
    });

    expect(msg).toContain('manana a las');
    expect(msg).toContain('Maria');
  });

  it('should generate "el DD/MM a las HH:MM" for distant appointment', () => {
    // 5 days later: 2026-03-19
    const msg = generateReminderMessage({
      ...baseParams,
      startsAt: '2026-03-19T15:00:00.000Z',
      now: FIXED_NOW,
    });

    expect(msg).toMatch(/el \d{1,2}\/\d{1,2} a las/);
  });

  it('should fall back to default timezone on invalid timezone', () => {
    const twoHoursLater = new Date(Date.now() + 2 * 3_600_000);
    const msg = generateReminderMessage({
      ...baseParams,
      timezone: 'Invalid/Timezone',
      startsAt: twoHoursLater.toISOString(),
    });

    // Should not throw, should produce a valid message
    expect(msg).toContain('Maria');
    expect(msg).toContain('Corte de pelo');
    expect(msg).toMatch(/a las \d{2}:\d{2}/);
  });

  it('should replace all template variables', () => {
    const customTemplate =
      '{{client_name}} - {{service_name}} - {{company_name}} - {{professional_name}} - {{date}} - {{time}} - {{time_description}}';
    const twoHoursLater = new Date(Date.now() + 2 * 3_600_000);
    const msg = generateReminderMessage({
      ...baseParams,
      customTemplate,
      startsAt: twoHoursLater.toISOString(),
    });

    expect(msg).not.toContain('{{');
    expect(msg).toContain('Maria');
    expect(msg).toContain('Corte de pelo');
    expect(msg).toContain('Barberia Cool');
    expect(msg).toContain('Carlos');
  });

  it('should use custom template when provided', () => {
    const twoHoursLater = new Date(Date.now() + 2 * 3_600_000);
    const msg = generateReminderMessage({
      ...baseParams,
      customTemplate: 'Hola {{client_name}}, no te olvides!',
      startsAt: twoHoursLater.toISOString(),
    });

    expect(msg).toBe('Hola Maria, no te olvides!');
  });
});
