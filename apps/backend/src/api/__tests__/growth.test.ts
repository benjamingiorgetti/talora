// @ts-nocheck
import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import express from 'express';
import type { Server } from 'http';
import { TEST_IDS, makeClient } from '../../__test-utils__/factories';

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

const mockBroadcast = mock(() => {});
mock.module('../../ws/server', () => ({
  broadcast: mockBroadcast,
}));

const mockSendText = mock(() => Promise.resolve({}));
mock.module('../../evolution/client', () => ({
  EvolutionClient: class {
    sendText = mockSendText;
  },
}));

const mockGetConnectedInstance = mock(() =>
  Promise.resolve({ evolution_instance_name: 'test-instance' })
);
mock.module('../../evolution/helpers', () => ({
  getConnectedInstance: mockGetConnectedInstance,
}));

// Mock getAtRiskClients and sendReactivationMessage from growth modules
const mockGetAtRiskClients = mock(() =>
  Promise.resolve({ data: [], total: 0, page: 1, limit: 20 })
);
mock.module('../../growth/analytics', () => ({
  getAtRiskClients: mockGetAtRiskClients,
}));

const mockSendReactivationMessage = mock(() =>
  Promise.resolve({ success: true, reactivationId: 'react-id' })
);
mock.module('../../growth/reactivation', () => ({
  sendReactivationMessage: mockSendReactivationMessage,
  generateReactivationMessage: mock(() => 'generated message'),
}));

const mockListPendingOpportunities = mock(() =>
  Promise.resolve({ data: [], total: 0, page: 1, limit: 10 })
);
const mockSendOpportunityCandidate = mock(() =>
  Promise.resolve({ success: true, reactivationId: 'sf-react-id' })
);
const mockDismissOpportunity = mock(() => Promise.resolve());

mock.module('../../growth/slot-fill-actions', () => ({
  listPendingOpportunities: mockListPendingOpportunities,
  sendOpportunityCandidate: mockSendOpportunityCandidate,
  dismissOpportunity: mockDismissOpportunity,
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
    // If no authorization header, simulate 401
    if (req.headers['x-skip-auth'] === 'true') {
      _res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = { ...TEST_USER, ...(req.headers['x-test-user'] ? JSON.parse(req.headers['x-test-user'] as string) : {}) };
    next();
  }),
  requireCompanyScope: mock((_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  }),
  getRequestCompanyId: mock((req: express.Request) => {
    return (req.user as typeof TEST_USER)?.companyId ?? null;
  }),
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { growthRouter } = await import('../growth');

// ---------------------------------------------------------------------------
// Test app + server lifecycle
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use('/growth', growthRouter);

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
  mockBroadcast.mockReset();
  mockSendText.mockReset();
  mockSendText.mockImplementation(() => Promise.resolve({}));
  mockGetConnectedInstance.mockReset();
  mockGetConnectedInstance.mockImplementation(() =>
    Promise.resolve({ evolution_instance_name: 'test-instance' })
  );
  mockGetAtRiskClients.mockReset();
  mockGetAtRiskClients.mockImplementation(() =>
    Promise.resolve({ data: [], total: 0, page: 1, limit: 20 })
  );
  mockSendReactivationMessage.mockReset();
  mockSendReactivationMessage.mockImplementation(() =>
    Promise.resolve({ success: true, reactivationId: 'react-id' })
  );
  mockListPendingOpportunities.mockReset();
  mockListPendingOpportunities.mockImplementation(() =>
    Promise.resolve({ data: [], total: 0, page: 1, limit: 10 })
  );
  mockSendOpportunityCandidate.mockReset();
  mockSendOpportunityCandidate.mockImplementation(() =>
    Promise.resolve({ success: true, reactivationId: 'sf-react-id' })
  );
  mockDismissOpportunity.mockReset();
  mockDismissOpportunity.mockImplementation(() => Promise.resolve());
});

// ---------------------------------------------------------------------------
// GET /growth/at-risk
// ---------------------------------------------------------------------------

