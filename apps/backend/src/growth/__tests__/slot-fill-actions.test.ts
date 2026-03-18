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

mock.module('../reactivation', () => ({
  sendOutboundMessage: mockSendOutboundMessage,
  generateReactivationMessage: mock(() => 'generated message'),
}));

const mockBroadcast = mock(() => {});
mock.module('../../ws/server', () => ({
  broadcast: mockBroadcast,
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { listPendingOpportunities, sendOpportunityCandidate, dismissOpportunity } = await import('../slot-fill-actions');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_ID = TEST_IDS.COMPANY_A;
const OTHER_COMPANY_ID = TEST_IDS.COMPANY_B;
const OPP_ID = 'opp-aaaa-1111-2222-333333333333';
const CAND_ID = 'cand-aaa-1111-2222-333333333333';
const CLIENT_A = TEST_IDS.CLIENT_A;

const FUTURE_SLOT = new Date(Date.now() + 24 * 3_600_000).toISOString();
const PAST_SLOT = new Date(Date.now() - 1 * 3_600_000).toISOString();

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
  mockSendOutboundMessage.mockReset();
  mockSendOutboundMessage.mockImplementation(() =>
    Promise.resolve({ success: true, reactivationId: 'react-111' })
  );
});

// ---------------------------------------------------------------------------
// listPendingOpportunities
// ---------------------------------------------------------------------------

describe('listPendingOpportunities', () => {
  it('should return paginated opportunities with candidates', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('json_agg')) {
        return Promise.resolve({
          rows: [{
            id: OPP_ID,
            company_id: COMPANY_ID,
            service_name: 'Corte',
            status: 'pending',
            candidates: [{ id: CAND_ID, client_name: 'Maria', score: 75 }],
          }],
          rowCount: 1,
        });
      }
      if (s.includes('COUNT')) {
        return Promise.resolve({ rows: [{ count: '1' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const result = await listPendingOpportunities(COMPANY_ID, { page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('should pass correct SQL params for company and pagination', async () => {
    await listPendingOpportunities(COMPANY_ID, { page: 2, limit: 5 });

    // Data query should have company_id, limit, offset
    const dataCall = mockQuery.mock.calls.find(c => String(c[0]).includes('json_agg'));
    expect(dataCall).toBeDefined();
    const params = dataCall![1] as unknown[];
    expect(params[0]).toBe(COMPANY_ID);
    expect(params[1]).toBe(5); // limit
    expect(params[2]).toBe(5); // offset = (2-1) * 5
  });
});

// ---------------------------------------------------------------------------
// sendOpportunityCandidate
// ---------------------------------------------------------------------------

describe('sendOpportunityCandidate', () => {
  function setupSendMocks(overrides: Record<string, unknown> = {}) {
    const defaultRow = {
      opp_status: 'pending',
      slot_starts_at: FUTURE_SLOT,
      opp_company_id: COMPANY_ID,
      service_name: 'Corte',
      professional_name: 'Juan',
      candidate_client_id: CLIENT_A,
      candidate_status: 'pending',
      ...overrides,
    };

    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      // Load opportunity + candidate
      if (s.includes('FROM slot_fill_opportunities o') && s.includes('JOIN slot_fill_candidates sc')) {
        return Promise.resolve({ rows: [defaultRow], rowCount: 1 });
      }
      // Template query
      if (s.includes('slot_fill_message_template')) {
        return Promise.resolve({
          rows: [{ slot_fill_message_template: null, name: 'Barberia Cool' }],
          rowCount: 1,
        });
      }
      // Client name
      if (s.includes('FROM clients WHERE')) {
        return Promise.resolve({ rows: [{ name: 'Maria' }], rowCount: 1 });
      }
      // Atomic claim (RETURNING id)
      if (s.includes('UPDATE slot_fill_candidates') && s.includes('RETURNING')) {
        return Promise.resolve({ rows: [{ id: CAND_ID }], rowCount: 1 });
      }
      // Other updates
      if (s.includes('UPDATE')) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
  }

  it('should send message and update statuses on success', async () => {
    setupSendMocks();

    const result = await sendOpportunityCandidate(COMPANY_ID, OPP_ID, CAND_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.reactivationId).toBe('react-111');
    }

    // Should have called sendOutboundMessage
    expect(mockSendOutboundMessage).toHaveBeenCalledTimes(1);
    const sendArgs = mockSendOutboundMessage.mock.calls[0] as unknown[];
    expect(sendArgs[0]).toBe(COMPANY_ID);
    expect(sendArgs[1]).toBe(CLIENT_A);

    // Should have updated candidate status
    const candidateUpdate = mockQuery.mock.calls.find(c =>
      String(c[0]).includes('UPDATE slot_fill_candidates')
    );
    expect(candidateUpdate).toBeDefined();

    // Should have updated opportunity status
    const oppUpdate = mockQuery.mock.calls.find(c =>
      String(c[0]).includes('UPDATE slot_fill_opportunities')
    );
    expect(oppUpdate).toBeDefined();
  });

  it('should return 404 when opportunity not found', async () => {
    mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));

    const result = await sendOpportunityCandidate(COMPANY_ID, OPP_ID, CAND_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(404);
    }
  });

  it('should return 404 when company does not match', async () => {
    setupSendMocks();

    const result = await sendOpportunityCandidate(OTHER_COMPANY_ID, OPP_ID, CAND_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(404);
    }
  });

  it('should return 409 when opportunity is dismissed', async () => {
    setupSendMocks({ opp_status: 'dismissed' });

    const result = await sendOpportunityCandidate(COMPANY_ID, OPP_ID, CAND_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(409);
    }
  });

  it('should return 410 when slot has passed', async () => {
    setupSendMocks({ slot_starts_at: PAST_SLOT });

    const result = await sendOpportunityCandidate(COMPANY_ID, OPP_ID, CAND_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(410);
    }
  });

  it('should return 409 when candidate already claimed by concurrent request', async () => {
    // Setup mocks where the atomic claim returns 0 rows (already claimed)
    const defaultRow = {
      opp_status: 'pending',
      slot_starts_at: FUTURE_SLOT,
      opp_company_id: COMPANY_ID,
      service_name: 'Corte',
      professional_name: 'Juan',
      candidate_client_id: CLIENT_A,
      candidate_status: 'pending',
    };

    mockQuery.mockImplementation((sql: string) => {
      const s = String(sql);
      if (s.includes('FROM slot_fill_opportunities o') && s.includes('JOIN slot_fill_candidates sc')) {
        return Promise.resolve({ rows: [defaultRow], rowCount: 1 });
      }
      // Atomic claim returns empty — another request already claimed it
      if (s.includes('UPDATE slot_fill_candidates') && s.includes('RETURNING')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const result = await sendOpportunityCandidate(COMPANY_ID, OPP_ID, CAND_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.status).toBe(409);
    }
    // Should NOT have called sendOutboundMessage
    expect(mockSendOutboundMessage).not.toHaveBeenCalled();
  });

  it('should use custom messageText when provided', async () => {
    setupSendMocks();

    await sendOpportunityCandidate(COMPANY_ID, OPP_ID, CAND_ID, 'Custom message');

    const sendArgs = mockSendOutboundMessage.mock.calls[0] as unknown[];
    expect(sendArgs[2]).toBe('Custom message');
  });

  it('should rollback candidate claim when send fails', async () => {
    setupSendMocks();
    mockSendOutboundMessage.mockImplementation(() =>
      Promise.resolve({ success: false, error: 'Rate limit', status: 429 })
    );

    const result = await sendOpportunityCandidate(COMPANY_ID, OPP_ID, CAND_ID);

    expect(result.success).toBe(false);

    // Should have rolled back the candidate to pending
    const rollback = mockQuery.mock.calls.find(c =>
      String(c[0]).includes('UPDATE slot_fill_candidates') && String(c[0]).includes("status = 'pending'")
    );
    expect(rollback).toBeDefined();

    // Should NOT have updated trigger_type or opportunity status
    const triggerUpdate = mockQuery.mock.calls.find(c =>
      String(c[0]).includes('trigger_type')
    );
    expect(triggerUpdate).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// dismissOpportunity
// ---------------------------------------------------------------------------

describe('dismissOpportunity', () => {
  it('should update opportunity status to dismissed', async () => {
    await dismissOpportunity(COMPANY_ID, OPP_ID);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const sql = String(mockQuery.mock.calls[0][0]);
    expect(sql).toContain('UPDATE slot_fill_opportunities');
    expect(sql).toContain("status = 'dismissed'");
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe(OPP_ID);
    expect(params[1]).toBe(COMPANY_ID);
  });
});
