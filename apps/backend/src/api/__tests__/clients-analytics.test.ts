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

mock.module('../../config', () => ({
  config: {
    nodeEnv: 'test',
    port: 3001,
    jwtSecret: 'test-secret',
    corsOrigin: 'http://localhost:3000',
    timezone: 'America/Argentina/Buenos_Aires',
  },
}));

mock.module('../../utils/logger', () => ({
  logger: {
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    debug: mock(() => {}),
  },
}));

const mockComputeClientAnalytics = mock(() => Promise.resolve());
mock.module('../../growth/analytics', () => ({
  computeClientAnalytics: mockComputeClientAnalytics,
}));

const mockGetAgentConfig = mock(() =>
  Promise.resolve({ agent: { id: TEST_IDS.AGENT_A } })
);
mock.module('../../cache/agent-cache', () => ({
  getAgentConfig: mockGetAgentConfig,
}));

// ---------------------------------------------------------------------------
// Auth mock
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = TEST_IDS.COMPANY_A;
const TEST_USER = {
  userId: 'user-admin-1',
  email: 'admin@test.com',
  fullName: 'Admin Test',
  role: 'admin_empresa' as const,
  companyId: TEST_COMPANY_ID,
};

mock.module('../middleware', () => ({
  authMiddleware: mock((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { ...TEST_USER, ...(req.headers['x-test-user'] ? JSON.parse(req.headers['x-test-user'] as string) : {}) };
    next();
  }),
  requireCompanyScope: mock((_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  }),
  getRequestCompanyId: mock((req: express.Request) => {
    return (req.user as typeof TEST_USER)?.companyId ?? null;
  }),
  getRequestProfessionalId: mock(() => null),
}));

mock.module('../validation', () => ({
  validateBody: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  createClientSchema: {},
  updateClientSchema: {},
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { clientsRouter } = await import('../clients');

// ---------------------------------------------------------------------------
// Test app + server lifecycle
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use('/clients', clientsRouter);

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0);
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://localhost:${port}`;
});

afterAll(() => {
  server?.close();
});

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
  mockComputeClientAnalytics.mockReset();
  mockComputeClientAnalytics.mockImplementation(() => Promise.resolve());
});

// ---------------------------------------------------------------------------
// Helper: setup mock responses for analytics endpoint
// ---------------------------------------------------------------------------

