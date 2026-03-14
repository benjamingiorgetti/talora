// @ts-nocheck
/**
 * Multi-tenant isolation tests.
 *
 * Verifies that all major routes correctly scope data by company_id,
 * ensuring one tenant's data is never visible to another.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import express from 'express';
import type { Server } from 'http';
import { TEST_IDS, makeClient, makeProfessional, makeService, makeConversation } from '../../__test-utils__/factories';

// ---------------------------------------------------------------------------
// Mocks — BEFORE any dynamic imports
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
    googleClientId: null,
    googleClientSecret: null,
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

mock.module('../../ws/server', () => ({
  broadcast: mock(() => {}),
}));

mock.module('../../cache/agent-cache', () => ({
  getAgentConfig: mock(() =>
    Promise.resolve({ agent: { id: TEST_IDS.AGENT_A }, sections: [], tools: [], variables: [] }),
  ),
  invalidateAgentCache: mock(() => {}),
}));

mock.module('../../evolution/client', () => ({
  EvolutionClient: class MockEvolutionClient {
    sendText = mock(() => Promise.resolve({ key: { id: 'msg-evo-test' } }));
    getInstanceStatus = mock(() => Promise.resolve({ state: 'open' }));
  },
  EvolutionApiError: class extends Error {},
}));

mock.module('../../calendar/client', () => ({
  hasCalendarAccess: mock(() => Promise.resolve(true)),
}));

mock.module('../../conversations/archive', () => ({
  archiveStaleConversations: mock(() => Promise.resolve()),
}));

// ---------------------------------------------------------------------------
// Switchable user context for middleware mock
// ---------------------------------------------------------------------------

let currentUser: {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  companyId?: string;
  professionalId?: string;
} = {
  userId: 'user-admin-a',
  email: 'admin-a@test.com',
  fullName: 'Admin Company A',
  role: 'admin_empresa',
  companyId: TEST_IDS.COMPANY_A,
};

mock.module('../middleware', () => ({
  authMiddleware: mock((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { ...currentUser };
    next();
  }),
  requireCompanyScope: mock((_req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  }),
  getRequestCompanyId: mock((req: express.Request) => {
    const user = req.user as typeof currentUser;
    if (user?.role === 'superadmin') {
      return (req.query as Record<string, string>).company_id ?? null;
    }
    return user?.companyId ?? null;
  }),
  getRequestProfessionalId: mock((req: express.Request) => {
    const user = req.user as typeof currentUser;
    if (user?.role === 'professional') return user.professionalId ?? null;
    const qp = (req.query as Record<string, unknown>)?.professional_id;
    if (typeof qp === 'string' && qp) return qp;
    return null;
  }),
}));

// ---------------------------------------------------------------------------
// Dynamic imports AFTER mock.module
// ---------------------------------------------------------------------------

const { clientsRouter } = await import('../clients');
const { conversationsRouter } = await import('../conversations');
const { professionalsRouter } = await import('../professionals');
const { servicesRouter } = await import('../services');

// ---------------------------------------------------------------------------
// Test app + server lifecycle
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use('/clients', clientsRouter);
app.use('/conversations', conversationsRouter);
app.use('/professionals', professionalsRouter);
app.use('/services', servicesRouter);

let server: Server;
let baseUrl: string;

beforeAll(() => {
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
  // Reset to company A admin
  currentUser = {
    userId: 'user-admin-a',
    email: 'admin-a@test.com',
    fullName: 'Admin Company A',
    role: 'admin_empresa',
    companyId: TEST_IDS.COMPANY_A,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capture all SQL queries and their params */
