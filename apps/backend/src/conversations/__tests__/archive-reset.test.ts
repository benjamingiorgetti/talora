// @ts-nocheck
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockQuery } from '../../__test-utils__/mock-pool';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------
const mockQuery = createMockQuery();
const mockClientQuery = mock(() => Promise.resolve({ rows: [], rowCount: 0 }));
const mockRelease = mock(() => {});
const mockConnect = mock(() =>
  Promise.resolve({ query: mockClientQuery, release: mockRelease })
);

mock.module('../../db/pool', () => ({
  pool: { query: mockQuery, connect: mockConnect },
}));

// ---------------------------------------------------------------------------
// Dynamic imports AFTER mocks
// ---------------------------------------------------------------------------
const { isConversationInactive, archiveConversation, archiveStaleConversations } =
  await import('../archive');
const { isResetCommand, resetConversationMemory, RESET_SYSTEM_EVENT_MESSAGE } =
  await import('../reset');

// ---------------------------------------------------------------------------
// Tests: isConversationInactive
// ---------------------------------------------------------------------------
describe('isConversationInactive', () => {
  it('returns false when lastMessageAt is null', () => {
    expect(isConversationInactive(null)).toBe(false);
  });

  it('returns false when lastMessageAt is undefined', () => {
    expect(isConversationInactive(undefined)).toBe(false);
  });

  it('returns false when less than 48h ago', () => {
    const recent = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1h ago
    expect(isConversationInactive(recent)).toBe(false);
  });

  it('returns true when >= 48h ago', () => {
    const old = new Date(Date.now() - 1000 * 60 * 60 * 49).toISOString(); // 49h ago
    expect(isConversationInactive(old)).toBe(true);
  });

  it('returns false for invalid date string', () => {
    expect(isConversationInactive('not-a-date')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: archiveConversation
// ---------------------------------------------------------------------------
describe('archiveConversation', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
  });

  it('executes UPDATE with correct params', async () => {
    const fakeRow = { id: 'conv-1', archived_at: '2026-01-01', archive_reason: 'manual_reset' };
    mockQuery.mockImplementation(() => Promise.resolve({ rows: [fakeRow], rowCount: 1 }));

    const result = await archiveConversation('conv-1', 'company-1', 'manual_reset');

    expect(result).toEqual(fakeRow);
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('UPDATE conversations');
    expect(sql).toContain('archived_at');
    expect(params).toEqual(['conv-1', 'company-1', 'manual_reset']);
  });

  it('returns null when no rows updated', async () => {
    const result = await archiveConversation('nonexistent', 'company-1', 'manual_reset');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: archiveStaleConversations
// ---------------------------------------------------------------------------
describe('archiveStaleConversations', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockQuery.mockImplementation(() => Promise.resolve({ rows: [], rowCount: 0 }));
  });

  it('scopes by company_id', async () => {
    await archiveStaleConversations('company-1');

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('company_id = $1');
    expect(sql).toContain('48 hours');
    expect(params).toEqual(['company-1']);
  });

  it('adds professional_id clause when provided', async () => {
    await archiveStaleConversations('company-1', 'prof-1');

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('professional_id = $2');
    expect(params).toEqual(['company-1', 'prof-1']);
  });

  it('does not add professional clause when null', async () => {
    await archiveStaleConversations('company-1', null);

    const [sql] = mockQuery.mock.calls[0];
    expect(sql).not.toContain('professional_id = $2');
  });
});

// ---------------------------------------------------------------------------
// Tests: isResetCommand
// ---------------------------------------------------------------------------
describe('isResetCommand', () => {
  it('recognizes /reset', () => {
    expect(isResetCommand('/reset')).toBe(true);
  });

  it('recognizes "reset" case-insensitive', () => {
    expect(isResetCommand('Reset')).toBe(true);
    expect(isResetCommand('RESET')).toBe(true);
    expect(isResetCommand('reset')).toBe(true);
  });

  it('recognizes with leading/trailing whitespace', () => {
    expect(isResetCommand('  /reset  ')).toBe(true);
  });

  it('rejects other text', () => {
    expect(isResetCommand('hola')).toBe(false);
    expect(isResetCommand('resetear')).toBe(false);
    expect(isResetCommand('/help')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: resetConversationMemory
// ---------------------------------------------------------------------------
describe('resetConversationMemory', () => {
  beforeEach(() => {
    mockClientQuery.mockReset();
    mockRelease.mockReset();
    mockConnect.mockReset();
    mockConnect.mockImplementation(() =>
      Promise.resolve({ query: mockClientQuery, release: mockRelease })
    );
  });

  it('inserts system message, archives, and resumes pauses in transaction', async () => {
    const fakeSystemMessage = { id: 'msg-1', role: 'system', content: RESET_SYSTEM_EVENT_MESSAGE };
    const fakeConversation = { id: 'conv-1', archived_at: '2026-01-01' };

    let callIndex = 0;
    mockClientQuery.mockImplementation((sql: string) => {
      callIndex++;
      if (callIndex === 1) return Promise.resolve({}); // BEGIN
      if (callIndex === 2) return Promise.resolve({ rows: [fakeSystemMessage] }); // INSERT message
      if (callIndex === 3) return Promise.resolve({ rows: [fakeConversation] }); // UPDATE conversation
      if (callIndex === 4) return Promise.resolve({ rows: [] }); // UPDATE pauses
      if (callIndex === 5) return Promise.resolve({}); // COMMIT
      return Promise.resolve({ rows: [] });
    });

    const result = await resetConversationMemory('conv-1', 'company-1');

    expect(result.systemMessage).toEqual(fakeSystemMessage);
    expect(result.conversation).toEqual(fakeConversation);
    expect(mockRelease).toHaveBeenCalledTimes(1);

    // Verify transaction flow
    const calls = mockClientQuery.mock.calls.map((c) => c[0]);
    expect(calls[0]).toBe('BEGIN');
    expect(calls[1]).toContain('INSERT INTO messages');
    expect(calls[2]).toContain('UPDATE conversations');
    expect(calls[3]).toContain('UPDATE conversation_pauses');
    expect(calls[4]).toBe('COMMIT');
  });

  it('rolls back and releases on error', async () => {
    let callIndex = 0;
    mockClientQuery.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) return Promise.resolve({}); // BEGIN
      if (callIndex === 2) return Promise.resolve({ rows: [{ id: 'msg-1' }] }); // INSERT
      if (callIndex === 3) return Promise.resolve({ rows: [] }); // UPDATE returns 0 rows
      return Promise.resolve({});
    });

    await expect(resetConversationMemory('conv-1', 'company-1')).rejects.toThrow(
      'Conversation not found'
    );

    const calls = mockClientQuery.mock.calls.map((c) => c[0]);
    expect(calls).toContain('ROLLBACK');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});
