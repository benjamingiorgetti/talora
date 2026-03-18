// @ts-nocheck
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TEST_IDS } from '../../__test-utils__/factories';

const mockQuery = mock(() => Promise.resolve({ rows: [], rowCount: 0 }));

mock.module('../../db/pool', () => ({
  pool: { query: mockQuery },
}));

mock.module('../../utils/logger', () => ({
  logger: {
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
  },
}));

const { upsertReminderForAppointment } = await import('../service');

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
});

describe('upsertReminderForAppointment', () => {
  it('should skip reminders created after the strict due_at boundary', async () => {
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
      const s = String(sql);
      if (s.includes('FROM appointments a') && s.includes('company_settings')) {
        return Promise.resolve({
          rows: [{
            appointment_id: TEST_IDS.APPT_A,
            company_id: TEST_IDS.COMPANY_A,
            client_id: TEST_IDS.CLIENT_A,
            starts_at: '2026-03-14T15:00:00.000Z',
            status: 'confirmed',
            reminder_enabled: true,
            reminder_hours_before: 3,
            timezone: 'America/Argentina/Buenos_Aires',
          }],
          rowCount: 1,
        });
      }
      if (s.includes('INSERT INTO appointment_reminders')) {
        return Promise.resolve({
          rows: [{ status: 'skipped', due_at: '2026-03-14T12:00:00.000Z' }],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const result = await upsertReminderForAppointment(TEST_IDS.APPT_A, {
      now: new Date('2026-03-14T13:30:00.000Z'),
      latePolicy: 'strict_due_at',
    });

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('past_due_at');
  });
});
