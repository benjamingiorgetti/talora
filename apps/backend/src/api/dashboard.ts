import { Router } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { authMiddleware, getRequestCompanyId, requireCompanyScope } from './middleware';
import type { DashboardMetrics } from '@talora/shared';

export const dashboardRouter = Router();
const MIN_RELATIVE_DEMAND_SAMPLE_SIZE = 3;

type RelativeDemandQueryRow = {
  today_count: number | string;
  historical_avg_count: number | string;
  sample_size: number | string;
};

function parseMetricNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

async function loadRelativeDemand(companyId: string): Promise<DashboardMetrics['relative_demand']> {
  const result = await pool.query<RelativeDemandQueryRow>(
    `WITH requested_settings AS (
       SELECT COALESCE(
         (
           SELECT NULLIF(BTRIM(timezone), '')
           FROM company_settings
           WHERE company_id = $1
           LIMIT 1
         ),
         'America/Argentina/Buenos_Aires'
       ) AS requested_timezone
     ),
     settings AS (
       SELECT COALESCE(
         (
           SELECT name
           FROM pg_timezone_names
           WHERE name = rs.requested_timezone
           LIMIT 1
         ),
         'America/Argentina/Buenos_Aires'
       ) AS timezone
       FROM requested_settings rs
     ),
     localized AS (
       SELECT
         (a.starts_at AT TIME ZONE settings.timezone)::date AS local_date,
         (a.starts_at AT TIME ZONE settings.timezone)::time AS local_time
       FROM appointments a
       CROSS JOIN settings
       WHERE a.company_id = $1
         AND a.status = 'confirmed'
     ),
     now_ctx AS (
       SELECT
         (NOW() AT TIME ZONE settings.timezone)::date AS today_date,
         (NOW() AT TIME ZONE settings.timezone)::time AS now_time
       FROM settings
     ),
     first_activity AS (
       SELECT MIN(l.local_date) AS first_confirmed_date
       FROM localized l
     ),
     today_count AS (
       SELECT COUNT(*)::int AS count
       FROM localized l
       CROSS JOIN now_ctx n
       WHERE l.local_date = n.today_date
         AND l.local_time <= n.now_time
     ),
     comparison_days AS (
       SELECT
         (n.today_date - (week_offset * INTERVAL '7 days'))::date AS local_date
       FROM now_ctx n
       CROSS JOIN generate_series(1, 8) AS week_offset
       CROSS JOIN first_activity f
       WHERE f.first_confirmed_date IS NOT NULL
         AND (n.today_date - (week_offset * INTERVAL '7 days'))::date >= f.first_confirmed_date
     ),
     historical_days AS (
       SELECT
         cd.local_date,
         COUNT(l.local_date)::int AS count
       FROM comparison_days cd
       CROSS JOIN now_ctx n
       LEFT JOIN localized l
         ON l.local_date = cd.local_date
        AND l.local_time <= n.now_time
       GROUP BY cd.local_date
       ORDER BY cd.local_date DESC
     )
     SELECT
       COALESCE((SELECT count FROM today_count), 0)::int AS today_count,
       COALESCE(ROUND(AVG(h.count)::numeric, 1), 0)::text AS historical_avg_count,
       COUNT(*)::int AS sample_size
     FROM historical_days h`,
    [companyId]
  );

  const row = result.rows[0];
  const todayCount = parseMetricNumber(row?.today_count);
  const historicalAvgCount = parseMetricNumber(row?.historical_avg_count);
  const sampleSize = parseMetricNumber(row?.sample_size);
  const hasEnoughData = sampleSize >= MIN_RELATIVE_DEMAND_SAMPLE_SIZE && historicalAvgCount > 0;

  return {
    today_count: todayCount,
    historical_avg_count: historicalAvgCount,
    ratio_pct: hasEnoughData ? Math.round((todayCount / historicalAvgCount) * 100) : 0,
    delta_pct: hasEnoughData ? Math.round(((todayCount - historicalAvgCount) / historicalAvgCount) * 100) : 0,
    sample_size: sampleSize,
    mode: 'same_weekday_until_now',
    has_enough_data: hasEnoughData,
  };
}

dashboardRouter.use(authMiddleware, requireCompanyScope);

dashboardRouter.get('/metrics', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;
  try {
    const [confirmedResult, allResult, autoResult, lastActivityResult, relativeDemand] = await Promise.all([
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
      loadRelativeDemand(companyId),
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
      relative_demand: relativeDemand,
    };

    res.json({ data: metrics });
  } catch (err) {
    logger.error('Error loading dashboard metrics:', err);
    res.status(500).json({ error: 'Failed to load dashboard metrics' });
  }
});
