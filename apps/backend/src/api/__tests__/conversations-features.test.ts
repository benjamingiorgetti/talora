// @ts-nocheck
/**
 * Conversations feature tests: state filtering, traces, pause/resume, manual send.
 * Validates BASE-5, BASE-6a, BASE-6b.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import express from 'express';
import type { Server } from 'http';
import { TEST_IDS, makeConversation } from '../../__test-utils__/factories';

// Valid UUID for routes with isValidUuid validation
const VALID_CONV_ID = 'aaaaaaaa-1111-2222-3333-444444444444';

// ---------------------------------------------------------------------------
// Mocks — BEFORE any dynamic imports
// ---------------------------------------------------------------------------
const mockQuery = mock(() => Promise.resolve({ rows: [], rowCount: 0 }));
const mockArchiveStale = mock(() => Promise.resolve());

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
    evolutionApiUrl: 'http://localhost:8080',
    evolutionApiKey: 'test-key',
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
  EvolutionApiError: class extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
}));

mock.module('../../calendar/client', () => ({
  hasCalendarAccess: mock(() => Promise.resolve(true)),
}));

mock.module('../../conversations/archive', () => ({
  archiveStaleConversations: mockArchiveStale,
}));

// ---------------------------------------------------------------------------
// Switchable user context
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
// Dynamic imports AFTER mocks
// ---------------------------------------------------------------------------
const { conversationsRouter } = await import('../conversations');

// ---------------------------------------------------------------------------
// Test app + server lifecycle
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());
app.use('/conversations', conversationsRouter);

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
  mockArchiveStale.mockReset();
  mockArchiveStale.mockImplementation(() => Promise.resolve());
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
function captureQueries(): Array<{ sql: string; params: unknown[] }> {
  const captured: Array<{ sql: string; params: unknown[] }> = [];
  mockQuery.mockImplementation((sql: unknown, params: unknown) => {
    captured.push({ sql: String(sql), params: Array.isArray(params) ? params : [] });
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
  return captured;
}

// ---------------------------------------------------------------------------
// Tests: GET /conversations — state filtering
// ---------------------------------------------------------------------------
describe('GET /conversations — state filtering', () => {
  it('state=active includes archived_at IS NULL in query', async () => {
    const captured = captureQueries();

    await fetch(`${baseUrl}/conversations?state=active`);

    const mainQuery = captured.find((q) => q.sql.includes('FROM conversations'));
    expect(mainQuery).toBeDefined();
    expect(mainQuery!.sql).toContain('archived_at IS NULL');
  });

  it('state=archived includes archived_at IS NOT NULL in query', async () => {
    const captured = captureQueries();

    await fetch(`${baseUrl}/conversations?state=archived`);

    const mainQuery = captured.find((q) => q.sql.includes('FROM conversations'));
    expect(mainQuery).toBeDefined();
    expect(mainQuery!.sql).toContain('archived_at IS NOT NULL');
  });

  it('state=all omits archive filter', async () => {
    const captured = captureQueries();

    await fetch(`${baseUrl}/conversations?state=all`);

    const mainQuery = captured.find((q) => q.sql.includes('FROM conversations'));
    expect(mainQuery).toBeDefined();
    expect(mainQuery!.sql).not.toContain('archived_at IS NULL');
    expect(mainQuery!.sql).not.toContain('archived_at IS NOT NULL');
  });

  it('calls archiveStaleConversations before query', async () => {
    captureQueries();

    await fetch(`${baseUrl}/conversations?state=active`);

    expect(mockArchiveStale).toHaveBeenCalledTimes(1);
    expect(mockArchiveStale.mock.calls[0][0]).toBe(TEST_IDS.COMPANY_A);
  });

  it('defaults to state=active when no state param', async () => {
    const captured = captureQueries();

    await fetch(`${baseUrl}/conversations`);

    const mainQuery = captured.find((q) => q.sql.includes('FROM conversations'));
    expect(mainQuery!.sql).toContain('archived_at IS NULL');
  });
});

// ---------------------------------------------------------------------------
// Tests: GET /:id/traces
// ---------------------------------------------------------------------------
describe('GET /conversations/:id/traces', () => {
  it('returns traces scoped by company_id', async () => {
    const captured = captureQueries();
    // First query: scope check returns a row
    mockQuery.mockImplementation((sql: unknown) => {
      const s = String(sql);
      if (s.includes('SELECT id FROM conversations')) {
        return Promise.resolve({ rows: [{ id: VALID_CONV_ID }], rowCount: 1 });
      }
      captured.push({ sql: s, params: [] });
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/conversations/${VALID_CONV_ID}/traces`);
    expect(res.status).toBe(200);

    const tracesQuery = mockQuery.mock.calls.find(
      (c) => String(c[0]).includes('agent_message_traces')
    );
    expect(tracesQuery).toBeDefined();
    expect(String(tracesQuery![0])).toContain('company_id = $2');
  });

  it('returns 404 when conversation not in company', async () => {
    // Scope check returns no rows
    mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));

    const res = await fetch(`${baseUrl}/conversations/${VALID_CONV_ID}/traces`);
    expect(res.status).toBe(404);
  });

  it('scopes by professional_id for professional role', async () => {
    currentUser = {
      userId: 'user-prof-a',
      email: 'prof-a@test.com',
      fullName: 'Prof A',
      role: 'professional',
      companyId: TEST_IDS.COMPANY_A,
      professionalId: TEST_IDS.PROF_A,
    };

    mockQuery.mockImplementation((sql: unknown) => {
      if (String(sql).includes('SELECT id FROM conversations')) {
        return Promise.resolve({ rows: [{ id: VALID_CONV_ID }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await fetch(`${baseUrl}/conversations/${VALID_CONV_ID}/traces`);

    const scopeQuery = mockQuery.mock.calls.find(
      (c) => String(c[0]).includes('SELECT id FROM conversations')
    );
    expect(String(scopeQuery![0])).toContain('professional_id');
    expect(scopeQuery![1]).toContain(TEST_IDS.PROF_A);
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /:id/pause & resume
// ---------------------------------------------------------------------------
describe('POST /conversations/:id/pause', () => {
  it('sets bot_paused=true in SQL', async () => {
    const fakeConv = makeConversation({ bot_paused: true });
    mockQuery.mockImplementation(() => Promise.resolve({ rows: [fakeConv], rowCount: 1 }));

    const res = await fetch(`${baseUrl}/conversations/${VALID_CONV_ID}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const pauseQuery = mockQuery.mock.calls.find(
      (c) => String(c[0]).includes('bot_paused = true')
    );
    expect(pauseQuery).toBeDefined();
  });
});

describe('POST /conversations/:id/resume', () => {
  it('sets bot_paused=false in SQL', async () => {
    const fakeConv = makeConversation({ bot_paused: false });
    mockQuery.mockImplementation(() => Promise.resolve({ rows: [fakeConv], rowCount: 1 }));

    const res = await fetch(`${baseUrl}/conversations/${VALID_CONV_ID}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status).toBe(200);
    const resumeQuery = mockQuery.mock.calls.find(
      (c) => String(c[0]).includes('bot_paused = false')
    );
    expect(resumeQuery).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: POST /:id/messages/manual
// ---------------------------------------------------------------------------
describe('POST /conversations/:id/messages/manual', () => {
  it('returns 409 when conversation is archived', async () => {
    const archivedConv = makeConversation({
      archived_at: '2026-01-01T00:00:00Z',
      evolution_instance_name: 'test-inst',
      instance_status: 'connected',
    });

    mockQuery.mockImplementation((sql: unknown) => {
      if (String(sql).includes('SELECT c.*')) {
        return Promise.resolve({ rows: [archivedConv], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/conversations/${VALID_CONV_ID}/messages/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hola' }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('CONVERSATION_ARCHIVED');
  });

  it('sends message via Evolution and returns 201 on success', async () => {
    const connectedConv = makeConversation({
      archived_at: null,
      bot_paused: false,
      auto_resume_at: null,
      evolution_instance_name: 'test-inst',
      instance_status: 'connected',
      phone_number: '5491155550000',
    });
    const fakeMessage = { id: 'msg-new', conversation_id: VALID_CONV_ID, role: 'assistant', content: 'Hola' };

    mockQuery.mockImplementation((sql: unknown) => {
      const s = String(sql);
      if (s.includes('SELECT c.*')) {
        return Promise.resolve({ rows: [connectedConv], rowCount: 1 });
      }
      if (s.includes('INSERT INTO messages')) {
        return Promise.resolve({ rows: [fakeMessage], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/conversations/${VALID_CONV_ID}/messages/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hola' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe('msg-new');
    expect(body.data.role).toBe('assistant');

    // Verify it saved the message and updated last_message_at
    const insertCall = mockQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO messages'));
    expect(insertCall).toBeDefined();
    const updateCall = mockQuery.mock.calls.find((c) => String(c[0]).includes('UPDATE conversations SET last_message_at'));
    expect(updateCall).toBeDefined();
    const pauseCall = mockQuery.mock.calls.find(
      (c) =>
        String(c[0]).includes('SET bot_paused = true') &&
        String(c[0]).includes("auto_resume_at = NOW() + INTERVAL '30 minutes'")
    );
    expect(pauseCall).toBeDefined();
  });

  it('restarts the 30 minute pause window when sending another manual message', async () => {
    const pausedConv = makeConversation({
      archived_at: null,
      bot_paused: true,
      auto_resume_at: '2026-03-17T12:10:00.000Z',
      evolution_instance_name: 'test-inst',
      instance_status: 'connected',
      phone_number: '5491155550000',
    });
    const fakeMessage = { id: 'msg-restart', conversation_id: VALID_CONV_ID, role: 'assistant', content: 'Seguimos' };

    mockQuery.mockImplementation((sql: unknown) => {
      const s = String(sql);
      if (s.includes('SELECT c.*')) {
        return Promise.resolve({ rows: [pausedConv], rowCount: 1 });
      }
      if (s.includes('INSERT INTO messages')) {
        return Promise.resolve({ rows: [fakeMessage], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/conversations/${VALID_CONV_ID}/messages/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Seguimos' }),
    });

    expect(res.status).toBe(201);
    const pauseCall = mockQuery.mock.calls.find(
      (c) =>
        String(c[0]).includes('SET bot_paused = true') &&
        String(c[0]).includes("auto_resume_at = NOW() + INTERVAL '30 minutes'")
    );
    expect(pauseCall).toBeDefined();
  });

  it('pauses the bot for 30 minutes after sending a manual message', async () => {
    const connectedConv = makeConversation({
      archived_at: null,
      evolution_instance_name: 'test-inst',
      instance_status: 'connected',
      phone_number: '5491155550000',
      bot_paused: false,
    });
    const fakeMessage = { id: 'msg-new', conversation_id: VALID_CONV_ID, role: 'assistant', content: 'Hola' };

    mockQuery.mockImplementation((sql: unknown) => {
      const s = String(sql);
      if (s.includes('SELECT c.*')) {
        return Promise.resolve({ rows: [connectedConv], rowCount: 1 });
      }
      if (s.includes('INSERT INTO messages')) {
        return Promise.resolve({ rows: [fakeMessage], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/conversations/${VALID_CONV_ID}/messages/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hola' }),
    });

    expect(res.status).toBe(201);
    const pauseCall = mockQuery.mock.calls.find(
      (c) => String(c[0]).includes('UPDATE conversations')
        && String(c[0]).includes('bot_paused = true')
        && String(c[0]).includes('auto_resume_at')
    );
    expect(pauseCall).toBeDefined();
    expect(String(pauseCall![0])).toContain(`'30 minutes'`);
  });

  it('extends the 30 minute pause window on every manual message', async () => {
    const pausedConv = makeConversation({
      archived_at: null,
      evolution_instance_name: 'test-inst',
      instance_status: 'connected',
      phone_number: '5491155550000',
      bot_paused: true,
      auto_resume_at: '2099-03-17T12:15:00.000Z',
    });
    const fakeMessage = { id: 'msg-new', conversation_id: VALID_CONV_ID, role: 'assistant', content: 'Seguimos' };

    mockQuery.mockImplementation((sql: unknown) => {
      const s = String(sql);
      if (s.includes('SELECT c.*')) {
        return Promise.resolve({ rows: [pausedConv], rowCount: 1 });
      }
      if (s.includes('INSERT INTO messages')) {
        return Promise.resolve({ rows: [fakeMessage], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/conversations/${VALID_CONV_ID}/messages/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Seguimos por aca' }),
    });

    expect(res.status).toBe(201);
    const pauseCalls = mockQuery.mock.calls.filter(
      (c) => String(c[0]).includes('UPDATE conversations')
        && String(c[0]).includes('bot_paused = true')
        && String(c[0]).includes('auto_resume_at')
    );
    expect(pauseCalls).toHaveLength(1);
    expect(String(pauseCalls[0][0])).toContain(`'30 minutes'`);
  });

  it('does not refresh auto_resume_at when the conversation is manually paused indefinitely', async () => {
    const manuallyPausedConv = makeConversation({
      archived_at: null,
      evolution_instance_name: 'test-inst',
      instance_status: 'connected',
      phone_number: '5491155550000',
      bot_paused: true,
      auto_resume_at: null,
    });
    const fakeMessage = { id: 'msg-manual', conversation_id: VALID_CONV_ID, role: 'assistant', content: 'Seguimos' };

    mockQuery.mockImplementation((sql: unknown) => {
      const s = String(sql);
      if (s.includes('SELECT c.*')) {
        return Promise.resolve({ rows: [manuallyPausedConv], rowCount: 1 });
      }
      if (s.includes('INSERT INTO messages')) {
        return Promise.resolve({ rows: [fakeMessage], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/conversations/${VALID_CONV_ID}/messages/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Seguimos por aca' }),
    });

    expect(res.status).toBe(201);
    const temporaryPauseCall = mockQuery.mock.calls.find(
      (c) =>
        String(c[0]).includes('SET bot_paused = true') &&
        String(c[0]).includes("auto_resume_at = NOW() + INTERVAL '30 minutes'")
    );
    expect(temporaryPauseCall).toBeUndefined();
  });

  it('returns 409 when instance is not connected', async () => {
    const disconnectedConv = makeConversation({
      archived_at: null,
      evolution_instance_name: 'test-inst',
      instance_status: 'disconnected',
    });

    mockQuery.mockImplementation((sql: unknown) => {
      if (String(sql).includes('SELECT c.*')) {
        return Promise.resolve({ rows: [disconnectedConv], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await fetch(`${baseUrl}/conversations/${VALID_CONV_ID}/messages/manual`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Hola' }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('INSTANCE_NOT_CONNECTED');
  });
});
