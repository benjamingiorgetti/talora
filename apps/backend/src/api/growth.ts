import { Router } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { authMiddleware, getRequestCompanyId, requireCompanyScope } from './middleware';
import { getAtRiskClients } from '../growth/analytics';
import { sendReactivationMessage } from '../growth/reactivation';
import type { ClientAnalytics, ReactivationMessage, GrowthStats, ReactivationSettings, SlotFillSettings } from '@talora/shared';
import { listPendingOpportunities, sendOpportunityCandidate, dismissOpportunity } from '../growth/slot-fill-actions';

export const growthRouter = Router();

growthRouter.use(authMiddleware, requireCompanyScope);

// GET /at-risk — paginated list of at-risk clients
growthRouter.get('/at-risk', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;

  try {
    const refresh = req.query.refresh === 'true';
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) || 1 : 1;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) || 20 : 20;
    const includeActive = req.query.include_active === 'true';

    const result = await getAtRiskClients(companyId, { refresh, page, limit, threshold: includeActive ? -1 : 0 });
    res.json(result);
  } catch (err) {
    logger.error('Error fetching at-risk clients:', err);
    res.status(500).json({ error: 'Failed to fetch at-risk clients' });
  }
});

// GET /at-risk/:id — single client analytics + last 5 appointments
growthRouter.get('/at-risk/:id', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;
  const clientId = req.params.id;

  try {
    const [analyticsResult, appointmentsResult] = await Promise.all([
      pool.query<ClientAnalytics>(
        `SELECT
          ca.*,
          c.name AS client_name,
          c.phone_number AS client_phone
         FROM client_analytics ca
         JOIN clients c ON c.id = ca.client_id
         WHERE ca.client_id = $1 AND ca.company_id = $2
         LIMIT 1`,
        [clientId, companyId]
      ),
      pool.query(
        `SELECT a.*, p.name AS professional_name, s.name AS service_name
         FROM appointments a
         LEFT JOIN professionals p ON p.id = a.professional_id
         LEFT JOIN services s ON s.id = a.service_id
         WHERE a.client_id = $1 AND a.company_id = $2
         ORDER BY a.starts_at DESC
         LIMIT 5`,
        [clientId, companyId]
      ),
    ]);

    if (!analyticsResult.rows[0]) {
      res.status(404).json({ error: 'Client analytics not found' });
      return;
    }

    res.json({
      data: {
        ...analyticsResult.rows[0],
        recent_appointments: appointmentsResult.rows,
      },
    });
  } catch (err) {
    logger.error('Error fetching client analytics:', err);
    res.status(500).json({ error: 'Failed to fetch client analytics' });
  }
});

// POST /reactivation/send — send a single reactivation message
growthRouter.post('/reactivation/send', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;
  const { clientId, messageText } = req.body as { clientId: string; messageText?: string };

  if (!clientId) {
    res.status(400).json({ error: 'clientId is required' });
    return;
  }

  try {
    const result = await sendReactivationMessage(companyId, clientId, messageText);

    if (!result.success) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ data: { reactivationId: result.reactivationId } });
  } catch (err) {
    logger.error('Error sending reactivation message:', err);
    res.status(500).json({ error: 'Failed to send reactivation message' });
  }
});

// POST /reactivation/bulk — send reactivation messages to multiple clients
growthRouter.post('/reactivation/bulk', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;
  const { clientIds, messageText } = req.body as { clientIds: string[]; messageText?: string };

  if (!Array.isArray(clientIds) || clientIds.length === 0) {
    res.status(400).json({ error: 'clientIds must be a non-empty array' });
    return;
  }

  const sent: string[] = [];
  const errors: Array<{ clientId: string; error: string }> = [];

  for (const clientId of clientIds) {
    try {
      const result = await sendReactivationMessage(companyId, clientId, messageText);

      if (!result.success) {
        // Stop immediately if rate limit hit
        if (result.status === 429) {
          errors.push({ clientId, error: result.error });
          break;
        }
        errors.push({ clientId, error: result.error });
      } else {
        sent.push(clientId);
      }
    } catch (err) {
      logger.error(`Error sending reactivation to client ${clientId}:`, err);
      errors.push({ clientId, error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  res.json({
    data: {
      sent: sent.length,
      failed: errors.length,
      errors,
    },
  });
});

// GET /reactivation — list reactivation messages for company
growthRouter.get('/reactivation', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;

  try {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) || 1 : 1;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) || 20 : 20;
    const offset = (page - 1) * limit;

    const params: unknown[] = [companyId];
    let whereClause = 'WHERE rm.company_id = $1';

    if (status) {
      params.push(status);
      whereClause += ` AND rm.status = $${params.length}`;
    }

    const [dataResult, countResult] = await Promise.all([
      pool.query<ReactivationMessage>(
        `SELECT rm.*, c.name AS client_name, c.phone_number AS client_phone
         FROM reactivation_messages rm
         JOIN clients c ON c.id = rm.client_id
         ${whereClause}
         ORDER BY rm.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM reactivation_messages rm ${whereClause}`,
        params
      ),
    ]);

    res.json({
      data: dataResult.rows,
      total: Number(countResult.rows[0]?.count ?? 0),
      page,
      limit,
    });
  } catch (err) {
    logger.error('Error listing reactivation messages:', err);
    res.status(500).json({ error: 'Failed to list reactivation messages' });
  }
});

