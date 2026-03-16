import { Request, Router } from 'express';
import { pool } from '../db/pool';
import { buildUpdateSet } from '../db/query-helpers';
import { getAgentConfig } from '../cache/agent-cache';
import { logger } from '../utils/logger';
import type { Client } from '@talora/shared';
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
