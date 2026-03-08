import { Router } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import type { Conversation, Message } from '@bottoo/shared';

export const conversationsRouter = Router();

// GET / — list conversations with optional instance_id filter, paginated
conversationsRouter.get('/', async (req, res) => {
  const { instance_id, page = '1', limit = '20' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  try {
    let query = 'SELECT * FROM conversations';
    const values: unknown[] = [];

    if (instance_id) {
      query += ' WHERE instance_id = $1';
      values.push(instance_id);
    }

    query += ' ORDER BY last_message_at DESC NULLS LAST';
    query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limitNum, offset);

    // Run data + count queries in parallel
    let countQuery = 'SELECT COUNT(*) as total FROM conversations';
    const countValues: unknown[] = [];
    if (instance_id) {
      countQuery += ' WHERE instance_id = $1';
      countValues.push(instance_id);
    }

    const [result, countResult] = await Promise.all([
      pool.query<Conversation>(query, values),
      pool.query<{ total: string }>(countQuery, countValues),
    ]);
    const total = parseInt(countResult.rows[0].total, 10);

    res.json({
      data: result.rows,
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
  const { before, limit: limitParam } = req.query;
  const limit = Math.min(100, Math.max(1, parseInt(limitParam as string, 10) || 50));

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