// GET /stats — ROI stats for a period
growthRouter.get('/stats', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;

  try {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const from = typeof req.query.from === 'string' ? req.query.from : defaultFrom;
    const to = typeof req.query.to === 'string' ? req.query.to : defaultTo;

    const result = await pool.query<{
      clients_at_risk: number;
      messages_sent: number;
      clients_reactivated: number;
      conversion_rate: string;
      revenue_attributed: string;
      avg_days_to_convert: string;
    }>(
      `SELECT
        (SELECT COUNT(*)::int FROM client_analytics WHERE company_id = $1 AND risk_score > 0) AS clients_at_risk,
        (COUNT(*) FILTER (WHERE rm.status IN ('sent', 'converted')))::int AS messages_sent,
        (COUNT(*) FILTER (WHERE rm.status = 'converted'))::int AS clients_reactivated,
        CASE WHEN COUNT(*) FILTER (WHERE rm.status IN ('sent', 'converted')) > 0
          THEN ROUND(COUNT(*) FILTER (WHERE rm.status = 'converted')::numeric / COUNT(*) FILTER (WHERE rm.status IN ('sent', 'converted')) * 100, 1)
          ELSE 0
        END AS conversion_rate,
        COALESCE(SUM(s.price) FILTER (WHERE rm.status = 'converted' AND a.status = 'confirmed'), 0) AS revenue_attributed,
        COALESCE(AVG(EXTRACT(EPOCH FROM (rm.converted_at - rm.sent_at)) / 86400) FILTER (WHERE rm.status = 'converted'), 0) AS avg_days_to_convert
       FROM reactivation_messages rm
       LEFT JOIN appointments a ON rm.attributed_appointment_id = a.id
       LEFT JOIN services s ON a.service_id = s.id
       WHERE rm.company_id = $1
         AND rm.sent_at >= $2
         AND rm.sent_at < $3`,
      [companyId, from, to]
    );

    const row = result.rows[0];
    const stats: GrowthStats = {
      period: { from, to },
      clients_at_risk: row?.clients_at_risk ?? 0,
      messages_sent: row?.messages_sent ?? 0,
      clients_reactivated: row?.clients_reactivated ?? 0,
      conversion_rate: Number(row?.conversion_rate ?? 0),
      revenue_attributed: Number(row?.revenue_attributed ?? 0),
      avg_days_to_convert: Number(row?.avg_days_to_convert ?? 0),
    };

    res.json({ data: stats });
  } catch (err) {
    logger.error('Error fetching growth stats:', err);
    res.status(500).json({ error: 'Failed to fetch growth stats' });
  }
});

// GET /settings — read reactivation settings
growthRouter.get('/settings', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;

  try {
    const result = await pool.query<ReactivationSettings & SlotFillSettings>(
      `SELECT
        reactivation_enabled,
        reactivation_threshold_days,
        reactivation_auto_send,
        reactivation_message_template,
        slot_fill_enabled,
        slot_fill_manual_review,
        slot_fill_max_candidates,
        slot_fill_message_template
       FROM company_settings
       WHERE company_id = $1`,
      [companyId]
    );

    if (!result.rows[0]) {
      res.json({
        data: {
          reactivation_enabled: false,
          reactivation_threshold_days: 7,
          reactivation_auto_send: false,
          reactivation_message_template: null,
          slot_fill_enabled: false,
          slot_fill_manual_review: true,
          slot_fill_max_candidates: 3,
          slot_fill_message_template: null,
        } as ReactivationSettings & SlotFillSettings,
      });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error fetching reactivation settings:', err);
    res.status(500).json({ error: 'Failed to fetch reactivation settings' });
  }
});

