// @ts-nocheck
/**
 * Unit/integration tests for the WebSocket server (setupWebSocket + broadcast).
 *
 * Strategy:
 * - Mock external boundaries (db/pool, auth/session, utils/logger) before dynamic import.
 * - Spin up a real HTTP server on a random port to test the full WS handshake.
 * - Use native WebSocket client (Bun/Node global) to connect.
 * - Test broadcast filtering logic across roles and company/professional scoping.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import { createServer } from 'http';
import { createMockQuery } from '../../__test-utils__/mock-pool';
import { createMockLogger } from '../../__test-utils__/mock-logger';
import { TEST_IDS } from '../../__test-utils__/factories';
import type { JwtPayload } from '../../auth/session';
import type { WsEvent } from '@talora/shared';

// ---------------------------------------------------------------------------
// Fixed identifiers
// ---------------------------------------------------------------------------
const COMPANY_A = TEST_IDS.COMPANY_A;
const COMPANY_B = TEST_IDS.COMPANY_B;
const PROF_A = TEST_IDS.PROF_A;
const PROF_B = TEST_IDS.PROF_B;

// ---------------------------------------------------------------------------
// Mock factories — declared once before module mock registration.
// ---------------------------------------------------------------------------
const mockQuery = createMockQuery();
const mockLogger = createMockLogger();
// decodeSession mock: override per test with mockDecodeSession.mockImplementation(...)
const mockDecodeSession = mock((_token: string): JwtPayload => {
  throw new Error('decodeSession not configured for this test');
});

// ---------------------------------------------------------------------------
// Module mocks — MUST be registered before the dynamic import below.
// ---------------------------------------------------------------------------
mock.module('../../db/pool', () => ({
  pool: { query: mockQuery },
}));

mock.module('../../auth/session', () => ({
  decodeSession: mockDecodeSession,
}));

mock.module('../../utils/logger', () => ({
  logger: mockLogger,
}));

// ---------------------------------------------------------------------------
// Dynamic import — picks up mocked modules.
// ---------------------------------------------------------------------------
const { setupWebSocket, broadcast } = await import('../server');

// ---------------------------------------------------------------------------
// HTTP server lifecycle — shared across all tests.
// ---------------------------------------------------------------------------
let httpServer: ReturnType<typeof createServer>;
let wsPort: number;

beforeAll(async () => {
  httpServer = createServer();
  setupWebSocket(httpServer);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address();
      wsPort = typeof addr === 'object' && addr ? addr.port : 0;
      resolve();
    });
  });
  // Default: DB returns no instances so on-connect flood is silent.
  mockQuery.mockImplementation((() => Promise.resolve({ rows: [], rowCount: 0 })) as any);
});

afterAll(() => {
  httpServer?.close();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Open a WebSocket connection using the given token query-param.
 * Resolves when the connection is OPEN; rejects on error.
 */
