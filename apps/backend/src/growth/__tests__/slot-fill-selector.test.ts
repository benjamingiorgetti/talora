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

// ---------------------------------------------------------------------------
// Dynamic import AFTER mocks
// ---------------------------------------------------------------------------

const { selectSlotFillCandidates, isWithinTimeWindow, scoreCandidate } = await import('../slot-fill-selector');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_ID = TEST_IDS.COMPANY_A;
const SERVICE_ID = TEST_IDS.SERVICE_A;
const PROF_ID = TEST_IDS.PROF_A;
const CLIENT_A = TEST_IDS.CLIENT_A;
const CLIENT_B = 'client-bb-1111-2222-333333333333';
const CLIENT_C = 'client-cc-1111-2222-333333333333';
const CLIENT_D = 'client-dd-1111-2222-333333333333';
const CANCELLER_ID = 'cancel-aaa-1111-2222-333333333333';

// Wednesday 2026-03-18 at 14:00 UTC → DOW=3, hour=14
const SLOT_STARTS_AT = '2026-03-18T14:00:00.000Z';

function makeCandidateRow(overrides: Record<string, unknown> = {}) {
  return {
    client_id: CLIENT_A,
    client_name: 'Maria',
    client_phone: '5491155550000',
    has_same_service: false,
    has_same_professional: false,
    preferred_weekday: null,
    preferred_hour: null,
    days_overdue: 0,
    ...overrides,
  };
}

beforeEach(() => {
  mockQuery.mockReset();
  mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
});

// ---------------------------------------------------------------------------
// isWithinTimeWindow
// ---------------------------------------------------------------------------