function captureQueries(): Array<{ sql: string; params: unknown[] }> {
  const captured: Array<{ sql: string; params: unknown[] }> = [];
  mockQuery.mockImplementation((sql: unknown, params: unknown) => {
    captured.push({ sql: String(sql), params: Array.isArray(params) ? params : [] });
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
  return captured;
}

// ---------------------------------------------------------------------------
// Tests: company_id isolation per route
// ---------------------------------------------------------------------------

describe('Multi-tenant isolation — GET /clients', () => {
  it('should include company_id = COMPANY_A in the SQL query', async () => {
    const captured = captureQueries();

    await fetch(`${baseUrl}/clients`);

    const hasCompanyFilter = captured.some(
      (q) => q.sql.includes('company_id') && q.params.includes(TEST_IDS.COMPANY_A),
    );
    expect(hasCompanyFilter).toBe(true);
  });

  it('should NOT include COMPANY_B in any query when authenticated as COMPANY_A', async () => {
    const captured = captureQueries();

    await fetch(`${baseUrl}/clients`);

    const hasCompanyB = captured.some((q) => q.params.includes(TEST_IDS.COMPANY_B));
    expect(hasCompanyB).toBe(false);
  });
});

describe('Multi-tenant isolation — GET /conversations', () => {
  it('should scope conversations query to the authenticated company', async () => {
    const captured = captureQueries();

    await fetch(`${baseUrl}/conversations`);

    const hasCompanyFilter = captured.some(
      (q) => q.sql.includes('company_id') && q.params.includes(TEST_IDS.COMPANY_A),
    );
    expect(hasCompanyFilter).toBe(true);
  });
});

describe('Multi-tenant isolation — GET /professionals', () => {
  it('should scope professionals query to the authenticated company', async () => {
    const captured = captureQueries();

    await fetch(`${baseUrl}/professionals`);

    const hasCompanyFilter = captured.some(
      (q) => q.sql.includes('company_id') && q.params.includes(TEST_IDS.COMPANY_A),
    );
    expect(hasCompanyFilter).toBe(true);
  });
});

describe('Multi-tenant isolation — GET /services', () => {
  it('should scope services query to the authenticated company', async () => {
    const captured = captureQueries();

    await fetch(`${baseUrl}/services`);

    const hasCompanyFilter = captured.some(
      (q) => q.sql.includes('company_id') && q.params.includes(TEST_IDS.COMPANY_A),
    );
    expect(hasCompanyFilter).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: professional scoping
// ---------------------------------------------------------------------------

describe('Multi-tenant isolation — professional user scoping', () => {
  it('should include professional_id filter when user is a professional', async () => {
    currentUser = {
      userId: 'user-prof-a',
      email: 'prof-a@test.com',
      fullName: 'Prof A',
      role: 'professional',
      companyId: TEST_IDS.COMPANY_A,
      professionalId: TEST_IDS.PROF_A,
    };

    const captured = captureQueries();

    await fetch(`${baseUrl}/clients`);

    // Professional scoping uses the nullable pattern ($X::uuid IS NULL OR professional_id = $X)
    // When professionalId is provided, it should appear in params
    const hasProfFilter = captured.some((q) => q.params.includes(TEST_IDS.PROF_A));
    expect(hasProfFilter).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests: superadmin scoping
// ---------------------------------------------------------------------------

describe('Multi-tenant isolation — superadmin with company_id param', () => {
  it('should scope to the specified company_id query param', async () => {
    currentUser = {
      userId: 'user-superadmin',
      email: 'super@test.com',
      fullName: 'Super Admin',
      role: 'superadmin',
    };

    const captured = captureQueries();

    await fetch(`${baseUrl}/services?company_id=${TEST_IDS.COMPANY_B}`);

    const hasCompanyB = captured.some(
      (q) => q.sql.includes('company_id') && q.params.includes(TEST_IDS.COMPANY_B),
    );
    expect(hasCompanyB).toBe(true);
  });

  it('should NOT leak COMPANY_A data when superadmin queries COMPANY_B', async () => {
    currentUser = {
      userId: 'user-superadmin',
      email: 'super@test.com',
      fullName: 'Super Admin',
      role: 'superadmin',
    };

    const captured = captureQueries();

    await fetch(`${baseUrl}/services?company_id=${TEST_IDS.COMPANY_B}`);

    const hasCompanyA = captured.some((q) => q.params.includes(TEST_IDS.COMPANY_A));
    expect(hasCompanyA).toBe(false);
  });
});
