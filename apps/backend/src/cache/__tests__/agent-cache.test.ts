// @ts-nocheck
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { makeAgent, TEST_IDS } from '../../__test-utils__/factories';
import type { AgentConfig } from '../agent-cache';
import type { QueryResult } from 'pg';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a typed QueryResult<T> with the given rows. */
function makeQueryResult<T>(rows: T[]): QueryResult<T> {
  return {
    rows,
    rowCount: rows.length,
    command: 'SELECT',
    oid: 0,
    fields: [],
  };
}

// ---------------------------------------------------------------------------
// Mocks — must be set up before dynamic import of the module under test.
// ---------------------------------------------------------------------------

const mockQuery = mock((_sql: string, _params?: unknown[]) =>
  Promise.resolve(makeQueryResult<never>([]))
);

mock.module('../../db/pool', () => ({
  pool: { query: mockQuery },
}));

mock.module('../../agent/tool-config', () => ({
  listEffectiveAgentTools: mock((_agentId: string) => Promise.resolve([])),
}));

mock.module('../../utils/logger', () => ({
  logger: {
    info: mock((_msg: string, _meta?: unknown) => undefined),
    warn: mock((_msg: string, _meta?: unknown) => undefined),
    error: mock((_msg: string, _meta?: unknown) => undefined),
    debug: mock((_msg: string, _meta?: unknown) => undefined),
  },
}));

// Dynamic import after mock.module calls so the module resolves our mocks.
const { getAgentConfig, invalidateAgentCache, invalidateAgentCacheByAgentId } =
  await import('../agent-cache');

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const COMPANY_ID = TEST_IDS.COMPANY_A;
const AGENT_ID = TEST_IDS.AGENT_A;
const AGENT_ROW = makeAgent({ id: AGENT_ID, company_id: COMPANY_ID });

/**
 * Configure mockQuery to return a realistic multi-query sequence for the
 * happy-path fetchAgentConfig flow:
 *   1. SELECT * FROM agents WHERE company_id = $1
 *   2. SELECT * FROM prompt_sections WHERE agent_id = $1
 *   3. SELECT * FROM variables WHERE agent_id = $1
 *
 * query() is called with different SQL strings, so we inspect the SQL to
 * return the right rows.
 */