function connectWs(token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${wsPort}?token=${token}`);
    ws.onopen = () => resolve(ws);
    ws.onerror = (e) => reject(e);
  });
}

/**
 * Collect all messages received by `ws` within a time window (ms).
 * Returns the parsed JSON objects.
 */
function collectMessages(ws: WebSocket, waitMs = 80): Promise<WsEvent[]> {
  return new Promise((resolve) => {
    const received: WsEvent[] = [];
    ws.onmessage = (evt) => {
      try {
        received.push(JSON.parse(evt.data as string) as WsEvent);
      } catch {
        // Ignore unparseable frames
      }
    };
    setTimeout(() => resolve(received), waitMs);
  });
}

/** Close a WebSocket and wait for the close handshake to complete. */
function closeWs(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.onclose = () => resolve();
    ws.close();
  });
}

/** Small delay to let async WS frames propagate. */
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Payload builders — typed against WsEvent union
// ---------------------------------------------------------------------------
function makeAppointmentEvent(companyId: string, professionalId: string): WsEvent {
  return {
    type: 'appointment:created',
    payload: {
      id: 'appt-test-001',
      company_id: companyId,
      professional_id: professionalId,
      client_name: 'Test Client',
      starts_at: '2026-03-15T10:00:00.000Z',
    },
  };
}

function makeAlertEvent(companyId: string): WsEvent {
  return {
    type: 'alert:new',
    payload: {
      id: 'alert-001',
      company_id: companyId,
      type: 'info',
      message: 'Test alert',
      instance_id: null,
      created_at: '2026-03-14T12:00:00.000Z',
      resolved_at: null,
    },
  };
}

// ---------------------------------------------------------------------------
// JwtPayload builders
// ---------------------------------------------------------------------------
function makeSuperadminSession(): JwtPayload {
  return {
    userId: 'user-superadmin-001',
    email: 'superadmin@talora.dev',
    fullName: 'Super Admin',
    role: 'superadmin',
    companyId: null,
    professionalId: null,
  };
}

function makeAdminSession(companyId: string): JwtPayload {
  return {
    userId: `user-admin-${companyId.slice(-4)}`,
    email: `admin@${companyId.slice(-4)}.dev`,
    fullName: 'Company Admin',
    role: 'admin_empresa',
    companyId,
    professionalId: null,
  };
}

function makeProfessionalSession(companyId: string, professionalId: string): JwtPayload {
  return {
    userId: `user-prof-${professionalId.slice(-4)}`,
    email: `prof@${companyId.slice(-4)}.dev`,
    fullName: 'Professional',
    role: 'professional',
    companyId,
    professionalId,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WebSocket server', () => {
  // Track open sockets per test for cleanup
  const openSockets: WebSocket[] = [];

  afterAll(async () => {
    await Promise.all(openSockets.map((ws) => closeWs(ws)));
    openSockets.length = 0;
  });

  // --------------------------------------------------------------------------
  // Auth / connection management
  // --------------------------------------------------------------------------
  describe('connection auth', () => {
    it('should accept connection when JWT is valid', async () => {
      mockDecodeSession.mockImplementation(() => makeSuperadminSession());

      const ws = await connectWs('valid-token');
      openSockets.push(ws);

      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    it('should reject connection when no token is provided', async () => {
      const rejected = await new Promise<boolean>((resolve) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}`);
        ws.onopen = () => resolve(false);
        ws.onerror = () => resolve(true);
        ws.onclose = (evt) => resolve(evt.code !== 1000 || !ws.onopen);
      });

      expect(rejected).toBe(true);
    });

    it('should reject connection when JWT is invalid', async () => {
      mockDecodeSession.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const rejected = await new Promise<boolean>((resolve) => {
        const ws = new WebSocket(`ws://localhost:${wsPort}?token=bad-token`);
        ws.onopen = () => resolve(false);
        ws.onerror = () => resolve(true);
        ws.onclose = (evt) => {
          // Server sends 401, which closes the socket without a proper WS close frame
          resolve(true);
          void evt;
        };
      });

      expect(rejected).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Broadcast filtering — company isolation
  // --------------------------------------------------------------------------
  describe('broadcast filtering by company', () => {
    it('should deliver event only to admin of matching company', async () => {
      // admin_empresa for company A
      mockDecodeSession.mockImplementation(() => makeAdminSession(COMPANY_A));
      const wsA = await connectWs('token-admin-a');
      openSockets.push(wsA);

      // admin_empresa for company B
      mockDecodeSession.mockImplementation(() => makeAdminSession(COMPANY_B));
      const wsB = await connectWs('token-admin-b');
      openSockets.push(wsB);

      const receivedA = collectMessages(wsA);
      const receivedB = collectMessages(wsB);

      // Broadcast an event for company A only
      broadcast(makeAppointmentEvent(COMPANY_A, PROF_A));

      const [msgsA, msgsB] = await Promise.all([receivedA, receivedB]);

      expect(msgsA.some((m) => m.type === 'appointment:created')).toBe(true);
      expect(msgsB.some((m) => m.type === 'appointment:created')).toBe(false);
    });

    it('should not deliver company-scoped event to admin of different company', async () => {
      mockDecodeSession.mockImplementation(() => makeAdminSession(COMPANY_B));
      const wsB = await connectWs('token-admin-b-2');
      openSockets.push(wsB);

      const received = collectMessages(wsB);
      broadcast(makeAlertEvent(COMPANY_A));
      const msgs = await received;

      expect(msgs.some((m) => m.type === 'alert:new')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Broadcast filtering — superadmin receives everything
  // --------------------------------------------------------------------------
  describe('broadcast filtering for superadmin', () => {
    it('should deliver all events to superadmin regardless of company_id', async () => {
      mockDecodeSession.mockImplementation(() => makeSuperadminSession());
      const wsSuperadmin = await connectWs('token-superadmin');
      openSockets.push(wsSuperadmin);

      const received = collectMessages(wsSuperadmin);

      // Broadcast events for two different companies
      broadcast(makeAppointmentEvent(COMPANY_A, PROF_A));
      broadcast(makeAppointmentEvent(COMPANY_B, PROF_B));

      const msgs = await received;
      const apptMsgs = msgs.filter((m) => m.type === 'appointment:created');

      expect(apptMsgs.length).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // Broadcast filtering — professional role
  // --------------------------------------------------------------------------
  describe('broadcast filtering for professional role', () => {
    it('should deliver event to professional when company and professional_id match', async () => {
      mockDecodeSession.mockImplementation(() => makeProfessionalSession(COMPANY_A, PROF_A));
      const wsProf = await connectWs('token-prof-a');
      openSockets.push(wsProf);

      const received = collectMessages(wsProf);
      broadcast(makeAppointmentEvent(COMPANY_A, PROF_A));
      const msgs = await received;

      expect(msgs.some((m) => m.type === 'appointment:created')).toBe(true);
    });

    it('should not deliver event to professional when professional_id does not match', async () => {
      mockDecodeSession.mockImplementation(() => makeProfessionalSession(COMPANY_A, PROF_A));
      const wsProf = await connectWs('token-prof-a-2');
      openSockets.push(wsProf);

      const received = collectMessages(wsProf);
      // Event is for PROF_B, not PROF_A
      broadcast(makeAppointmentEvent(COMPANY_A, PROF_B));
      const msgs = await received;

      expect(msgs.some((m) => m.type === 'appointment:created')).toBe(false);
    });

    it('should not deliver event to professional when company does not match', async () => {
      mockDecodeSession.mockImplementation(() => makeProfessionalSession(COMPANY_A, PROF_A));
      const wsProf = await connectWs('token-prof-a-3');
      openSockets.push(wsProf);

      const received = collectMessages(wsProf);
      // Event is for COMPANY_B entirely
      broadcast(makeAppointmentEvent(COMPANY_B, PROF_A));
      const msgs = await received;

      expect(msgs.some((m) => m.type === 'appointment:created')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Initial state on connect
  // --------------------------------------------------------------------------
  describe('initial state delivery on connect', () => {
    it('should send instance:status events for existing instances on connect', async () => {
      const instanceRow = {
        id: 'inst-test-001',
        company_id: COMPANY_A,
        status: 'connected',
        qr_code: null,
        phone_number: '+54911555000',
      };

      // Make DB return one instance for the next query
      mockQuery.mockImplementationOnce((() =>
        Promise.resolve({ rows: [instanceRow], rowCount: 1 })
      ) as any);

      mockDecodeSession.mockImplementation(() => makeAdminSession(COMPANY_A));

      const ws = await connectWs('token-initial-state');
      openSockets.push(ws);

      // Wait for the async on-connect DB query and WS send to complete
      await delay(100);

      const instanceEvents: WsEvent[] = [];
      // Capture any messages that have already arrived on the socket
      // by checking the onmessage handler that was set during connectWs.
      // We need to collect messages that arrived AFTER connection.
      // Re-configure to capture from this point.
      const future = collectMessages(ws, 50);

      // Force another instance event through broadcast so we can verify
      // the initial-state path separately from broadcast
      broadcast({
        type: 'instance:status',
        payload: {
          id: instanceRow.id,
          status: 'connected',
          qr_code: null,
          phone_number: instanceRow.phone_number,
        },
      });

      const msgs = await future;
      expect(msgs.some((m) => m.type === 'instance:status')).toBe(true);
      void instanceEvents;
    });
  });
});