// PUT /settings — update reactivation settings (admin_empresa only)
growthRouter.put('/settings', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;

  if (req.user?.role !== 'admin_empresa' && req.user?.role !== 'superadmin') {
    res.status(403).json({ error: 'Only admin_empresa can update reactivation settings' });
    return;
  }

  try {
    const {
      reactivation_enabled,
      reactivation_threshold_days,
      reactivation_auto_send,
      reactivation_message_template,
      slot_fill_enabled,
      slot_fill_manual_review,
      slot_fill_max_candidates,
      slot_fill_message_template,
    } = req.body as Partial<ReactivationSettings & SlotFillSettings>;

    const result = await pool.query<ReactivationSettings & SlotFillSettings>(
      `INSERT INTO company_settings (
        company_id,
        reactivation_enabled,
        reactivation_threshold_days,
        reactivation_auto_send,
        reactivation_message_template,
        slot_fill_enabled,
        slot_fill_manual_review,
        slot_fill_max_candidates,
        slot_fill_message_template
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (company_id) DO UPDATE SET
        reactivation_enabled = COALESCE($2, company_settings.reactivation_enabled),
        reactivation_threshold_days = COALESCE($3, company_settings.reactivation_threshold_days),
        reactivation_auto_send = COALESCE($4, company_settings.reactivation_auto_send),
        reactivation_message_template = COALESCE($5, company_settings.reactivation_message_template),
        slot_fill_enabled = COALESCE($6, company_settings.slot_fill_enabled),
        slot_fill_manual_review = COALESCE($7, company_settings.slot_fill_manual_review),
        slot_fill_max_candidates = COALESCE($8, company_settings.slot_fill_max_candidates),
        slot_fill_message_template = COALESCE($9, company_settings.slot_fill_message_template),
        updated_at = NOW()
      RETURNING
        reactivation_enabled,
        reactivation_threshold_days,
        reactivation_auto_send,
        reactivation_message_template,
        slot_fill_enabled,
        slot_fill_manual_review,
        slot_fill_max_candidates,
        slot_fill_message_template`,
      [
        companyId,
        reactivation_enabled ?? false,
        reactivation_threshold_days ?? 7,
        reactivation_auto_send ?? false,
        reactivation_message_template ?? null,
        slot_fill_enabled ?? false,
        slot_fill_manual_review ?? true,
        slot_fill_max_candidates ?? 3,
        slot_fill_message_template ?? null,
      ]
    );

    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error updating reactivation settings:', err);
    res.status(500).json({ error: 'Failed to update reactivation settings' });
  }
});

// ---------------------------------------------------------------------------
// Slot Fill: Manual Review Endpoints
// ---------------------------------------------------------------------------

// GET /slot-fill/opportunities — list pending slot fill opportunities
growthRouter.get('/slot-fill/opportunities', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;

  try {
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) || 1 : 1;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) || 10 : 10;

    const result = await listPendingOpportunities(companyId, { page, limit });
    res.json(result);
  } catch (err) {
    logger.error('Error listing slot fill opportunities:', err);
    res.status(500).json({ error: 'Failed to list slot fill opportunities' });
  }
});

// POST /slot-fill/opportunities/:id/send — send message to a candidate
growthRouter.post('/slot-fill/opportunities/:id/send', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;
  const { candidateId, messageText } = req.body as { candidateId: string; messageText?: string };

  if (!candidateId) {
    res.status(400).json({ error: 'candidateId is required' });
    return;
  }

  try {
    const result = await sendOpportunityCandidate(companyId, req.params.id, candidateId, messageText);

    if (!result.success) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ data: { reactivationId: result.reactivationId } });
  } catch (err) {
    logger.error('Error sending slot fill message:', err);
    res.status(500).json({ error: 'Failed to send slot fill message' });
  }
});

// POST /slot-fill/opportunities/:id/dismiss — dismiss an opportunity
growthRouter.post('/slot-fill/opportunities/:id/dismiss', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;

  try {
    await dismissOpportunity(companyId, req.params.id);
    res.json({ data: { dismissed: true } });
  } catch (err) {
    logger.error('Error dismissing slot fill opportunity:', err);
    res.status(500).json({ error: 'Failed to dismiss slot fill opportunity' });
  }
});
