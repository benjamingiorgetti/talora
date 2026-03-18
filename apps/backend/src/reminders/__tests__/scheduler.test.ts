// @ts-nocheck
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TEST_IDS } from '../../__test-utils__/factories';

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

const mockSendWhatsAppMessage = mock(() =>
  Promise.resolve({ success: true, outboundMessageId: 'outbound-1', conversationId: TEST_IDS.CONV_A })
);
mock.module('../../outbound/service', () => ({
  sendWhatsAppMessage: mockSendWhatsAppMessage,
}));

const { processReminders, generateReminderMessage, DEFAULT_REMINDER_TEMPLATE } =
  await import('../scheduler');

const COMPANY_ID = TEST_IDS.COMPANY_A;
const CLIENT_ID = TEST_IDS.CLIENT_A;
const APPT_ID = TEST_IDS.APPT_A;
const REMINDER_ID = 'reminder-aaa-1111-2222-333333333333';
const APPT_B_ID = 'appt-bbbb-1111-2222-333333333333';

function makeDueReminder(overrides: Record<string, unknown> = {}) {
  return {
    reminder_id: REMINDER_ID,
    appointment_id: APPT_ID,
    company_id: COMPANY_ID,
    client_id: CLIENT_ID,
    client_name: 'Maria',
    starts_at: '2026-03-14T15:00:00.000Z',
    service_name: 'Corte de pelo',
    company_name: 'Barberia Cool',
    professional_name: 'Carlos',
    reminder_message_template: null,
    timezone: 'America/Argentina/Buenos_Aires',
    ...overrides,
  };
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
  mockSendWhatsAppMessage.mockReset();
  mockSendWhatsAppMessage.mockImplementation(() =>
    Promise.resolve({ success: true, outboundMessageId: 'outbound-1', conversationId: TEST_IDS.CONV_A })
  );
  mockLogger.error.mockReset();
  mockLogger.warn.mockReset();
  mockLogger.info.mockReset();
});

describe('processReminders', () => {
  it('should send due reminders through outbound service', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('UPDATE appointment_reminders') && s.includes('RETURNING ar.id')) {
        return Promise.resolve({ rows: [{ id: REMINDER_ID }], rowCount: 1 });
      }
      if (s.includes('FROM appointment_reminders ar') && s.includes('company_name')) {
        return Promise.resolve({ rows: [makeDueReminder()], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 1 });
    });

    await processReminders();

    expect(mockSendWhatsAppMessage).toHaveBeenCalledTimes(1);
    const params = mockSendWhatsAppMessage.mock.calls[0]?.[0];
    expect(params.companyId).toBe(COMPANY_ID);
    expect(params.clientId).toBe(CLIENT_ID);
    expect(params.purpose).toBe('reminder');
    expect(params.sourceType).toBe('appointment_reminder');
    expect(String(params.messageText)).toContain('Maria');
    const sentUpdate = mockQuery.mock.calls.find((call) =>
      String(call[0]).includes("SET status = 'sent'")
    );
    expect(sentUpdate).toBeDefined();
  });

  it('should use custom template when provided', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('UPDATE appointment_reminders') && s.includes('RETURNING ar.id')) {
        return Promise.resolve({ rows: [{ id: REMINDER_ID }], rowCount: 1 });
      }
      if (s.includes('FROM appointment_reminders ar') && s.includes('company_name')) {
        return Promise.resolve({
          rows: [
            makeDueReminder({
              reminder_message_template: 'Hey {{client_name}}, tu turno de {{service_name}} es {{time_description}}!',
            }),
          ],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 1 });
    });

    await processReminders();

    const params = mockSendWhatsAppMessage.mock.calls[0]?.[0];
    expect(String(params.messageText)).toContain('Hey Maria');
    expect(String(params.messageText)).not.toContain('Te esperamos');
  });

  it('should mark reminder as failed when outbound send fails', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('UPDATE appointment_reminders') && s.includes('RETURNING ar.id')) {
        return Promise.resolve({ rows: [{ id: REMINDER_ID }], rowCount: 1 });
      }
      if (s.includes('FROM appointment_reminders ar') && s.includes('company_name')) {
        return Promise.resolve({ rows: [makeDueReminder()], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 1 });
    });
    mockSendWhatsAppMessage.mockImplementation(() =>
      Promise.resolve({ success: false, error: 'Provider down', status: 502 })
    );

    await processReminders();

    const failedUpdate = mockQuery.mock.calls.find((call) =>
      String(call[0]).includes("SET status = 'failed'")
    );
    expect(failedUpdate).toBeDefined();
  });

  it('should process multiple reminders without reminder-specific rate limiting', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('UPDATE appointment_reminders') && s.includes('RETURNING ar.id')) {
        return Promise.resolve({
          rows: [{ id: REMINDER_ID }, { id: 'reminder-bbb-1111-2222-333333333333' }],
          rowCount: 2,
        });
      }
      if (s.includes('FROM appointment_reminders ar') && s.includes('company_name')) {
        return Promise.resolve({
          rows: [
            makeDueReminder(),
            makeDueReminder({
              reminder_id: 'reminder-bbb-1111-2222-333333333333',
              appointment_id: APPT_B_ID,
              client_name: 'Juan',
            }),
          ],
          rowCount: 2,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 1 });
    });

    await processReminders();

    expect(mockSendWhatsAppMessage).toHaveBeenCalledTimes(2);
    const sentUpdates = mockQuery.mock.calls.filter((call) =>
      String(call[0]).includes("SET status = 'sent'")
    );
    expect(sentUpdates.length).toBe(2);
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

  const FIXED_NOW = new Date('2026-03-14T12:00:00.000Z');

  it('should generate "hoy a las HH:MM" for same-day appointment', () => {
    const msg = generateReminderMessage({
      ...baseParams,
      startsAt: '2026-03-14T15:00:00.000Z',
      now: FIXED_NOW,
    });

    expect(msg).toContain('hoy a las');
    expect(msg).toContain('Maria');
  });

  it('should use custom template when provided', () => {
    const msg = generateReminderMessage({
      ...baseParams,
      customTemplate: 'Hola {{client_name}}, no te olvides!',
      startsAt: '2026-03-14T15:00:00.000Z',
      now: FIXED_NOW,
    });

    expect(msg).toBe('Hola Maria, no te olvides!');
    expect(DEFAULT_REMINDER_TEMPLATE).toContain('{{client_name}}');
  });
});