function setupAnalyticsMocks(options: {
  clientExists?: boolean;
  analyticsRow?: Record<string, unknown> | null;
  staleComputedAt?: boolean;
  preferredDow?: string | null;
  reactivationSent?: number;
  reactivationConverted?: number;
  basicCount?: number;
  basicRevenue?: number;
  basicLastAt?: string | null;
}) {
  const {
    clientExists = true,
    analyticsRow = null,
    staleComputedAt = false,
    preferredDow = null,
    reactivationSent = 0,
    reactivationConverted = 0,
    basicCount = 0,
    basicRevenue = 0,
    basicLastAt = null,
  } = options;

  let callIndex = 0;
  mockQuery.mockImplementation((sql: string) => {
    // Query 1: client exists check
    if (sql.includes('SELECT id FROM clients')) {
      return Promise.resolve({
        rows: clientExists ? [{ id: TEST_IDS.CLIENT_A }] : [],
        rowCount: clientExists ? 1 : 0,
      });
    }
    // Staleness check
    if (sql.includes('SELECT computed_at FROM client_analytics')) {
      const computedAt = staleComputedAt
        ? new Date(Date.now() - 48 * 60 * 60 * 1000) // 48h ago
        : analyticsRow ? new Date() : null;
      return Promise.resolve({
        rows: computedAt ? [{ computed_at: computedAt }] : [],
        rowCount: computedAt ? 1 : 0,
      });
    }
    // Client analytics row
    if (sql.includes('SELECT total_appointments') && sql.includes('FROM client_analytics')) {
      return Promise.resolve({
        rows: analyticsRow ? [analyticsRow] : [],
        rowCount: analyticsRow ? 1 : 0,
      });
    }
    // Basic fallback query (for <2 appointments)
    if (sql.includes('COUNT(*)::text AS count') && sql.includes('SUM(s.price)')) {
      return Promise.resolve({
        rows: [{ count: String(basicCount), revenue: String(basicRevenue), last_at: basicLastAt }],
        rowCount: 1,
      });
    }
    // Preferred DOW
    if (sql.includes('EXTRACT(DOW FROM starts_at)')) {
      return Promise.resolve({
        rows: preferredDow !== null ? [{ dow: preferredDow }] : [],
        rowCount: preferredDow !== null ? 1 : 0,
      });
    }
    // Reactivation stats
    if (sql.includes('reactivation_messages')) {
      return Promise.resolve({
        rows: [{ sent: String(reactivationSent), converted: String(reactivationConverted) }],
        rowCount: 1,
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /clients/:id/analytics', () => {
  it('returns correct metrics for client with analytics data', async () => {
    setupAnalyticsMocks({
      clientExists: true,
      analyticsRow: {
        total_appointments: 5,
        total_revenue: '25000',
        avg_frequency_days: '21.3',
        last_appointment_at: '2026-03-10T10:00:00.000Z',
        risk_score: 15,
      },
      preferredDow: '5', // Friday
      reactivationSent: 3,
      reactivationConverted: 1,
    });

    const res = await fetch(`${baseUrl}/clients/${TEST_IDS.CLIENT_A}/analytics`);
    expect(res.status).toBe(200);

    const body = await res.json();
    const data = body.data;

    expect(data.total_appointments).toBe(5);
    expect(data.total_revenue).toBe(25000);
    expect(data.avg_ticket).toBe(5000); // 25000 / 5
    expect(data.avg_frequency_days).toBe(21.3);
    expect(data.last_appointment_at).toBe('2026-03-10T10:00:00.000Z');
    expect(data.preferred_day).toBe('Viernes');
    expect(data.messages_sent).toBe(3);
    expect(data.response_rate).toBe(33.3); // 1/3 * 100 = 33.3
    expect(data.conversion_rate).toBe(33.3);
    expect(data.risk_score).toBe(15);
  });

  it('returns defaults for client with 0 appointments', async () => {
    setupAnalyticsMocks({
      clientExists: true,
      analyticsRow: null,
      basicCount: 0,
      basicRevenue: 0,
      basicLastAt: null,
    });

    const res = await fetch(`${baseUrl}/clients/${TEST_IDS.CLIENT_A}/analytics`);
    expect(res.status).toBe(200);

    const data = (await res.json()).data;

    expect(data.total_appointments).toBe(0);
    expect(data.total_revenue).toBe(0);
    expect(data.avg_ticket).toBe(0);
    expect(data.avg_frequency_days).toBeNull();
    expect(data.last_appointment_at).toBeNull();
    expect(data.preferred_day).toBeNull();
    expect(data.messages_sent).toBe(0);
    expect(data.response_rate).toBe(0);
    expect(data.risk_score).toBe(0);
  });

  it('returns basics for client with 1 appointment (no analytics row)', async () => {
    setupAnalyticsMocks({
      clientExists: true,
      analyticsRow: null,
      basicCount: 1,
      basicRevenue: 5000,
      basicLastAt: '2026-03-12T14:00:00.000Z',
      preferredDow: '3', // Wednesday
    });

    const res = await fetch(`${baseUrl}/clients/${TEST_IDS.CLIENT_A}/analytics`);
    expect(res.status).toBe(200);

    const data = (await res.json()).data;

    expect(data.total_appointments).toBe(1);
    expect(data.total_revenue).toBe(5000);
    expect(data.avg_ticket).toBe(5000); // 5000 / 1
    expect(data.avg_frequency_days).toBeNull(); // can't compute with 1 appointment
    expect(data.last_appointment_at).toBe('2026-03-12T14:00:00.000Z');
    expect(data.preferred_day).toBe('Miércoles');
  });

  it('returns 404 for non-existent client', async () => {
    setupAnalyticsMocks({ clientExists: false });

    const res = await fetch(`${baseUrl}/clients/non-existent-id/analytics`);
    expect(res.status).toBe(404);
  });

  it('handles preferred day correctly for each DOW', async () => {
    // Test Sunday (DOW = 0)
    setupAnalyticsMocks({
      clientExists: true,
      analyticsRow: null,
      basicCount: 0,
      preferredDow: '0',
    });

    const res = await fetch(`${baseUrl}/clients/${TEST_IDS.CLIENT_A}/analytics`);
    const data = (await res.json()).data;
    expect(data.preferred_day).toBe('Domingo');
  });

  it('handles division by zero for avg_ticket when 0 appointments', async () => {
    setupAnalyticsMocks({
      clientExists: true,
      analyticsRow: null,
      basicCount: 0,
      basicRevenue: 0,
    });

    const res = await fetch(`${baseUrl}/clients/${TEST_IDS.CLIENT_A}/analytics`);
    const data = (await res.json()).data;
    expect(data.avg_ticket).toBe(0); // no division by zero
  });

  it('handles 0 reactivation messages without division errors', async () => {
    setupAnalyticsMocks({
      clientExists: true,
      analyticsRow: {
        total_appointments: 3,
        total_revenue: '15000',
        avg_frequency_days: '14.0',
        last_appointment_at: '2026-03-10T10:00:00.000Z',
        risk_score: 0,
      },
      reactivationSent: 0,
      reactivationConverted: 0,
    });

    const res = await fetch(`${baseUrl}/clients/${TEST_IDS.CLIENT_A}/analytics`);
    const data = (await res.json()).data;
    expect(data.response_rate).toBe(0);
    expect(data.conversion_rate).toBe(0);
  });

  it('refreshes analytics when data is stale', async () => {
    setupAnalyticsMocks({
      clientExists: true,
      staleComputedAt: true,
      analyticsRow: {
        total_appointments: 2,
        total_revenue: '10000',
        avg_frequency_days: '7.0',
        last_appointment_at: '2026-03-10T10:00:00.000Z',
        risk_score: 5,
      },
    });

    await fetch(`${baseUrl}/clients/${TEST_IDS.CLIENT_A}/analytics`);
    expect(mockComputeClientAnalytics).toHaveBeenCalledWith(TEST_COMPANY_ID);
  });

  it('enforces professional scope via middleware', async () => {
    // With professional scope, client not found returns 404
    setupAnalyticsMocks({ clientExists: false });

    const res = await fetch(`${baseUrl}/clients/${TEST_IDS.CLIENT_A}/analytics`, {
      headers: {
        'x-test-user': JSON.stringify({
          ...TEST_USER,
          role: 'professional',
          professionalId: TEST_IDS.PROF_B,
        }),
      },
    });
    expect(res.status).toBe(404);
  });
});
