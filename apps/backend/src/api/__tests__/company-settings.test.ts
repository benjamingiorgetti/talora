// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import express from 'express';
import type { Server } from 'http';
import { TEST_IDS } from '../../__test-utils__/factories';

// ---------------------------------------------------------------------------
// Mocks — MUST precede dynamic imports
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Auth mock
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = TEST_IDS.COMPANY_A;

mock.module('../middleware', () => ({
  authMiddleware: mock((_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  }),
  requireSuperadmin: mock((_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  }),
  requireCompanyScope: mock((_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  }),
  getRequestCompanyId: mock(() => TEST_COMPANY_ID),
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { companySettingsRouter } = await import('../company-settings');

// ---------------------------------------------------------------------------
// Test server
// ---------------------------------------------------------------------------

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/company-settings', companySettingsRouter);
  server = app.listen(0);
  const addr = server.address() as { port: number };
  baseUrl = `http://localhost:${addr.port}`;
});

afterAll(() => server?.close());

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PUT /company-settings', () => {
  it('should reject reminder_hours_before = 0', async () => {
    const res = await fetch(`${baseUrl}/company-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminder_hours_before: 0 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('reminder_hours_before');
  });

  it('should reject reminder_hours_before = 49', async () => {
    const res = await fetch(`${baseUrl}/company-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminder_hours_before: 49 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('reminder_hours_before');
  });

  it('should reject non-integer reminder_hours_before', async () => {
    const res = await fetch(`${baseUrl}/company-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reminder_hours_before: 2.5 }),
    });
    expect(res.status).toBe(400);
  });

  it('should accept valid reminder_hours_before and upsert', async () => {
    mockQuery.mockImplementation(() =>
      Promise.resolve({
        rows: [{
          id: 'cs-1',
          company_id: TEST_COMPANY_ID,
          reminder_enabled: true,
          reminder_hours_before: 5,
          reminder_message_template: null,
        }],
        rowCount: 1,
      })
    );

    const res = await fetch(`${baseUrl}/company-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reminder_enabled: true,
        reminder_hours_before: 5,
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reminder_hours_before).toBe(5);
  });

  it('should accept request without reminder_hours_before (uses default)', async () => {
    mockQuery.mockImplementation(() =>
      Promise.resolve({
        rows: [{ id: 'cs-1', company_id: TEST_COMPANY_ID }],
        rowCount: 1,
      })
    );

    const res = await fetch(`${baseUrl}/company-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opening_hour: '10:00' }),
    });
    expect(res.status).toBe(200);
  });
});

describe('GET /company-settings', () => {
  it('should return defaults when no settings exist', async () => {
    const res = await fetch(`${baseUrl}/company-settings`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reminder_enabled).toBe(false);
    expect(body.data.reminder_hours_before).toBe(3);
    expect(body.data.reminder_message_template).toBeNull();
  });
});
