// @ts-nocheck
/**
 * Tests for company overview queries.
 *
 * Verifies that google_oauth_connected is scoped per-company,
 * not globally across all companies.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TEST_IDS, makeCompany } from '../../__test-utils__/factories';
import { setupQueryMock } from '../../__test-utils__/mock-pool';

const mockQuery = mock(() => Promise.resolve({ rows: [], rowCount: 0 }));

mock.module('../../db/pool', () => ({
  pool: { query: mockQuery },
}));

mock.module('../../calendar/connection-schema', () => ({
  getGoogleConnectionSchema: mock(() =>
    Promise.resolve({ hasRefreshToken: true, hasGoogleAccountEmail: true, hasTokenUpdatedAt: true })
  ),
}));

mock.module('../../utils/logger', () => ({
  logger: { error: mock(() => {}), warn: mock(() => {}), info: mock(() => {}), debug: mock(() => {}) },
}));

const { listCompanyOverviews, getCompanyOverview } = await import('../overview');

describe('listCompanyOverviews', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('scopes google_oauth_connected per company, not globally', async () => {
    // Company A has 1 professional with calendar connected
    // Company B has 1 professional with NO calendar connected
    const companyA = makeCompany({
      id: TEST_IDS.COMPANY_A,
      name: 'Company A',
      admin_count: '1',
      professional_count: '1',
      service_count: '1',
      instance_count: '1',
      connected_instance_count: '1',
      calendar_connection_count: '1',
      google_oauth_connected: true,
    });
    const companyB = makeCompany({
      id: TEST_IDS.COMPANY_B,
      name: 'Company B',
      admin_count: '1',
      professional_count: '1',
      service_count: '0',
      instance_count: '0',
      connected_instance_count: '0',
      calendar_connection_count: '0',
      google_oauth_connected: false,
    });

    mockQuery.mockResolvedValueOnce({ rows: [companyA, companyB], rowCount: 2 });

    const results = await listCompanyOverviews();

    const resultA = results.find((c) => c.id === TEST_IDS.COMPANY_A);
    const resultB = results.find((c) => c.id === TEST_IDS.COMPANY_B);

    expect(resultA).toBeDefined();
    expect(resultA!.google_oauth_connected).toBe(true);
    expect(resultA!.calendar_connection_count).toBe(1);

    expect(resultB).toBeDefined();
    expect(resultB!.google_oauth_connected).toBe(false);
    expect(resultB!.calendar_connection_count).toBe(0);
  });

  it('returns google_oauth_connected=false when company has no calendar connections', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeCompany({
          id: TEST_IDS.COMPANY_B,
          name: 'Empty Company',
          admin_count: '0',
          professional_count: '1',
          service_count: '0',
          instance_count: '0',
          connected_instance_count: '0',
          calendar_connection_count: '0',
          google_oauth_connected: false,
        }),
      ],
      rowCount: 1,
    });

    const [company] = await listCompanyOverviews();
    expect(company.google_oauth_connected).toBe(false);
    expect(company.calendar_connected).toBe(false);
  });
});

describe('getCompanyOverview', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('returns null for non-existent company', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const result = await getCompanyOverview('non-existent-id');
    expect(result).toBeNull();
  });

  it('correctly maps google_oauth_connected from calendar_connection_count', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeCompany({
          admin_count: '1',
          professional_count: '1',
          service_count: '2',
          instance_count: '1',
          connected_instance_count: '1',
          calendar_connection_count: '1',
          google_oauth_connected: true,
        }),
      ],
      rowCount: 1,
    });

    const result = await getCompanyOverview(TEST_IDS.COMPANY_A);
    expect(result).not.toBeNull();
    expect(result!.google_oauth_connected).toBe(true);
    expect(result!.calendar_connected).toBe(true);
  });
});
