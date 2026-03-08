import { Router } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import type { Conversation, Message } from '@bottoo/shared';

export const conversationsRouter = Router();

// --- Input validation helpers ---
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function parsePositiveInt(value: unknown, fallback: number): number | null {
  if (value === undefined || value === null) return fallback;
  const parsed = parseInt(String(value), 10);
  if (isNaN(parsed) || parsed < 0) return null;
  return parsed;
}

// GET / — list conversations with optional instance_id filter, paginated
conversationsRouter.get('/', async (req, res) => {
  const { instance_id, page = '1', limit = '20' } = req.query;

  // Validate instance_id if provided
  if (instance_id && !isValidUuid(instance_id as string)) {
    res.status(400).json({ error: 'Invalid instance_id format' });
    return;
  }

  const parsedPage = parsePositiveInt(page, 1);
  const parsedLimit = parsePositiveInt(limit, 20);

  if (parsedPage === null || parsedLimit === null) {
    res.status(400).json({ error: 'page and limit must be valid positive numbers' });
    return;
  }

  const pageNum = Math.max(1, parsedPage);
  const limitNum = Math.min(100, Math.max(1, parsedLimit));
  const offset = (pageNum - 1) * limitNum;

  try {
    // Single query with COUNT(*) OVER() window function to get data + total in one round-trip
    let query = 'SELECT *, COUNT(*) OVER() AS _total FROM conversations';
    const values: unknown[] = [];

    if (instance_id) {
      query += ' WHERE instance_id = $1';
      values.push(instance_id);
    }

    query += ' ORDER BY last_message_at DESC NULLS LAST';
    query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limitNum, offset);

    const result = await pool.query<Conversation & { _total: string }>(query, values);
    const total = result.rows.length > 0 ? parseInt(result.rows[0]._total, 10) : 0;

    // Strip the _total column from response rows
    const data = result.rows.map(({ _total, ...row }) => row);

    res.json({
      data,
      pagination: { page: pageNum, limit: limitNum, total },
    });
  } catch (err) {
    logger.error('Error listing conversations:', err);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// GET /:id/messages — list messages for conversation (cursor-based pagination)
conversationsRouter.get('/:id/messages', async (req, res) => {
  const { id } = req.params;

  if (!isValidUuid(id)) {
    res.status(400).json({ error: 'Invalid conversation ID format' });
    return;
  }

  const { before, limit: limitParam } = req.query;

  // Validate 'before' cursor if provided
  if (before && !isValidUuid(before as string)) {
    res.status(400).json({ error: 'Invalid cursor format' });
    return;
  }

  const parsedLimit = parsePositiveInt(limitParam, 50);
  if (parsedLimit === null) {
    res.status(400).json({ error: 'limit must be a valid positive number' });
    return;
  }

  const limit = Math.min(100, Math.max(1, parsedLimit));

  try {
    let query: string;
    const values: unknown[] = [id];

    if (before) {
      values.push(before, limit + 1);
      query = `SELECT * FROM messages
               WHERE conversation_id = $1 AND created_at < (SELECT created_at FROM messages WHERE id = $2)
               ORDER BY created_at DESC
               LIMIT $3`;
    } else {
      values.push(limit + 1);
      query = `SELECT * FROM messages
               WHERE conversation_id = $1
               ORDER BY created_at DESC
               LIMIT $2`;
    }

    const result = await pool.query<Message>(query, values);
    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit).reverse();

    res.json({
      data: rows,
      pagination: {
        has_more: hasMore,
        oldest_cursor: rows.length > 0 ? rows[0].id : null,
      },
    });
  } catch (err) {
    logger.error('Error listing messages:', err);
    res.status(500).json({ error: 'Failed to list messages' });
  }
});
