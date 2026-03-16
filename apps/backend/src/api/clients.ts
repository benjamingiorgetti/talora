import { Request, Router } from 'express';
import { pool } from '../db/pool';
import { buildUpdateSet } from '../db/query-helpers';
import { getAgentConfig } from '../cache/agent-cache';
import { logger } from '../utils/logger';
import type { Client, ClientDetailAnalytics } from '@talora/shared';
import { computeClientAnalytics } from '../growth/analytics';
import { authMiddleware, getRequestCompanyId, getRequestProfessionalId, requireCompanyScope } from './middleware';
import { validateBody, createClientSchema, updateClientSchema } from './validation';

export const clientsRouter = Router();

clientsRouter.use(authMiddleware, requireCompanyScope);

async function getAgentId(companyId: string): Promise<string | null> {
  const config = await getAgentConfig(companyId);
  return config?.agent.id ?? null;
}

function getScopedProfessionalId(req: Request): string | null {
  return req.user?.role === 'professional' ? req.user.professionalId ?? null : getRequestProfessionalId(req);
}

// GET / — list clients, ?search= filters by name/phone
clientsRouter.get('/', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req)!;
    const professionalId = getScopedProfessionalId(req);
    const agentId = await getAgentId(companyId);
    if (!agentId) {
      res.status(404).json({ error: 'No agent configured' });
      return;
    }

    const search = req.query.search as string | undefined;
    let query: string;
    let params: unknown[];

    if (search && search.trim()) {
      const pattern = `%${search.trim()}%`;
      query = `
        SELECT c.*,
               next_appointment.starts_at AS next_appointment_at,
               COALESCE(recent_appointments.items, '[]'::json) AS recent_appointments,
               COALESCE(booked_services.items, '[]'::json) AS booked_services
        FROM clients c
        LEFT JOIN LATERAL (
          SELECT a.starts_at
          FROM appointments a
          WHERE (a.client_id = c.id OR (a.phone_number = c.phone_number AND a.company_id = c.company_id)) AND a.status = 'confirmed' AND a.starts_at >= NOW()
          ORDER BY a.starts_at ASC
          LIMIT 1
        ) AS next_appointment ON true
        LEFT JOIN LATERAL (
          SELECT json_agg(json_build_object('id', a.id, 'starts_at', a.starts_at, 'status', a.status) ORDER BY a.starts_at DESC) AS items
          FROM (
            SELECT a.id, a.starts_at, a.status
            FROM appointments a
            WHERE (a.client_id = c.id OR (a.phone_number = c.phone_number AND a.company_id = c.company_id))
            ORDER BY a.starts_at DESC
            LIMIT 3
          ) a
        ) AS recent_appointments ON true
        LEFT JOIN LATERAL (
          SELECT json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) AS items
          FROM appointments a
          JOIN services s ON s.id = a.service_id
          WHERE (a.client_id = c.id OR (a.phone_number = c.phone_number AND a.company_id = c.company_id)) AND a.service_id IS NOT NULL
        ) AS booked_services ON true
        WHERE c.agent_id = $1
          AND c.company_id = $2
          AND ($3::uuid IS NULL OR c.professional_id = $3)
          AND (c.name ILIKE $4 OR c.phone_number ILIKE $4)
        ORDER BY next_appointment.starts_at ASC NULLS LAST, c.name ASC`;
      params = [agentId, companyId, professionalId, pattern];
    } else {
      query = `
        SELECT c.*,
               next_appointment.starts_at AS next_appointment_at,
               COALESCE(recent_appointments.items, '[]'::json) AS recent_appointments,
               COALESCE(booked_services.items, '[]'::json) AS booked_services
        FROM clients c
        LEFT JOIN LATERAL (
          SELECT a.starts_at
          FROM appointments a
          WHERE (a.client_id = c.id OR (a.phone_number = c.phone_number AND a.company_id = c.company_id)) AND a.status = 'confirmed' AND a.starts_at >= NOW()
          ORDER BY a.starts_at ASC
          LIMIT 1
        ) AS next_appointment ON true
        LEFT JOIN LATERAL (
          SELECT json_agg(json_build_object('id', a.id, 'starts_at', a.starts_at, 'status', a.status) ORDER BY a.starts_at DESC) AS items
          FROM (
            SELECT a.id, a.starts_at, a.status
            FROM appointments a
            WHERE (a.client_id = c.id OR (a.phone_number = c.phone_number AND a.company_id = c.company_id))
            ORDER BY a.starts_at DESC
            LIMIT 3
          ) a
        ) AS recent_appointments ON true
        LEFT JOIN LATERAL (
          SELECT json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) AS items
          FROM appointments a
          JOIN services s ON s.id = a.service_id
          WHERE (a.client_id = c.id OR (a.phone_number = c.phone_number AND a.company_id = c.company_id)) AND a.service_id IS NOT NULL
        ) AS booked_services ON true
        WHERE c.agent_id = $1
          AND c.company_id = $2
          AND ($3::uuid IS NULL OR c.professional_id = $3)
        ORDER BY next_appointment.starts_at ASC NULLS LAST, c.name ASC`;
      params = [agentId, companyId, professionalId];
    }

    const result = await pool.query<Client>(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing clients:', err);
    res.status(500).json({ error: 'Failed to list clients' });
  }
});

