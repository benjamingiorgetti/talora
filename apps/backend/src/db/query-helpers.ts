/**
 * Builds a dynamic SET clause for UPDATE queries from a partial object.
 * Returns null if no fields to update.
 */
export function buildUpdateSet(
  fields: Record<string, unknown>,
  startIndex = 1
): { setClause: string; values: unknown[]; nextIndex: number } | null {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return null;

  const values: unknown[] = [];
  const parts: string[] = [];
  let idx = startIndex;

  for (const [key, value] of entries) {
    const col = key === 'order' ? `"order"` : key;
    parts.push(`${col} = $${idx++}`);
    values.push(value);
  }

  return { setClause: parts.join(', '), values, nextIndex: idx };
}
