import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import type { ClientAnalytics } from '@talora/shared';

export async function computeClientAnalytics(companyId: string): Promise<void> {
  // Generates an analytics row for EVERY client in the company.
  // Clients with 0-1 appointments get defaults (risk_score=0, avg_frequency=null).
  // Clients with 2+ confirmed appointments get full frequency/risk calculations.
  const analyticsQuery = `
    WITH client_appointments AS (
      SELECT
        a.client_id,
        a.starts_at,
        COALESCE(s.price, 0) AS price,
        LAG(a.starts_at) OVER (PARTITION BY a.client_id ORDER BY a.starts_at) AS prev_starts_at
      FROM appointments a
      LEFT JOIN services s ON a.service_id = s.id
      WHERE a.company_id = $1 AND a.status = 'confirmed' AND a.client_id IS NOT NULL
    ),
    per_client AS (
      SELECT
        c.id AS client_id,
        COALESCE(agg.total_appointments, 0)::int AS total_appointments,
        COALESCE(agg.total_revenue, 0)::numeric(10,2) AS total_revenue,
        agg.last_appointment_at,
        CASE WHEN agg.last_appointment_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (NOW() - agg.last_appointment_at)) / 86400
          ELSE NULL
        END AS days_since_last,
        freq.avg_frequency_days
      FROM clients c
      LEFT JOIN (
        SELECT
          client_id,
          COUNT(*)::int AS total_appointments,
          SUM(price)::numeric(10,2) AS total_revenue,
          MAX(starts_at) AS last_appointment_at
        FROM client_appointments
        GROUP BY client_id
      ) agg ON agg.client_id = c.id
      LEFT JOIN (
        SELECT
          client_id,
          AVG(EXTRACT(EPOCH FROM (starts_at - prev_starts_at)) / 86400) AS avg_frequency_days
        FROM client_appointments
        WHERE prev_starts_at IS NOT NULL
        GROUP BY client_id
      ) freq ON freq.client_id = c.id
      WHERE c.company_id = $1 AND c.is_active = true
    )
    SELECT
      client_id,
      total_appointments,
      total_revenue,
      avg_frequency_days,
      last_appointment_at,
      CASE WHEN days_since_last IS NOT NULL THEN ROUND(days_since_last)::int ELSE NULL END AS days_since_last,
      CASE WHEN avg_frequency_days IS NOT NULL
        THEN GREATEST(ROUND(days_since_last - avg_frequency_days), 0)::int
        ELSE 0
      END AS days_overdue,
      CASE WHEN avg_frequency_days IS NOT NULL AND avg_frequency_days > 0
        THEN LEAST(GREATEST(ROUND((days_since_last - avg_frequency_days) / avg_frequency_days * 100), 0), 100)::int
        ELSE 0
      END AS risk_score
    FROM per_client
  `;

  const result = await pool.query<{
    client_id: string;
    total_appointments: number;
    total_revenue: string;
    avg_frequency_days: string | null;
    last_appointment_at: Date | null;
    days_since_last: number | null;
    days_overdue: number;
    risk_score: number;
  }>(analyticsQuery, [companyId]);

  if (result.rows.length === 0) {
    logger.info(`[analytics] No clients found for company ${companyId}`);
    return;
  }

  // Bulk UPSERT using unnest() — single round trip instead of N
  const clientIds = result.rows.map((r) => r.client_id);
  const totalAppointments = result.rows.map((r) => r.total_appointments);
  const totalRevenues = result.rows.map((r) => Number(r.total_revenue));
  const avgFrequencies = result.rows.map((r) => r.avg_frequency_days !== null ? Number(r.avg_frequency_days) : null);
  const lastAppointments = result.rows.map((r) => r.last_appointment_at);
  const daysSinceLasts = result.rows.map((r) => r.days_since_last);
  const daysOverdues = result.rows.map((r) => r.days_overdue);
  const riskScores = result.rows.map((r) => r.risk_score);

  await pool.query(
    `INSERT INTO client_analytics (
      client_id, company_id, total_appointments, total_revenue,
      avg_frequency_days, last_appointment_at, days_since_last,
      days_overdue, risk_score, computed_at
    )
    SELECT
      unnest($1::uuid[]),
      $2,
      unnest($3::int[]),
      unnest($4::numeric[]),
      unnest($5::numeric[]),
      unnest($6::timestamptz[]),
      unnest($7::int[]),
      unnest($8::int[]),
      unnest($9::int[]),
      NOW()
    ON CONFLICT (client_id) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      total_appointments = EXCLUDED.total_appointments,
      total_revenue = EXCLUDED.total_revenue,
      avg_frequency_days = EXCLUDED.avg_frequency_days,
      last_appointment_at = EXCLUDED.last_appointment_at,
      days_since_last = EXCLUDED.days_since_last,
      days_overdue = EXCLUDED.days_overdue,
      risk_score = EXCLUDED.risk_score,
      computed_at = NOW()`,
    [
      clientIds,
      companyId,
      totalAppointments,
      totalRevenues,
      avgFrequencies,
      lastAppointments,
      daysSinceLasts,
      daysOverdues,
      riskScores,
    ]
  );

  logger.info(`[analytics] Upserted ${result.rows.length} client analytics records for company ${companyId}`);
}

export async function getAtRiskClients(
  companyId: string,
  options?: { refresh?: boolean; page?: number; limit?: number; threshold?: number }
): Promise<{ data: ClientAnalytics[]; total: number; page: number; limit: number }> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const threshold = options?.threshold ?? 0;
  const offset = (page - 1) * limit;

  // Check if data is stale (>24h) or refresh requested
  const stalenessResult = await pool.query<{ computed_at: Date }>(
    `SELECT MIN(computed_at) AS computed_at FROM client_analytics WHERE company_id = $1`,
    [companyId]
  );

  const oldestComputedAt = stalenessResult.rows[0]?.computed_at;
  const isStale =
    !oldestComputedAt ||
    new Date().getTime() - new Date(oldestComputedAt).getTime() > 24 * 60 * 60 * 1000;

  if (isStale || options?.refresh) {
    await computeClientAnalytics(companyId);
  }

  const [dataResult, countResult] = await Promise.all([
    pool.query<ClientAnalytics>(
      `SELECT
        ca.*,
        c.name AS client_name,
        c.phone_number AS client_phone
       FROM client_analytics ca
       JOIN clients c ON c.id = ca.client_id
       WHERE ca.company_id = $1 AND ca.risk_score > $2
       ORDER BY ca.risk_score DESC
       LIMIT $3 OFFSET $4`,
      [companyId, threshold, limit, offset]
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM client_analytics WHERE company_id = $1 AND risk_score > $2`,
      [companyId, threshold]
    ),
  ]);

  return {
    data: dataResult.rows,
    total: Number(countResult.rows[0]?.count ?? 0),
    page,
    limit,
  };
}