// GET /:id — single client with full appointment history
clientsRouter.get('/:id', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req)!;
    const professionalId = getScopedProfessionalId(req);
    const agentId = await getAgentId(companyId);
    if (!agentId) {
      res.status(404).json({ error: 'No agent configured' });
      return;
    }

    const result = await pool.query<Client>(
      `SELECT c.*,
              next_appointment.starts_at AS next_appointment_at,
              COALESCE(booked_services.items, '[]'::json) AS booked_services
       FROM clients c
       LEFT JOIN LATERAL (
         SELECT a.starts_at
         FROM appointments a
         WHERE (a.client_id = c.id OR (a.phone_number = c.phone_number AND a.company_id = c.company_id)) AND a.status = 'confirmed' AND a.starts_at >= NOW()
         ORDER BY a.starts_at ASC
         LIMIT 1
       ) AS next_appointment ON true
       LEFT JOIN LATERAL (
         SELECT json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) AS items
         FROM appointments a
         JOIN services s ON s.id = a.service_id
         WHERE (a.client_id = c.id OR (a.phone_number = c.phone_number AND a.company_id = c.company_id)) AND a.service_id IS NOT NULL
       ) AS booked_services ON true
       WHERE c.id = $1
         AND c.agent_id = $2
         AND c.company_id = $3
         AND ($4::uuid IS NULL OR c.professional_id = $4)`,
      [req.params.id, agentId, companyId, professionalId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Fetch full appointment history for this client (by client_id or phone match)
    const client = result.rows[0];
    const appointments = await pool.query(
      `SELECT a.id, a.starts_at, a.ends_at, a.status, s.name AS service_name, p.name AS professional_name
       FROM appointments a
       LEFT JOIN services s ON s.id = a.service_id
       LEFT JOIN professionals p ON p.id = a.professional_id
       WHERE (a.client_id = $1 OR (a.phone_number = $2 AND a.company_id = $3))
       ORDER BY a.starts_at DESC
       LIMIT 20`,
      [req.params.id, client.phone_number, companyId]
    );

    res.json({ data: { ...result.rows[0], appointments: appointments.rows } });
  } catch (err) {
    logger.error('Error fetching client:', err);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

const DOW_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// GET /:id/analytics — client KPI metrics
clientsRouter.get('/:id/analytics', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req)!;
    const professionalId = getScopedProfessionalId(req);

    // Verify client exists and belongs to this company
    const clientResult = await pool.query(
      `SELECT id FROM clients
       WHERE id = $1 AND company_id = $2 AND ($3::uuid IS NULL OR professional_id = $3)`,
      [req.params.id, companyId, professionalId]
    );
    if (clientResult.rows.length === 0) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Check staleness of client_analytics and refresh if needed
    const stalenessResult = await pool.query<{ computed_at: Date }>(
      `SELECT computed_at FROM client_analytics WHERE client_id = $1`,
      [req.params.id]
    );
    const computedAt = stalenessResult.rows[0]?.computed_at;
    const isStale = !computedAt || Date.now() - new Date(computedAt).getTime() > 24 * 60 * 60 * 1000;
    if (isStale) {
      await computeClientAnalytics(companyId);
    }

    // Query 1: client_analytics (may still be missing if client has <2 appointments)
    const analyticsResult = await pool.query<{
      total_appointments: number;
      total_revenue: string;
      avg_frequency_days: string | null;
      last_appointment_at: string | null;
      risk_score: number;
    }>(
      `SELECT total_appointments, total_revenue, avg_frequency_days, last_appointment_at, risk_score
       FROM client_analytics WHERE client_id = $1`,
      [req.params.id]
    );

    // Fallback if client_analytics row is missing (new client or compute not yet run)
    let totalAppointments = 0;
    let totalRevenue = 0;
    let avgFrequencyDays: number | null = null;
    let lastAppointmentAt: string | null = null;
    let riskScore = 0;

    if (analyticsResult.rows.length > 0) {
      const row = analyticsResult.rows[0];
      totalAppointments = row.total_appointments;
      totalRevenue = Number(row.total_revenue);
      avgFrequencyDays = row.avg_frequency_days !== null ? Number(row.avg_frequency_days) : null;
      lastAppointmentAt = row.last_appointment_at;
      riskScore = row.risk_score;
    } else {
      // No analytics row yet — compute basics directly
      const basicResult = await pool.query<{ count: string; revenue: string; last_at: string | null }>(
        `SELECT COUNT(*)::text AS count,
                COALESCE(SUM(s.price), 0)::text AS revenue,
                MAX(a.starts_at)::text AS last_at
         FROM appointments a
         LEFT JOIN services s ON s.id = a.service_id
         WHERE a.client_id = $1 AND a.status = 'confirmed'`,
        [req.params.id]
      );
      totalAppointments = Number(basicResult.rows[0]?.count ?? 0);
      totalRevenue = Number(basicResult.rows[0]?.revenue ?? 0);
      lastAppointmentAt = basicResult.rows[0]?.last_at ?? null;
    }

    // Query 2: preferred day of week
    const dowResult = await pool.query<{ dow: string }>(
      `SELECT EXTRACT(DOW FROM starts_at)::text AS dow
       FROM appointments
       WHERE client_id = $1 AND status = 'confirmed'
       GROUP BY EXTRACT(DOW FROM starts_at)
       ORDER BY COUNT(*) DESC
       LIMIT 1`,
      [req.params.id]
    );
    const preferredDay = dowResult.rows.length > 0 ? DOW_LABELS[Number(dowResult.rows[0].dow)] : null;

    // Query 3: reactivation stats
    const reactivationResult = await pool.query<{ sent: string; converted: string }>(
      `SELECT
         COUNT(*) FILTER(WHERE status IN ('sent', 'converted'))::text AS sent,
         COUNT(*) FILTER(WHERE status = 'converted')::text AS converted
       FROM reactivation_messages
       WHERE client_id = $1`,
      [req.params.id]
    );
    const messagesSent = Number(reactivationResult.rows[0]?.sent ?? 0);
    const converted = Number(reactivationResult.rows[0]?.converted ?? 0);

    const avgTicket = totalAppointments > 0 ? Math.round(totalRevenue / totalAppointments) : 0;
    const responseRate = messagesSent > 0 ? Math.round((converted / messagesSent) * 1000) / 10 : 0;

    const analytics: ClientDetailAnalytics = {
      last_appointment_at: lastAppointmentAt,
      avg_ticket: avgTicket,
      avg_frequency_days: avgFrequencyDays !== null ? Math.round(avgFrequencyDays * 10) / 10 : null,
      total_appointments: totalAppointments,
      total_revenue: totalRevenue,
      preferred_day: preferredDay,
      messages_sent: messagesSent,
      response_rate: responseRate,
      conversion_rate: responseRate, // same metric in reactivation context
      risk_score: riskScore,
    };

    res.json({ data: analytics });
  } catch (err) {
    logger.error('Error fetching client analytics:', err);
    res.status(500).json({ error: 'Failed to fetch client analytics' });
  }
});

