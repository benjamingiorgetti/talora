import { describe, it, expect, mock, beforeEach } from 'bun:test';
import type { Service, Professional } from '@talora/shared';

// --- Module mocks must be declared before any dynamic import ---

const mockQuery = mock(() => Promise.resolve({ rows: [], rowCount: 0 }));

mock.module('../../db/pool', () => ({
  pool: { query: mockQuery },
}));
mock.module('../../calendar/operations', () => ({
  checkSlot: mock(() => Promise.resolve({ available: true })),
  bookSlot: mock(() => Promise.resolve({ success: true, eventId: 'evt-1' })),
  createEvent: mock(() => Promise.resolve({ success: true, eventId: 'evt-2' })),
  deleteEvent: mock(() => Promise.resolve({ success: true })),
  updateEvent: mock(() => Promise.resolve({ success: true })),
  listEvents: mock(() => Promise.resolve({ events: [] })),
}));
mock.module('../../evolution/client', () => ({
  EvolutionClient: mock(() => ({ sendText: mock(() => Promise.resolve()) })),
}));
mock.module('../../utils/url-validator', () => ({
  validateWebhookUrl: mock(() => Promise.resolve()),
}));
mock.module('../../utils/logger', () => ({
  logger: { error: mock(() => {}), warn: mock(() => {}), info: mock(() => {}), debug: mock(() => {}) },
}));

const {
  normalizeLabel,
  tokenize,
  scoreServiceMatch,
  scoreProfessionalMatch,
  resolveServiceSelection,
  resolveProfessionalSelection,
} = await import('../tool-executor');

import { setupQueryMock } from '../../__test-utils__/mock-pool';
import { makeService, makeProfessional, TEST_IDS } from '../../__test-utils__/factories';

// ---------------------------------------------------------------------------
// Helpers: build typed objects from factory output
// ---------------------------------------------------------------------------

const FIXED_NOW = '2026-03-14T12:00:00.000Z';

function buildService(overrides: Record<string, unknown> = {}): Service {
  return {
    ...makeService(overrides),
    description: overrides.description as string ?? '',
    updated_at: FIXED_NOW,
  } as Service;
}

function buildProfessional(overrides: Record<string, unknown> = {}): Professional {
  return {
    ...makeProfessional(overrides),
    color_hex: null,
    updated_at: FIXED_NOW,
  } as Professional;
}

// Valid UUID used for DB-dependent tests that rely on isUuid() check
const VALID_UUID_A = '00000000-0000-4000-8000-000000000001';
const VALID_UUID_B = '00000000-0000-4000-8000-000000000002';
const COMPANY_ID = TEST_IDS.COMPANY_A;

// ---------------------------------------------------------------------------
// normalizeLabel
// ---------------------------------------------------------------------------