describe('isWithinTimeWindow', () => {
  it('returns true when within range', () => {
    expect(isWithinTimeWindow(14, 13, 2)).toBe(true);
    expect(isWithinTimeWindow(14, 16, 2)).toBe(true);
  });

  it('returns false when outside range', () => {
    expect(isWithinTimeWindow(14, 10, 2)).toBe(false);
    expect(isWithinTimeWindow(14, 17, 2)).toBe(false);
  });

  it('returns true on exact match', () => {
    expect(isWithinTimeWindow(14, 14, 2)).toBe(true);
  });

  it('returns true at boundary', () => {
    expect(isWithinTimeWindow(14, 12, 2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scoreCandidate
// ---------------------------------------------------------------------------

describe('scoreCandidate', () => {
  it('scores full match correctly (50+20+25+15+bonus)', () => {
    const row = makeCandidateRow({
      has_same_service: true,
      has_same_professional: true,
      preferred_weekday: 3, // Wednesday
      preferred_hour: 14,
      days_overdue: 9, // floor(9/3) = 3
    });

    const result = scoreCandidate(row, 3, 14);
    expect(result.score).toBe(50 + 20 + 25 + 15 + 3);
    expect(result.match_reasons).toContain('same_service');
    expect(result.match_reasons).toContain('same_professional');
    expect(result.match_reasons).toContain('same_weekday');
    expect(result.match_reasons).toContain('same_time_window');
    expect(result.match_reasons).toContain('overdue');
  });

  it('scores zero for no matches and no overdue', () => {
    const row = makeCandidateRow({
      preferred_weekday: 1, // Monday, not matching Wednesday
      preferred_hour: 8, // Far from 14
      days_overdue: 0,
    });

    const result = scoreCandidate(row, 3, 14);
    expect(result.score).toBe(0);
    expect(result.match_reasons).toHaveLength(0);
  });

  it('caps overdue bonus at 10', () => {
    const row = makeCandidateRow({ days_overdue: 100 });

    const result = scoreCandidate(row, 3, 14);
    expect(result.score).toBe(10); // min(floor(100/3), 10) = 10
    expect(result.match_reasons).toContain('overdue');
  });

  it('gives zero overdue bonus for days_overdue < 3', () => {
    const row = makeCandidateRow({ days_overdue: 2 });

    const result = scoreCandidate(row, 3, 14);
    expect(result.score).toBe(0);
    expect(result.match_reasons).not.toContain('overdue');
  });

  it('handles null preferred_weekday and preferred_hour', () => {
    const row = makeCandidateRow({ preferred_weekday: null, preferred_hour: null });

    const result = scoreCandidate(row, 3, 14);
    expect(result.match_reasons).not.toContain('same_weekday');
    expect(result.match_reasons).not.toContain('same_time_window');
  });
});

// ---------------------------------------------------------------------------
// selectSlotFillCandidates
// ---------------------------------------------------------------------------

describe('selectSlotFillCandidates', () => {
  it('returns top 3 candidates sorted by score', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeCandidateRow({ client_id: CLIENT_A, client_name: 'Maria', has_same_service: true, preferred_weekday: 3, preferred_hour: 14, days_overdue: 9 }),
        makeCandidateRow({ client_id: CLIENT_B, client_name: 'Juan', has_same_service: true, days_overdue: 0 }),
        makeCandidateRow({ client_id: CLIENT_C, client_name: 'Ana', has_same_service: true, has_same_professional: true, days_overdue: 0 }),
        makeCandidateRow({ client_id: CLIENT_D, client_name: 'Pedro', has_same_service: true, days_overdue: 0 }),
      ],
      rowCount: 4,
    });

    const result = await selectSlotFillCandidates({
      companyId: COMPANY_ID,
      serviceId: SERVICE_ID,
      professionalId: PROF_ID,
      startsAt: SLOT_STARTS_AT,
      cancelledClientId: CANCELLER_ID,
    });

    expect(result).toHaveLength(3);
    // Maria has highest score (50+25+15+3=93), Ana has 70 (50+20), Juan/Pedro have 50
    expect(result[0].client_id).toBe(CLIENT_A);
    expect(result[0].score).toBeGreaterThan(result[1].score);
    expect(result[1].score).toBeGreaterThanOrEqual(result[2].score);
  });

  it('filters to same_service when available', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeCandidateRow({ client_id: CLIENT_A, has_same_service: true, days_overdue: 0 }),
        makeCandidateRow({ client_id: CLIENT_B, has_same_service: false, preferred_weekday: 3, preferred_hour: 14, days_overdue: 30 }),
      ],
      rowCount: 2,
    });

    const result = await selectSlotFillCandidates({
      companyId: COMPANY_ID,
      serviceId: SERVICE_ID,
      professionalId: null,
      startsAt: SLOT_STARTS_AT,
      cancelledClientId: null,
    });

    // Only CLIENT_A should be returned (has_same_service), not CLIENT_B
    expect(result).toHaveLength(1);
    expect(result[0].client_id).toBe(CLIENT_A);
  });

  it('falls back to all candidates when no same_service matches', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeCandidateRow({ client_id: CLIENT_A, has_same_service: false, preferred_weekday: 3, preferred_hour: 14, days_overdue: 0 }),
        makeCandidateRow({ client_id: CLIENT_B, has_same_service: false, days_overdue: 15 }),
      ],
      rowCount: 2,
    });

    const result = await selectSlotFillCandidates({
      companyId: COMPANY_ID,
      serviceId: SERVICE_ID,
      professionalId: null,
      startsAt: SLOT_STARTS_AT,
      cancelledClientId: null,
    });

    expect(result).toHaveLength(2);
  });

  it('respects maxCandidates limit', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        makeCandidateRow({ client_id: CLIENT_A, has_same_service: true }),
        makeCandidateRow({ client_id: CLIENT_B, has_same_service: true }),
        makeCandidateRow({ client_id: CLIENT_C, has_same_service: true }),
      ],
      rowCount: 3,
    });

    const result = await selectSlotFillCandidates({
      companyId: COMPANY_ID,
      serviceId: SERVICE_ID,
      professionalId: null,
      startsAt: SLOT_STARTS_AT,
      cancelledClientId: null,
      maxCandidates: 2,
    });

    expect(result).toHaveLength(2);
  });

  it('returns empty array when no candidates', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await selectSlotFillCandidates({
      companyId: COMPANY_ID,
      serviceId: SERVICE_ID,
      professionalId: null,
      startsAt: SLOT_STARTS_AT,
      cancelledClientId: null,
    });

    expect(result).toHaveLength(0);
  });

  it('passes correct params to SQL query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await selectSlotFillCandidates({
      companyId: COMPANY_ID,
      serviceId: SERVICE_ID,
      professionalId: PROF_ID,
      startsAt: SLOT_STARTS_AT,
      cancelledClientId: CANCELLER_ID,
    });

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe(COMPANY_ID);
    expect(params[1]).toBe(SERVICE_ID);
    expect(params[2]).toBe(PROF_ID);
    expect(params[3]).toBe(CANCELLER_ID);
  });

  it('SQL query includes days_overdue >= 3 filter', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    await selectSlotFillCandidates({
      companyId: COMPANY_ID,
      serviceId: SERVICE_ID,
      professionalId: null,
      startsAt: SLOT_STARTS_AT,
      cancelledClientId: null,
    });

    const sql = String(mockQuery.mock.calls[0][0]);
    expect(sql).toContain('days_overdue >= 3');
  });
});
