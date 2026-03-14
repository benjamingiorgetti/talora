import { Router } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { authMiddleware, getRequestCompanyId, requireCompanyScope } from './middleware';
import type { DashboardMetrics } from '@talora/shared';

export const dashboardRouter = Router();

dashboardRouter.use(authMiddleware, requireCompanyScope);

dashboardRouter.get('/metrics', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;
  try {
    const [confirmedResult, allResult, autoResult, lastActivityResult] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM appointments
         WHERE company_id = $1 AND status = 'confirmed'`,
        [companyId]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM appointments
         WHERE company_id = $1`,
        [companyId]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM appointments
         WHERE company_id = $1 AND source = 'bot' AND status = 'confirmed'`,
        [companyId]
      ),
      pool.query<{ last_activity: string | null }>(
        `SELECT MAX(last_message_at) AS last_activity
         FROM conversations
         WHERE company_id = $1 AND archived_at IS NULL`,
        [companyId]
      ),
    ]);

    const confirmed = Number(confirmedResult.rows[0]?.count ?? 0);
    const total = Number(allResult.rows[0]?.count ?? 0);
    const automated = Number(autoResult.rows[0]?.count ?? 0);
    const lastActivity = lastActivityResult.rows[0]?.last_activity ?? null;

    const metrics: DashboardMetrics = {
      confirmed_appointments: confirmed,
      automation_rate: total > 0 ? Math.round((automated / total) * 100) : 0,
      confirmation_rate: total > 0 ? Math.round((confirmed / total) * 100) : 0,
      estimated_time_saved_minutes: automated * 12,
      last_bot_activity_at: lastActivity,
    };

    res.json({ data: metrics });
  } catch (err) {
    logger.error('Error loading dashboard metrics:', err);
    res.status(500).json({ error: 'Failed to load dashboard metrics' });
  }
});