describe('GET /growth/at-risk', () => {
  it('should return at-risk clients from getAtRiskClients', async () => {
    const mockData = {
      data: [{ client_id: TEST_IDS.CLIENT_A, risk_score: 50, client_name: 'Test Client' }],
      total: 1,
      page: 1,
      limit: 20,
    };
    mockGetAtRiskClients.mockImplementation(() => Promise.resolve(mockData));

    const res = await fetch(`${baseUrl}/growth/at-risk`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('should pass refresh param to getAtRiskClients', async () => {
    await fetch(`${baseUrl}/growth/at-risk?refresh=true`);

    expect(mockGetAtRiskClients).toHaveBeenCalledTimes(1);
    const callArgs = mockGetAtRiskClients.mock.calls[0] as unknown[];
    expect(callArgs[0]).toBe(TEST_COMPANY_ID);
    expect((callArgs[1] as { refresh: boolean }).refresh).toBe(true);
  });

  it('should pass page and limit params', async () => {
    await fetch(`${baseUrl}/growth/at-risk?page=2&limit=10`);

    const callArgs = mockGetAtRiskClients.mock.calls[0] as unknown[];
    const opts = callArgs[1] as { page: number; limit: number };
    expect(opts.page).toBe(2);
    expect(opts.limit).toBe(10);
  });

  it('should return 500 when getAtRiskClients throws', async () => {
    mockGetAtRiskClients.mockImplementation(() => {
      throw new Error('DB error');
    });

    const res = await fetch(`${baseUrl}/growth/at-risk`);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// GET /growth/at-risk/:id
// ---------------------------------------------------------------------------

describe('GET /growth/at-risk/:id', () => {
  it('should return single client analytics with recent appointments', async () => {
    const analyticsRow = {
      client_id: TEST_IDS.CLIENT_A,
      risk_score: 50,
      client_name: 'Test Client',
      client_phone: '5491155550000',
    };
    const appointmentRow = {
      id: TEST_IDS.APPT_A,
      professional_name: 'Pro Test',
      service_name: 'Corte',
    };

    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('client_analytics ca') && s.includes('LIMIT 1')) {
        return Promise.resolve({ rows: [analyticsRow], rowCount: 1 });
      }
      if (s.includes('FROM appointments a') && s.includes('LIMIT 5')) {
        return Promise.resolve({ rows: [appointmentRow], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/growth/at-risk/${TEST_IDS.CLIENT_A}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.client_name).toBe('Test Client');
    expect(body.data.recent_appointments).toHaveLength(1);
  });

  it('should return 404 when client analytics not found', async () => {
    mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));

    const res = await fetch(`${baseUrl}/growth/at-risk/nonexistent-id`);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain('not found');
  });
});

// ---------------------------------------------------------------------------
// POST /growth/reactivation/send
// ---------------------------------------------------------------------------

describe('POST /growth/reactivation/send', () => {
  it('should send reactivation message and return reactivationId', async () => {
    const res = await fetch(`${baseUrl}/growth/reactivation/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: TEST_IDS.CLIENT_A }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.reactivationId).toBe('react-id');
    expect(mockSendReactivationMessage).toHaveBeenCalledTimes(1);
  });

  it('should return 400 when clientId is missing', async () => {
    const res = await fetch(`${baseUrl}/growth/reactivation/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('clientId');
  });

  it('should return error status from sendReactivationMessage on failure', async () => {
    mockSendReactivationMessage.mockImplementation(() =>
      Promise.resolve({ success: false, error: 'Rate limit', status: 429 })
    );

    const res = await fetch(`${baseUrl}/growth/reactivation/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: TEST_IDS.CLIENT_A }),
    });
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toContain('Rate limit');
  });

  it('should pass messageText to sendReactivationMessage', async () => {
    await fetch(`${baseUrl}/growth/reactivation/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: TEST_IDS.CLIENT_A, messageText: 'Custom msg' }),
    });

    const callArgs = mockSendReactivationMessage.mock.calls[0] as unknown[];
    expect(callArgs[2]).toBe('Custom msg');
  });
});

// ---------------------------------------------------------------------------
// POST /growth/reactivation/bulk
// ---------------------------------------------------------------------------

describe('POST /growth/reactivation/bulk', () => {
  it('should send to multiple clients and return summary', async () => {
    const res = await fetch(`${baseUrl}/growth/reactivation/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientIds: ['c1', 'c2', 'c3'] }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.sent).toBe(3);
    expect(body.data.failed).toBe(0);
    expect(mockSendReactivationMessage).toHaveBeenCalledTimes(3);
  });

  it('should stop on rate limit error', async () => {
    let callCount = 0;
    mockSendReactivationMessage.mockImplementation(() => {
      callCount++;
      if (callCount >= 2) {
        return Promise.resolve({ success: false, error: 'Rate limit', status: 429 });
      }
      return Promise.resolve({ success: true, reactivationId: `r-${callCount}` });
    });

    const res = await fetch(`${baseUrl}/growth/reactivation/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientIds: ['c1', 'c2', 'c3', 'c4'] }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.sent).toBe(1);
    // Stops after rate limit — c3 and c4 should NOT be attempted
    expect(mockSendReactivationMessage).toHaveBeenCalledTimes(2);
  });

  it('should return 400 when clientIds is not an array', async () => {
    const res = await fetch(`${baseUrl}/growth/reactivation/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientIds: 'not-array' }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('clientIds');
  });

  it('should return 400 when clientIds is empty', async () => {
    const res = await fetch(`${baseUrl}/growth/reactivation/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientIds: [] }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /growth/reactivation
// ---------------------------------------------------------------------------

describe('GET /growth/reactivation', () => {
  it('should return paginated reactivation messages', async () => {
    const msgRow = {
      id: 'rm-1',
      company_id: TEST_COMPANY_ID,
      client_id: TEST_IDS.CLIENT_A,
      status: 'sent',
      client_name: 'Test Client',
      client_phone: '5491155550000',
    };

    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('FROM reactivation_messages rm') && s.includes('ORDER BY')) {
        return Promise.resolve({ rows: [msgRow], rowCount: 1 });
      }
      if (s.includes('COUNT(*)::text')) {
        return Promise.resolve({ rows: [{ count: '1' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/growth/reactivation`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('should filter by status query param', async () => {
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
      const s = String(sql);
      if (s.includes('FROM reactivation_messages rm') && s.includes('ORDER BY')) {
        // Verify status filter is applied
        if (params && params.length > 1) {
          expect(params[1]).toBe('converted');
        }
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      if (s.includes('COUNT(*)::text')) {
        return Promise.resolve({ rows: [{ count: '0' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/growth/reactivation?status=converted`);

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /growth/stats
// ---------------------------------------------------------------------------

describe('GET /growth/stats', () => {
  it('should return correct growth stats aggregations', async () => {
    const statsRow = {
      clients_at_risk: 15,
      messages_sent: 10,
      clients_reactivated: 3,
      conversion_rate: '30.0',
      revenue_attributed: '45000.00',
      avg_days_to_convert: '2.5',
    };

    mockQuery.mockImplementation((sql: string) => {
      if (String(sql).includes('clients_at_risk')) {
        return Promise.resolve({ rows: [statsRow], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/growth/stats`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.clients_at_risk).toBe(15);
    expect(body.data.messages_sent).toBe(10);
    expect(body.data.clients_reactivated).toBe(3);
    expect(body.data.conversion_rate).toBe(30.0);
    expect(body.data.revenue_attributed).toBe(45000);
  });

  it('should accept custom from/to query params', async () => {
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
      if (String(sql).includes('clients_at_risk')) {
        // Verify custom date params
        expect(params![1]).toBe('2026-01-01');
        expect(params![2]).toBe('2026-02-01');
        return Promise.resolve({
          rows: [{
            clients_at_risk: 0, messages_sent: 0, clients_reactivated: 0,
            conversion_rate: '0', revenue_attributed: '0', avg_days_to_convert: '0',
          }],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/growth/stats?from=2026-01-01&to=2026-02-01`);

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /growth/settings
// ---------------------------------------------------------------------------

describe('GET /growth/settings', () => {
  it('should return company settings', async () => {
    const settingsRow = {
      reactivation_enabled: true,
      reactivation_threshold_days: 14,
      reactivation_auto_send: false,
      reactivation_message_template: 'Custom template',
    };

    mockQuery.mockImplementation((sql: string) => {
      if (String(sql).includes('FROM company_settings')) {
        return Promise.resolve({ rows: [settingsRow], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/growth/settings`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.reactivation_enabled).toBe(true);
    expect(body.data.reactivation_threshold_days).toBe(14);
  });

  it('should return defaults when no settings exist', async () => {
    mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));

    const res = await fetch(`${baseUrl}/growth/settings`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.reactivation_enabled).toBe(false);
    expect(body.data.reactivation_threshold_days).toBe(7);
    expect(body.data.reactivation_auto_send).toBe(false);
    expect(body.data.reactivation_message_template).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PUT /growth/settings
// ---------------------------------------------------------------------------

describe('PUT /growth/settings', () => {
  it('should update settings and return updated values', async () => {
    const updatedSettings = {
      reactivation_enabled: true,
      reactivation_threshold_days: 21,
      reactivation_auto_send: true,
      reactivation_message_template: 'New template {{client_name}}',
    };

    mockQuery.mockImplementation((sql: string) => {
      if (String(sql).includes('INSERT INTO company_settings')) {
        return Promise.resolve({ rows: [updatedSettings], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/growth/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSettings),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.reactivation_enabled).toBe(true);
    expect(body.data.reactivation_auto_send).toBe(true);
  });

  it('should return 403 for non-admin roles', async () => {
    const res = await fetch(`${baseUrl}/growth/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user': JSON.stringify({ role: 'professional' }),
      },
      body: JSON.stringify({ reactivation_enabled: true }),
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('admin_empresa');
  });
});

// ---------------------------------------------------------------------------
// GET /growth/slot-fill/opportunities
// ---------------------------------------------------------------------------

describe('GET /growth/slot-fill/opportunities', () => {
  it('should return pending opportunities', async () => {
    const mockData = {
      data: [{ id: 'opp-1', service_name: 'Corte', status: 'pending', candidates: [] }],
      total: 1,
      page: 1,
      limit: 10,
    };
    mockListPendingOpportunities.mockImplementation(() => Promise.resolve(mockData));

    const res = await fetch(`${baseUrl}/growth/slot-fill/opportunities`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(mockListPendingOpportunities).toHaveBeenCalledTimes(1);
    const callArgs = mockListPendingOpportunities.mock.calls[0] as unknown[];
    expect(callArgs[0]).toBe(TEST_COMPANY_ID);
  });

  it('should pass page and limit params', async () => {
    await fetch(`${baseUrl}/growth/slot-fill/opportunities?page=2&limit=5`);

    const callArgs = mockListPendingOpportunities.mock.calls[0] as unknown[];
    const opts = callArgs[1] as { page: number; limit: number };
    expect(opts.page).toBe(2);
    expect(opts.limit).toBe(5);
  });

  it('should return 500 when list throws', async () => {
    mockListPendingOpportunities.mockImplementation(() => { throw new Error('DB error'); });

    const res = await fetch(`${baseUrl}/growth/slot-fill/opportunities`);
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /growth/slot-fill/opportunities/:id/send
// ---------------------------------------------------------------------------

describe('POST /growth/slot-fill/opportunities/:id/send', () => {
  it('should send message to candidate and return reactivationId', async () => {
    const res = await fetch(`${baseUrl}/growth/slot-fill/opportunities/opp-1/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId: 'cand-1', messageText: 'Hola!' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.reactivationId).toBe('sf-react-id');
    expect(mockSendOpportunityCandidate).toHaveBeenCalledTimes(1);
    const callArgs = mockSendOpportunityCandidate.mock.calls[0] as unknown[];
    expect(callArgs[0]).toBe(TEST_COMPANY_ID);
    expect(callArgs[1]).toBe('opp-1');
    expect(callArgs[2]).toBe('cand-1');
    expect(callArgs[3]).toBe('Hola!');
  });

  it('should return 400 when candidateId is missing', async () => {
    const res = await fetch(`${baseUrl}/growth/slot-fill/opportunities/opp-1/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('candidateId');
  });

  it('should forward error status from sendOpportunityCandidate', async () => {
    mockSendOpportunityCandidate.mockImplementation(() =>
      Promise.resolve({ success: false, error: 'Slot has already passed', status: 410 })
    );

    const res = await fetch(`${baseUrl}/growth/slot-fill/opportunities/opp-1/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId: 'cand-1' }),
    });
    const body = await res.json();

    expect(res.status).toBe(410);
    expect(body.error).toContain('already passed');
  });
});

// ---------------------------------------------------------------------------
// POST /growth/slot-fill/opportunities/:id/dismiss
// ---------------------------------------------------------------------------

describe('POST /growth/slot-fill/opportunities/:id/dismiss', () => {
  it('should dismiss opportunity', async () => {
    const res = await fetch(`${baseUrl}/growth/slot-fill/opportunities/opp-1/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.dismissed).toBe(true);
    expect(mockDismissOpportunity).toHaveBeenCalledTimes(1);
    const callArgs = mockDismissOpportunity.mock.calls[0] as unknown[];
    expect(callArgs[0]).toBe(TEST_COMPANY_ID);
    expect(callArgs[1]).toBe('opp-1');
  });

  it('should return 500 when dismiss throws', async () => {
    mockDismissOpportunity.mockImplementation(() => { throw new Error('DB error'); });

    const res = await fetch(`${baseUrl}/growth/slot-fill/opportunities/opp-1/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Auth: all endpoints return 401 without auth
// ---------------------------------------------------------------------------

describe('Auth enforcement', () => {
  const endpoints = [
    { method: 'GET', path: '/growth/at-risk' },
    { method: 'GET', path: '/growth/at-risk/some-id' },
    { method: 'POST', path: '/growth/reactivation/send' },
    { method: 'POST', path: '/growth/reactivation/bulk' },
    { method: 'GET', path: '/growth/reactivation' },
    { method: 'GET', path: '/growth/stats' },
    { method: 'GET', path: '/growth/settings' },
    { method: 'PUT', path: '/growth/settings' },
    { method: 'GET', path: '/growth/slot-fill/opportunities' },
    { method: 'POST', path: '/growth/slot-fill/opportunities/opp-1/send' },
    { method: 'POST', path: '/growth/slot-fill/opportunities/opp-1/dismiss' },
  ];

  for (const { method, path } of endpoints) {
    it(`should return 401 for ${method} ${path} without auth`, async () => {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-skip-auth': 'true',
        },
        ...(method === 'POST' || method === 'PUT' ? { body: JSON.stringify({}) } : {}),
      });

      expect(res.status).toBe(401);
    });
  }
});