// POST / — create client
clientsRouter.post('/', validateBody(createClientSchema), async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req)!;
    const professionalScopeId = req.user?.role === 'professional' ? req.user.professionalId ?? null : null;
    const agentId = await getAgentId(companyId);
    if (!agentId) {
      res.status(404).json({ error: 'No agent configured' });
      return;
    }

    const { phone_number, name, client_type, branch, delivery_days, payment_terms, notes, is_active, professional_id } = req.body;

    const ownerProfessionalId = professionalScopeId ?? (typeof professional_id === 'string' ? professional_id : null);
    if (!ownerProfessionalId) {
      res.status(400).json({ error: 'professional_id is required' });
      return;
    }

    const result = await pool.query<Client>(
      `INSERT INTO clients (company_id, agent_id, professional_id, phone_number, name, client_type, branch, delivery_days, payment_terms, notes, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        companyId,
        agentId,
        ownerProfessionalId,
        phone_number.replace(/\D/g, ''),
        name || '',
        client_type || 'cliente',
        branch || '',
        delivery_days || '',
        payment_terms || '',
        notes || '',
        is_active !== undefined ? is_active : true,
      ]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      res.status(409).json({ error: 'Ya existe un cliente con ese numero de telefono' });
      return;
    }
    logger.error('Error creating client:', err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// PUT /:id — update client
clientsRouter.put('/:id', validateBody(updateClientSchema), async (req, res) => {
  const { id } = req.params;
  const { phone_number, name, client_type, branch, delivery_days, payment_terms, notes, is_active, professional_id } = req.body;
  const scopedProfessionalId = req.user?.role === 'professional' ? req.user.professionalId ?? null : null;

  const fields: Record<string, unknown> = {
    phone_number: phone_number !== undefined ? phone_number.replace(/\D/g, '') : undefined,
    name,
    client_type,
    branch,
    delivery_days,
    payment_terms,
    notes,
    is_active,
    professional_id: scopedProfessionalId ? undefined : professional_id,
  };

  const update = buildUpdateSet(fields);
  if (!update) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  update.setClause += ', updated_at = NOW()';
  const companyId = getRequestCompanyId(req)!;
  update.values.push(companyId, scopedProfessionalId, id);

  try {
    const result = await pool.query<Client>(
      `UPDATE clients
       SET ${update.setClause}
       WHERE company_id = $${update.nextIndex}
         AND ($${update.nextIndex + 1}::uuid IS NULL OR professional_id = $${update.nextIndex + 1})
         AND id = $${update.nextIndex + 2}
       RETURNING *`,
      update.values
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    res.json({ data: result.rows[0] });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
      res.status(409).json({ error: 'Ya existe un cliente con ese numero de telefono' });
      return;
    }
    logger.error('Error updating client:', err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// DELETE /:id — delete client
clientsRouter.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM clients
       WHERE id = $1
         AND company_id = $2
         AND ($3::uuid IS NULL OR professional_id = $3)
       RETURNING id`,
      [req.params.id, getRequestCompanyId(req), req.user?.role === 'professional' ? req.user.professionalId ?? null : null]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error('Error deleting client:', err);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});
