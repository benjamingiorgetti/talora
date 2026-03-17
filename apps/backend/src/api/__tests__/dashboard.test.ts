// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import express from 'express';
import type { Server } from 'http';
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

const TEST_COMPANY_ID = TEST_IDS.COMPANY_A;

mock.module('../middleware', () => ({
  authMiddleware: mock((_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  }),
  requireCompanyScope: mock((_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  }),
  getRequestCompanyId: mock(() => TEST_COMPANY_ID),
}));

const { dashboardRouter } = await import('../dashboard');

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/dashboard', dashboardRouter);
  server = app.listen(0);
  const addr = server.address() as { port: number };
  baseUrl = `http://localhost:${addr.port}`;
});

afterAll(() => {
  server?.close();
});

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
});

describe('GET /dashboard/metrics', () => {
  it('falls back to the default timezone when company settings store an invalid timezone', async () => {
    let relativeDemandSql = '';

    mockQuery.mockImplementation((sql: string) => {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();

      if (normalized.includes('generate_series(1, 8)')) {
        if (!normalized.includes('pg_timezone_names')) {
          return Promise.reject(new Error('time zone "Mars/Phobos" not recognized'));
        }

        relativeDemandSql = normalized;
        return Promise.resolve({
          rows: [{
            today_count: 6,
            historical_avg_count: '4.0',
            sample_size: 3,
          }],
          rowCount: 1,
        });
      }

      if (normalized.includes('FROM conversations')) {
        return Promise.resolve({ rows: [{ last_activity: null }], rowCount: 1 });
      }

      return Promise.resolve({ rows: [{ count: '0' }], rowCount: 1 });
    });

    const res = await fetch(`${baseUrl}/dashboard/metrics`);

    expect(res.status).toBe(200);
    expect(relativeDemandSql).toContain('pg_timezone_names');
  });

  it('returns relative demand metrics using same-weekday history until current time', async () => {
    let relativeDemandSql = '';

    mockQuery.mockImplementation((sql: string) => {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();

      if (normalized.includes("FROM appointments") && normalized.includes("status = 'confirmed'") && normalized.includes('COUNT(*)::text AS count') && !normalized.includes('source =')) {
        return Promise.resolve({ rows: [{ count: '24' }], rowCount: 1 });
      }

      if (normalized.includes('FROM appointments') && normalized.includes("source = 'bot'") && normalized.includes("status = 'confirmed'")) {
        return Promise.resolve({ rows: [{ count: '8' }], rowCount: 1 });
      }

      if (normalized.includes('FROM appointments') && normalized.includes('COUNT(*)::text AS count') && !normalized.includes("status = 'confirmed'")) {
        return Promise.resolve({ rows: [{ count: '30' }], rowCount: 1 });
      }

      if (normalized.includes('FROM conversations')) {
        return Promise.resolve({ rows: [{ last_activity: '2026-03-17T14:00:00.000Z' }], rowCount: 1 });
      }

      if (normalized.includes('generate_series(1, 8)')) {
        relativeDemandSql = normalized;
        return Promise.resolve({
          rows: [{
            today_count: 12,
            historical_avg_count: '10.5',
            sample_size: 4,
          }],
          rowCount: 1,
        });
      }

      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/dashboard/metrics`);
    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body.data.relative_demand).toEqual({
      today_count: 12,
      historical_avg_count: 10.5,
      ratio_pct: 114,
      delta_pct: 14,
      sample_size: 4,
      mode: 'same_weekday_until_now',
      has_enough_data: true,
    });
    expect(relativeDemandSql).toContain("a.status = 'confirmed'");
    expect(relativeDemandSql).toContain('AT TIME ZONE');
    expect(relativeDemandSql).toContain('l.local_time <= n.now_time');
  });

  it('flags insufficient data and avoids misleading percentages', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();

      if (normalized.includes('generate_series(1, 8)')) {
        return Promise.resolve({
          rows: [{
            today_count: 5,
            historical_avg_count: '4.5',
            sample_size: 2,
          }],
          rowCount: 1,
        });
      }

      if (normalized.includes('FROM conversations')) {
        return Promise.resolve({ rows: [{ last_activity: null }], rowCount: 1 });
      }

      return Promise.resolve({ rows: [{ count: '0' }], rowCount: 1 });
    });

    const res = await fetch(`${baseUrl}/dashboard/metrics`);
    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body.data.relative_demand).toEqual({
      today_count: 5,
      historical_avg_count: 4.5,
      ratio_pct: 0,
      delta_pct: 0,
      sample_size: 2,
      mode: 'same_weekday_until_now',
      has_enough_data: false,
    });
  });

  it('treats zero historical average as missing baseline data', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();

      if (normalized.includes('generate_series(1, 8)')) {
        return Promise.resolve({
          rows: [{
            today_count: 3,
            historical_avg_count: '0',
            sample_size: 5,
          }],
          rowCount: 1,
        });
      }

      if (normalized.includes('FROM conversations')) {
        return Promise.resolve({ rows: [{ last_activity: null }], rowCount: 1 });
      }

      return Promise.resolve({ rows: [{ count: '0' }], rowCount: 1 });
    });

    const res = await fetch(`${baseUrl}/dashboard/metrics`);
    expect(res.status).toBe(200);

    const body = await res.json();

    expect(body.data.relative_demand).toEqual({
      today_count: 3,
      historical_avg_count: 0,
      ratio_pct: 0,
      delta_pct: 0,
      sample_size: 5,
      mode: 'same_weekday_until_now',
      has_enough_data: false,
    });
  });
});
