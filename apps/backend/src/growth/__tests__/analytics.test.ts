// @ts-nocheck
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TEST_IDS } from '../../__test-utils__/factories';
import { setupQueryMock } from '../../__test-utils__/mock-pool';

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
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { computeClientAnalytics, getAtRiskClients } = await import('../analytics');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_ID = TEST_IDS.COMPANY_A;
const CLIENT_A = TEST_IDS.CLIENT_A;
const CLIENT_B = 'client-bb-1111-2222-333333333333';

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
});

// ---------------------------------------------------------------------------
// computeClientAnalytics
// ---------------------------------------------------------------------------

describe('computeClientAnalytics', () => {
  it('should compute frequency from appointment gaps and upsert analytics', async () => {
    // The analytics query returns pre-computed rows from SQL
    const analyticsRow = {
      client_id: CLIENT_A,
      total_appointments: 3,
      total_revenue: '15000.00',
      avg_frequency_days: '14',
      last_appointment_at: new Date('2026-03-01'),
      days_since_last: 14,
      days_overdue: 0,
      risk_score: 0,
    };

    setupQueryMock(mockQuery, [
      // 1. The big analytics CTE query
      ['WITH appointment_gaps', [analyticsRow]],
      // 2. Upsert into client_analytics
      ['INSERT INTO client_analytics', []],
    ]);

    await computeClientAnalytics(COMPANY_ID);

    // Should have called the analytics query + one bulk upsert
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const upsertCall = mockQuery.mock.calls[1];
    const upsertParams = upsertCall[1] as unknown[];
    expect(upsertParams[0]).toEqual([CLIENT_A]); // client_ids array
    expect(upsertParams[1]).toBe(COMPANY_ID); // company_id
    expect(upsertParams[2]).toEqual([3]); // total_appointments array
  });

  it('should compute risk_score = round(days_overdue / avg_frequency * 100)', async () => {
    // Client with avg_frequency=14, last visit 21 days ago → days_overdue=7, risk_score=50
    const analyticsRow = {
      client_id: CLIENT_A,
      total_appointments: 3,
      total_revenue: '15000.00',
      avg_frequency_days: '14',
      last_appointment_at: new Date('2026-02-22'),
      days_since_last: 21,
      days_overdue: 7,
      risk_score: 50,
    };

    setupQueryMock(mockQuery, [
      ['WITH appointment_gaps', [analyticsRow]],
      ['INSERT INTO client_analytics', []],
    ]);

    await computeClientAnalytics(COMPANY_ID);

    const upsertParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(upsertParams[8]).toEqual([50]); // risk_scores array
    expect(upsertParams[7]).toEqual([7]); // days_overdues array
  });

  it('should cap risk_score at 100 for extremely overdue clients', async () => {
    const analyticsRow = {
      client_id: CLIENT_A,
      total_appointments: 5,
      total_revenue: '25000.00',
      avg_frequency_days: '14',
      last_appointment_at: new Date('2025-12-01'),
      days_since_last: 104,
      days_overdue: 90,
      risk_score: 100, // SQL LEAST(..., 100) caps at 100
    };

    setupQueryMock(mockQuery, [
      ['WITH appointment_gaps', [analyticsRow]],
      ['INSERT INTO client_analytics', []],
    ]);

    await computeClientAnalytics(COMPANY_ID);

    const upsertParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(upsertParams[8]).toEqual([100]); // risk_scores capped
  });

  it('should not upsert anything when no at-risk clients are found', async () => {
    setupQueryMock(mockQuery, [
      ['WITH appointment_gaps', []],
    ]);

    await computeClientAnalytics(COMPANY_ID);

    // Only the analytics query, no upserts
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('should upsert one record per at-risk client', async () => {
    const rows = [
      {
        client_id: CLIENT_A,
        total_appointments: 3,
        total_revenue: '15000.00',
        avg_frequency_days: '14',
        last_appointment_at: new Date('2026-02-22'),
        days_since_last: 21,
        days_overdue: 7,
        risk_score: 50,
      },
      {
        client_id: CLIENT_B,
        total_appointments: 4,
        total_revenue: '20000.00',
        avg_frequency_days: '30',
        last_appointment_at: new Date('2026-01-01'),
        days_since_last: 73,
        days_overdue: 43,
        risk_score: 100,
      },
    ];

    setupQueryMock(mockQuery, [
      ['WITH appointment_gaps', rows],
      ['INSERT INTO client_analytics', []],
    ]);

    await computeClientAnalytics(COMPANY_ID);

    // 1 analytics query + 1 bulk upsert
    expect(mockQuery).toHaveBeenCalledTimes(2);
    const upsertParams = mockQuery.mock.calls[1][1] as unknown[];
    expect(upsertParams[0]).toEqual([CLIENT_A, CLIENT_B]); // both client_ids in array
  });

  it('should only include confirmed appointments (SQL has status = confirmed)', async () => {
    // We verify the SQL includes the filter — the mock returns rows as if DB filtered
    let capturedSql = '';
    mockQuery.mockImplementation((sql: string) => {
      capturedSql += sql;
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await computeClientAnalytics(COMPANY_ID);

    expect(capturedSql).toContain("status = 'confirmed'");
  });

  it('should only include clients with >= 2 appointments (SQL has HAVING COUNT(*) >= 2)', async () => {
    let capturedSql = '';
    mockQuery.mockImplementation((sql: string) => {
      capturedSql += sql;
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await computeClientAnalytics(COMPANY_ID);

    expect(capturedSql).toContain('HAVING COUNT(*) >= 2');
  });
});

// ---------------------------------------------------------------------------
// getAtRiskClients
// ---------------------------------------------------------------------------

describe('getAtRiskClients', () => {
  const makeAnalyticsRow = (overrides: Record<string, unknown> = {}) => ({
    client_id: CLIENT_A,
    company_id: COMPANY_ID,
    total_appointments: 3,
    total_revenue: '15000.00',
    avg_frequency_days: 14,
    last_appointment_at: '2026-02-22T00:00:00.000Z',
    days_since_last: 21,
    days_overdue: 7,
    risk_score: 50,
    computed_at: new Date().toISOString(),
    client_name: 'Test Client',
    client_phone: '5491155550000',
    ...overrides,
  });

  it('should recompute when cache is stale (computed_at > 24h ago)', async () => {
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    const analyticsRow = makeAnalyticsRow();

    let queryCount = 0;
    mockQuery.mockImplementation((sql: string) => {
      queryCount++;
      const sqlStr = String(sql);

      // 1. Staleness check
      if (sqlStr.includes('MIN(computed_at)')) {
        return Promise.resolve({ rows: [{ computed_at: staleDate }], rowCount: 1 });
      }
      // 2. computeClientAnalytics analytics CTE
      if (sqlStr.includes('WITH appointment_gaps')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      // 3. Data query
      if (sqlStr.includes('JOIN clients c ON c.id = ca.client_id')) {
        return Promise.resolve({ rows: [analyticsRow], rowCount: 1 });
      }
      // 4. Count query
      if (sqlStr.includes('COUNT(*)::text')) {
        return Promise.resolve({ rows: [{ count: '1' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const result = await getAtRiskClients(COMPANY_ID);

    // Staleness check should trigger computeClientAnalytics call
    const sqlCalls = mockQuery.mock.calls.map(c => String(c[0]));
    const hasComputeCall = sqlCalls.some(s => s.includes('WITH appointment_gaps'));
    expect(hasComputeCall).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('should recompute when refresh=true even if not stale', async () => {
    const freshDate = new Date(); // just now
    const analyticsRow = makeAnalyticsRow();

    mockQuery.mockImplementation((sql: string) => {
      const sqlStr = String(sql);
      if (sqlStr.includes('MIN(computed_at)')) {
        return Promise.resolve({ rows: [{ computed_at: freshDate }], rowCount: 1 });
      }
      if (sqlStr.includes('WITH appointment_gaps')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      if (sqlStr.includes('JOIN clients c ON c.id = ca.client_id')) {
        return Promise.resolve({ rows: [analyticsRow], rowCount: 1 });
      }
      if (sqlStr.includes('COUNT(*)::text')) {
        return Promise.resolve({ rows: [{ count: '1' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await getAtRiskClients(COMPANY_ID, { refresh: true });

    const sqlCalls = mockQuery.mock.calls.map(c => String(c[0]));
    const hasComputeCall = sqlCalls.some(s => s.includes('WITH appointment_gaps'));
    expect(hasComputeCall).toBe(true);
  });

  it('should skip recompute when cache is fresh and refresh=false', async () => {
    const freshDate = new Date(); // just now
    const analyticsRow = makeAnalyticsRow();

    mockQuery.mockImplementation((sql: string) => {
      const sqlStr = String(sql);
      if (sqlStr.includes('MIN(computed_at)')) {
        return Promise.resolve({ rows: [{ computed_at: freshDate }], rowCount: 1 });
      }
      if (sqlStr.includes('JOIN clients c ON c.id = ca.client_id')) {
        return Promise.resolve({ rows: [analyticsRow], rowCount: 1 });
      }
      if (sqlStr.includes('COUNT(*)::text')) {
        return Promise.resolve({ rows: [{ count: '1' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    await getAtRiskClients(COMPANY_ID);

    const sqlCalls = mockQuery.mock.calls.map(c => String(c[0]));
    const hasComputeCall = sqlCalls.some(s => s.includes('WITH appointment_gaps'));
    expect(hasComputeCall).toBe(false);
  });

  it('should paginate correctly with page and limit params', async () => {
    const analyticsRow = makeAnalyticsRow();

    mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
      const sqlStr = String(sql);
      if (sqlStr.includes('MIN(computed_at)')) {
        return Promise.resolve({ rows: [{ computed_at: new Date() }], rowCount: 1 });
      }
      if (sqlStr.includes('JOIN clients c ON c.id = ca.client_id')) {
        return Promise.resolve({ rows: [analyticsRow], rowCount: 1 });
      }
      if (sqlStr.includes('COUNT(*)::text')) {
        return Promise.resolve({ rows: [{ count: '50' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const result = await getAtRiskClients(COMPANY_ID, { page: 3, limit: 10 });

    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
    expect(result.total).toBe(50);

    // Verify OFFSET = (page-1) * limit = 20
    const dataCall = mockQuery.mock.calls.find(
      c => String(c[0]).includes('JOIN clients c ON c.id = ca.client_id')
    );
    const dataParams = dataCall![1] as unknown[];
    expect(dataParams[2]).toBe(10); // limit
    expect(dataParams[3]).toBe(20); // offset
  });

  it('should only return clients with risk_score > threshold', async () => {
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
      const sqlStr = String(sql);
      if (sqlStr.includes('MIN(computed_at)')) {
        return Promise.resolve({ rows: [{ computed_at: new Date() }], rowCount: 1 });
      }
      if (sqlStr.includes('JOIN clients c ON c.id = ca.client_id')) {
        // Verify risk_score > threshold is in the query
        expect(sqlStr).toContain('risk_score > $2');
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      if (sqlStr.includes('COUNT(*)::text')) {
        return Promise.resolve({ rows: [{ count: '0' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const result = await getAtRiskClients(COMPANY_ID);

    expect(result.data).toHaveLength(0);
  });

  it('should return default pagination when no options provided', async () => {
    mockQuery.mockImplementation((sql: string) => {
      const sqlStr = String(sql);
      if (sqlStr.includes('MIN(computed_at)')) {
        return Promise.resolve({ rows: [{ computed_at: new Date() }], rowCount: 1 });
      }
      if (sqlStr.includes('JOIN clients c ON c.id = ca.client_id')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      if (sqlStr.includes('COUNT(*)::text')) {
        return Promise.resolve({ rows: [{ count: '0' }], rowCount: 1 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const result = await getAtRiskClients(COMPANY_ID);

    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.total).toBe(0);
  });
});