function setupHappyPathQueries() {
  mockQuery.mockImplementation((sql: string, _params?: unknown[]) => {
    if (sql.includes('FROM agents') && sql.includes('company_id')) {
      return Promise.resolve(makeQueryResult([AGENT_ROW]));
    }
    if (sql.includes('FROM prompt_sections')) {
      return Promise.resolve(makeQueryResult([]));
    }
    if (sql.includes('FROM variables')) {
      return Promise.resolve(makeQueryResult([]));
    }
    // Default: empty result for any unexpected query.
    return Promise.resolve(makeQueryResult([]));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getAgentConfig', () => {
  beforeEach(() => {
    // Reset the module-level Maps so cache state never leaks between tests.
    invalidateAgentCache();
    mockQuery.mockReset();
    // Default: return empty results unless a test overrides.
    mockQuery.mockImplementation((_sql: string, _params?: unknown[]) =>
      Promise.resolve(makeQueryResult([]))
    );
  });

  // -------------------------------------------------------------------------
  it('should fetch from DB on cache miss and return agent config', async () => {
    setupHappyPathQueries();

    const result = await getAgentConfig(COMPANY_ID);

    expect(result).not.toBeNull();
    expect((result as AgentConfig).agent.id).toBe(AGENT_ID);
    expect((result as AgentConfig).agent.company_id).toBe(COMPANY_ID);
    expect(Array.isArray((result as AgentConfig).sections)).toBe(true);
    expect(Array.isArray((result as AgentConfig).tools)).toBe(true);
    expect(Array.isArray((result as AgentConfig).variables)).toBe(true);
  });

  // -------------------------------------------------------------------------
  it('should return cached result on cache hit without querying DB again', async () => {
    setupHappyPathQueries();

    // First call — populates the cache.
    const first = await getAgentConfig(COMPANY_ID);
    const callsAfterFirstFetch = mockQuery.mock.calls.length;

    // Second call — should hit the cache.
    const second = await getAgentConfig(COMPANY_ID);

    expect(mockQuery.mock.calls.length).toBe(callsAfterFirstFetch);
    expect(second).toBe(first); // Same reference from cache.
  });

  // -------------------------------------------------------------------------
  it('should re-fetch from DB after cache is invalidated for that companyId', async () => {
    setupHappyPathQueries();

    await getAgentConfig(COMPANY_ID);
    const callsAfterFirstFetch = mockQuery.mock.calls.length;

    invalidateAgentCache(COMPANY_ID);

    // Re-configure mock for the second fetch round.
    setupHappyPathQueries();

    const result = await getAgentConfig(COMPANY_ID);

    expect(mockQuery.mock.calls.length).toBeGreaterThan(callsAfterFirstFetch);
    expect(result).not.toBeNull();
    expect((result as AgentConfig).agent.id).toBe(AGENT_ID);
  });

  // -------------------------------------------------------------------------
  it('should deduplicate concurrent requests — only 1 DB fetch for same companyId', async () => {
    setupHappyPathQueries();

    // Fire two simultaneous calls before either resolves.
    const [r1, r2] = await Promise.all([
      getAgentConfig(COMPANY_ID),
      getAgentConfig(COMPANY_ID),
    ]);

    // Both results must be identical (same object reference from the shared promise).
    expect(r1).toBe(r2);

    // The agents query must have been executed exactly once.
    const agentQueries = mockQuery.mock.calls.filter(([sql]) =>
      (sql as string).includes('FROM agents') && (sql as string).includes('company_id')
    );
    expect(agentQueries.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  it('should return null when companyId is null', async () => {
    // With companyId=null, resolveCompanyId queries the DB for the first agent.
    // Return empty rows so resolvedCompanyId ends up null.
    mockQuery.mockImplementation((_sql: string) =>
      Promise.resolve(makeQueryResult([]))
    );

    const result = await getAgentConfig(null);

    expect(result).toBeNull();
    // Only the fallback "ORDER BY created_at ASC LIMIT 1" query should run.
    // No agents-by-company or sections/variables queries.
    const queriesRun = mockQuery.mock.calls.length;
    expect(queriesRun).toBe(1);
  });

  // -------------------------------------------------------------------------
  it('should return null when agent is not found in DB for the given companyId', async () => {
    // agents query returns empty rows → no agent for this company.
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM agents') && sql.includes('company_id')) {
        return Promise.resolve(makeQueryResult([]));
      }
      return Promise.resolve(makeQueryResult([]));
    });

    const result = await getAgentConfig(COMPANY_ID);

    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  it('should clear all cached entries when invalidateAgentCache is called without args', async () => {
    setupHappyPathQueries();

    // Populate cache for COMPANY_A.
    await getAgentConfig(COMPANY_ID);

    // Clear everything.
    invalidateAgentCache();

    // Re-configure mock for the next fetch.
    setupHappyPathQueries();

    const callsBeforeSecondFetch = mockQuery.mock.calls.length;
    await getAgentConfig(COMPANY_ID);

    // A new DB fetch must have occurred.
    expect(mockQuery.mock.calls.length).toBeGreaterThan(callsBeforeSecondFetch);
  });

  // -------------------------------------------------------------------------
  it('should not clear cache for other companies when invalidating by specific companyId', async () => {
    const COMPANY_B = TEST_IDS.COMPANY_B;
    const agentB = makeAgent({ id: 'agent-bbb', company_id: COMPANY_B });

    mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('FROM agents') && sql.includes('company_id')) {
        const companyParam = Array.isArray(params) ? params[0] : undefined;
        if (companyParam === COMPANY_ID) {
          return Promise.resolve(makeQueryResult([AGENT_ROW]));
        }
        if (companyParam === COMPANY_B) {
          return Promise.resolve(makeQueryResult([agentB]));
        }
      }
      return Promise.resolve(makeQueryResult([]));
    });

    // Populate cache for both companies.
    const resultAFirst = await getAgentConfig(COMPANY_ID);
    const resultBFirst = await getAgentConfig(COMPANY_B);

    const callsAfterBothFetched = mockQuery.mock.calls.length;

    // Invalidate only COMPANY_A.
    invalidateAgentCache(COMPANY_ID);

    // COMPANY_B's cache must still be valid — no new DB calls for it.
    const resultBSecond = await getAgentConfig(COMPANY_B);
    expect(resultBSecond).toBe(resultBFirst);
    expect(mockQuery.mock.calls.length).toBe(callsAfterBothFetched);

    // COMPANY_A must re-fetch.
    const resultASecond = await getAgentConfig(COMPANY_ID);
    expect(resultASecond).not.toBeNull();
    expect(mockQuery.mock.calls.length).toBeGreaterThan(callsAfterBothFetched);

    // Suppress unused-variable lint for resultAFirst.
    void resultAFirst;
  });
});

// ---------------------------------------------------------------------------

describe('invalidateAgentCacheByAgentId', () => {
  beforeEach(() => {
    invalidateAgentCache();
    mockQuery.mockReset();
    mockQuery.mockImplementation((_sql: string) =>
      Promise.resolve(makeQueryResult([]))
    );
  });

  it('should look up company_id from agents table and invalidate that entry', async () => {
    // First, populate the cache for COMPANY_ID.
    mockQuery.mockImplementation((sql: string, params?: unknown[]) => {
      if (sql.includes('FROM agents') && sql.includes('company_id')) {
        return Promise.resolve(makeQueryResult([AGENT_ROW]));
      }
      return Promise.resolve(makeQueryResult([]));
    });
    await getAgentConfig(COMPANY_ID);

    const callsAfterPopulate = mockQuery.mock.calls.length;

    // Now invalidate by agentId. The implementation queries for company_id.
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM agents') && sql.includes('WHERE id')) {
        return Promise.resolve(makeQueryResult([{ company_id: COMPANY_ID }]));
      }
      if (sql.includes('FROM agents') && sql.includes('company_id')) {
        return Promise.resolve(makeQueryResult([AGENT_ROW]));
      }
      return Promise.resolve(makeQueryResult([]));
    });

    await invalidateAgentCacheByAgentId(AGENT_ID);

    // After invalidation, next getAgentConfig must re-fetch.
    const callsAfterInvalidate = mockQuery.mock.calls.length;
    await getAgentConfig(COMPANY_ID);

    expect(mockQuery.mock.calls.length).toBeGreaterThan(callsAfterInvalidate);
    void callsAfterPopulate; // suppress unused warning
  });

  it('should handle gracefully when agentId does not exist in DB', async () => {
    // query returns no rows — company_id is undefined → invalidate(undefined) = clear all
    mockQuery.mockImplementation((_sql: string) =>
      Promise.resolve(makeQueryResult([]))
    );

    // Must not throw.
    await expect(invalidateAgentCacheByAgentId('nonexistent-agent-id')).resolves.toBeUndefined();
  });
});
