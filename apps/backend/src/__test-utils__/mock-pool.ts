import { mock } from 'bun:test';

export function createMockQuery() {
  return mock(() => Promise.resolve({ rows: [], rowCount: 0 }));
}

/**
 * Configure a mock query to return specific results based on SQL pattern matching.
 * Each entry is [sqlSubstring, returnRows].
 */
export function setupQueryMock(
  mockQuery: ReturnType<typeof mock>,
  responses: Array<[string, unknown[]]>
) {
  mockQuery.mockImplementation((...args: unknown[]) => {
    const sql = typeof args[0] === 'string' ? args[0] : '';
    for (const [pattern, rows] of responses) {
      if (sql.includes(pattern)) {
        return Promise.resolve({ rows, rowCount: rows.length });
      }
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
}
