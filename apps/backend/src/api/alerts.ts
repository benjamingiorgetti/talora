import { Router } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import type { Alert } from '@talora/shared';

export const alertsRouter = Router();

// GET / — list alerts with pagination
alertsRouter.get('/', async (req, res) => {
  const { page = '1', limit = '50' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  try {
    const [result, countResult] = await Promise.all([
      pool.query<Alert>(
        'SELECT * FROM alerts ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limitNum, offset]
      ),
      pool.query<{ total: string }>('SELECT COUNT(*) as total FROM alerts'),
    ]);

    res.json({
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(countResult.rows[0].total, 10),
      },
    });
  } catch (err) {
    logger.error('Error listing alerts:', err);
    res.status(500).json({ error: 'Failed to list alerts' });
  }
});