describe('normalizeLabel', () => {
  it('lowercases all characters', () => {
    expect(normalizeLabel('Corte De Pelo')).toBe('corte de pelo');
  });

  it('strips accents from characters', () => {
    expect(normalizeLabel('María José')).toBe('maria jose');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeLabel('  spaces   here  ')).toBe('spaces here');
  });

  it('replaces non-alphanumeric characters with spaces', () => {
    // Special characters become spaces; consecutive spaces collapse to one
    expect(normalizeLabel('abc!@#123')).toBe('abc 123');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeLabel('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// tokenize
// ---------------------------------------------------------------------------

describe('tokenize', () => {
  it('splits a multi-word string into tokens', () => {
    expect(tokenize('corte de pelo')).toEqual(['corte', 'de', 'pelo']);
  });

  it('returns empty array for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('returns a single-element array for a one-word string', () => {
    expect(tokenize('single')).toEqual(['single']);
  });
});

// ---------------------------------------------------------------------------
// scoreServiceMatch — pure function, no DB calls
// ---------------------------------------------------------------------------

describe('scoreServiceMatch', () => {
  it('returns 400 for an exact name match', () => {
    const service = buildService({ name: 'Corte de pelo' });
    expect(scoreServiceMatch('Corte de pelo', service)).toBe(400);
  });

  it('returns 400 for an exact alias match', () => {
    const service = buildService({ name: 'Corte de pelo', aliases: ['haircut', 'corte'] });
    expect(scoreServiceMatch('corte', service)).toBe(400);
  });

  it('returns 320 when all query tokens and all variant tokens are present in each other (bidirectional)', () => {
    // "pelo corte" has the same tokens as "corte pelo" → bidirectional overlap, no exact match
    const service = buildService({ name: 'corte pelo' });
    expect(scoreServiceMatch('pelo corte', service)).toBe(320);
  });

  it('returns 260 for a prefix match', () => {
    // Query is a prefix of the variant
    const service = buildService({ name: 'corte de pelo largo', aliases: [] });
    expect(scoreServiceMatch('corte de pelo', service)).toBe(260);
  });

  it('returns 0 when there is no overlap at all', () => {
    const service = buildService({ name: 'manicura', aliases: [] });
    expect(scoreServiceMatch('coloracion', service)).toBe(0);
  });

  it('scores using real Service objects from the factory', () => {
    // makeService defaults name to "Corte de pelo"
    const service = buildService();
    const score = scoreServiceMatch('Corte de pelo', service);
    expect(score).toBe(400);
  });

  it('returns 0 for an empty query', () => {
    const service = buildService({ name: 'Corte de pelo' });
    expect(scoreServiceMatch('', service)).toBe(0);
  });

  it('returns partial overlap score (80 + 10*overlap) when only some tokens match', () => {
    // query: "corte rapido" → tokens ["corte","rapido"]
    // variant: "corte de pelo" → tokens ["corte","de","pelo"]
    // overlap = 1 ("corte") → score = 80 + 10 = 90
    const service = buildService({ name: 'corte de pelo', aliases: [] });
    expect(scoreServiceMatch('corte rapido', service)).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// scoreProfessionalMatch — pure function, no DB calls
// ---------------------------------------------------------------------------

describe('scoreProfessionalMatch', () => {
  it('returns 400 for an exact name match', () => {
    const prof = buildProfessional({ name: 'Ana García' });
    expect(scoreProfessionalMatch('Ana García', prof)).toBe(400);
  });

  it('returns 260 for a prefix match (name starts with query)', () => {
    const prof = buildProfessional({ name: 'Ana García López' });
    // "ana garcia" is a word-boundary prefix of "ana garcia lopez"
    expect(scoreProfessionalMatch('Ana García', prof)).toBe(260);
  });

  it('returns 260 when the query appears as a word suffix in the name', () => {
    // query: "garcia" → normalizedName "ana garcia" includes " garcia" → score 260
    const prof = buildProfessional({ name: 'Ana García' });
    expect(scoreProfessionalMatch('García', prof)).toBe(260);
  });

  it('returns 220+overlap (allQueryTokensPresent path) for a multi-token query subset', () => {
    // query: "ana roberto" → tokens ["ana","roberto"]
    // name: "ana garcia roberto" → tokens ["ana","garcia","roberto"]
    // allQueryTokensPresent=true, allNameTokensPresent=false → 220 + overlap(2)
    const prof = buildProfessional({ name: 'Ana García Roberto' });
    expect(scoreProfessionalMatch('Ana Roberto', prof)).toBe(222);
  });

  it('returns 0 for a query with no token overlap', () => {
    const prof = buildProfessional({ name: 'Ana García' });
    expect(scoreProfessionalMatch('Roberto Martínez', prof)).toBe(0);
  });

  it('returns 0 for an empty query', () => {
    const prof = buildProfessional({ name: 'Ana García' });
    expect(scoreProfessionalMatch('', prof)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// resolveServiceSelection — DB-dependent
// ---------------------------------------------------------------------------

describe('resolveServiceSelection', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns kind:resolved when serviceId is a valid UUID and the service exists', async () => {
    const service = buildService({ id: VALID_UUID_A });
    setupQueryMock(mockQuery, [
      ['FROM services', [service]],
    ]);

    const result = await resolveServiceSelection(
      COMPANY_ID,
      { serviceId: VALID_UUID_A },
    );

    expect(result.kind).toBe('resolved');
    if (result.kind === 'resolved') {
      expect(result.service.id).toBe(VALID_UUID_A);
    }
  });

  it('returns kind:resolved when a single service matches the name search clearly', async () => {
    const service = buildService({ name: 'Corte de pelo' });
    // getService call → no rows (no UUID provided); listScopedServices → one service
    setupQueryMock(mockQuery, [
      ['FROM services', [service]],
    ]);

    const result = await resolveServiceSelection(
      COMPANY_ID,
      { serviceName: 'Corte de pelo' },
    );

    expect(result.kind).toBe('resolved');
  });

  it('returns kind:ambiguous when multiple services share the top score', async () => {
    // Two services each with score 400 against query "corte"
    const svc1 = buildService({ id: VALID_UUID_A, name: 'corte', aliases: [] });
    const svc2 = buildService({ id: VALID_UUID_B, name: 'corte', aliases: [], professional_id: null });
    setupQueryMock(mockQuery, [
      ['FROM services', [svc1, svc2]],
    ]);

    const result = await resolveServiceSelection(
      COMPANY_ID,
      { serviceName: 'corte' },
    );

    expect(result.kind).toBe('ambiguous');
  });

  it('returns kind:missing when no service meets the 180-point threshold', async () => {
    const service = buildService({ name: 'Manicura', aliases: [] });
    setupQueryMock(mockQuery, [
      ['FROM services', [service]],
    ]);

    const result = await resolveServiceSelection(
      COMPANY_ID,
      { serviceName: 'coloracion' },
    );

    expect(result.kind).toBe('missing');
    if (result.kind === 'missing') {
      expect(result.issue.needsServiceSelection).toBe(true);
    }
  });

  it('returns kind:resolved when there is no query and only one scoped service exists', async () => {
    const service = buildService();
    setupQueryMock(mockQuery, [
      ['FROM services', [service]],
    ]);

    const result = await resolveServiceSelection(
      COMPANY_ID,
      {}, // no serviceId, no serviceName
    );

    expect(result.kind).toBe('resolved');
  });

  it('returns kind:missing when there is no query and multiple services exist', async () => {
    const svc1 = buildService({ id: VALID_UUID_A, name: 'Corte de pelo' });
    const svc2 = buildService({ id: VALID_UUID_B, name: 'Coloración' });
    setupQueryMock(mockQuery, [
      ['FROM services', [svc1, svc2]],
    ]);

    const result = await resolveServiceSelection(
      COMPANY_ID,
      {},
    );

    expect(result.kind).toBe('missing');
    if (result.kind === 'missing') {
      expect(result.issue.needsServiceSelection).toBe(true);
      // Should suggest up to 4 options
      expect(result.issue.serviceOptions!.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('returns kind:missing with empty options when no services exist at all', async () => {
    // DB returns no services at all
    setupQueryMock(mockQuery, [
      ['FROM services', []],
    ]);

    const result = await resolveServiceSelection(
      COMPANY_ID,
      { serviceName: 'cualquier cosa' },
    );

    expect(result.kind).toBe('missing');
    if (result.kind === 'missing') {
      expect(result.issue.serviceOptions).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// resolveProfessionalSelection — DB-dependent
// ---------------------------------------------------------------------------

describe('resolveProfessionalSelection', () => {
  beforeEach(() => mockQuery.mockReset());

  it('returns kind:resolved immediately when contextProfessionalId is valid and found in DB', async () => {
    const prof = buildProfessional({ id: VALID_UUID_A });
    // getProfessional uses "FROM professionals WHERE"
    setupQueryMock(mockQuery, [
      ['FROM professionals', [prof]],
    ]);

    const result = await resolveProfessionalSelection(
      COMPANY_ID,
      {},
      VALID_UUID_A, // contextProfessionalId
    );

    expect(result.kind).toBe('resolved');
    if (result.kind === 'resolved') {
      expect(result.professional.id).toBe(VALID_UUID_A);
    }
  });

  it('returns kind:missing when no professionals are available and a name query is given', async () => {
    // listActiveProfessionals returns empty
    setupQueryMock(mockQuery, [
      ['FROM professionals', []],
    ]);

    const result = await resolveProfessionalSelection(
      COMPANY_ID,
      { professionalName: 'Ana García' },
    );

    expect(result.kind).toBe('missing');
    if (result.kind === 'missing') {
      expect(result.issue.needsProfessionalSelection).toBe(true);
      expect(result.issue.professionalOptions).toEqual([]);
    }
  });

  it('returns kind:none when there is no query and no context professional', async () => {
    const result = await resolveProfessionalSelection(
      COMPANY_ID,
      {}, // no professionalId, no professionalName
      null,
    );

    expect(result.kind).toBe('none');
  });

  it('returns kind:resolved when a name search yields exactly one match above threshold', async () => {
    const prof = buildProfessional({ id: VALID_UUID_A, name: 'Ana García' });
    setupQueryMock(mockQuery, [
      ['FROM professionals', [prof]],
    ]);

    const result = await resolveProfessionalSelection(
      COMPANY_ID,
      { professionalName: 'Ana García' },
    );

    expect(result.kind).toBe('resolved');
  });

  it('returns kind:ambiguous when multiple professionals share the top score', async () => {
    const profA = buildProfessional({ id: VALID_UUID_A, name: 'ana' });
    const profB = buildProfessional({ id: VALID_UUID_B, name: 'ana' });
    setupQueryMock(mockQuery, [
      ['FROM professionals', [profA, profB]],
    ]);

    const result = await resolveProfessionalSelection(
      COMPANY_ID,
      { professionalName: 'ana' },
    );

    expect(result.kind).toBe('ambiguous');
  });

  it('returns kind:missing when name query does not match any professional above threshold', async () => {
    const prof = buildProfessional({ id: VALID_UUID_A, name: 'Roberto Martínez' });
    setupQueryMock(mockQuery, [
      ['FROM professionals', [prof]],
    ]);

    const result = await resolveProfessionalSelection(
      COMPANY_ID,
      { professionalName: 'Zulema Sánchez' },
    );

    expect(result.kind).toBe('missing');
    if (result.kind === 'missing') {
      expect(result.issue.requestedProfessional).toBe('Zulema Sánchez');
    }
  });
});
