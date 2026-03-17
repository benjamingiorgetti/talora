import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { sendOutboundMessage } from './reactivation';
import type { SlotFillOpportunity, SlotFillCandidate } from '@talora/shared';

export async function listPendingOpportunities(
  companyId: string,
  options?: { page?: number; limit?: number }
): Promise<{ data: SlotFillOpportunity[]; total: number; page: number; limit: number }> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 10;
  const offset = (page - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    pool.query<SlotFillOpportunity>(
      `SELECT
        o.id, o.company_id, o.appointment_id, o.service_id, o.professional_id,
        o.slot_starts_at, o.slot_ends_at, o.service_name, o.professional_name,
        o.status, o.created_at, o.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', sc.id,
              'opportunity_id', sc.opportunity_id,
              'client_id', sc.client_id,
              'score', sc.score,
              'match_reasons', sc.match_reasons,
              'status', sc.status,
              'reactivation_message_id', sc.reactivation_message_id,
              'client_name', c.name,
              'client_phone', c.phone_number,
              'days_overdue', COALESCE(ca.days_overdue, 0),
              'created_at', sc.created_at,
              'updated_at', sc.updated_at
            ) ORDER BY sc.score DESC
          ) FILTER (WHERE sc.id IS NOT NULL),
          '[]'::json
        ) AS candidates
       FROM slot_fill_opportunities o
       LEFT JOIN slot_fill_candidates sc ON sc.opportunity_id = o.id
       LEFT JOIN clients c ON c.id = sc.client_id
       LEFT JOIN client_analytics ca ON ca.client_id = sc.client_id
       WHERE o.company_id = $1
         AND o.status = 'pending'
         AND o.slot_starts_at > NOW()
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT $2 OFFSET $3`,
      [companyId, limit, offset]
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM slot_fill_opportunities
       WHERE company_id = $1
         AND status = 'pending'
         AND slot_starts_at > NOW()`,
      [companyId]
    ),
  ]);

  return {
    data: dataResult.rows,
    total: Number(countResult.rows[0]?.count ?? 0),
    page,
    limit,
  };
}

export async function sendOpportunityCandidate(
  companyId: string,
  opportunityId: string,
  candidateId: string,
  messageText?: string
): Promise<{ success: true; reactivationId: string } | { success: false; error: string; status: number }> {
  // Load opportunity + candidate atomically
  const oppResult = await pool.query<{
    opp_status: string;
    slot_starts_at: string;
    opp_company_id: string;
    service_name: string;
    professional_name: string;
    candidate_client_id: string;
    candidate_status: string;
  }>(
    `SELECT
      o.status AS opp_status,
      o.slot_starts_at,
      o.company_id AS opp_company_id,
      o.service_name,
      o.professional_name,
      sc.client_id AS candidate_client_id,
      sc.status AS candidate_status
     FROM slot_fill_opportunities o
     JOIN slot_fill_candidates sc ON sc.opportunity_id = o.id AND sc.id = $2
     WHERE o.id = $1`,
    [opportunityId, candidateId]
  );

  if (!oppResult.rows[0]) {
    return { success: false, error: 'Opportunity or candidate not found', status: 404 };
  }

  const row = oppResult.rows[0];

  if (row.opp_company_id !== companyId) {
    return { success: false, error: 'Opportunity not found', status: 404 };
  }

  if (row.opp_status !== 'pending' && row.opp_status !== 'reviewed') {
    return { success: false, error: 'Opportunity is no longer available', status: 409 };
  }

  if (new Date(row.slot_starts_at) <= new Date()) {
    return { success: false, error: 'Slot has already passed', status: 410 };
  }

  // Atomically claim the candidate BEFORE sending — prevents duplicate WhatsApp messages
  const claimed = await pool.query<{ id: string }>(
    `UPDATE slot_fill_candidates SET status = 'sent', updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING id`,
    [candidateId]
  );

  if (claimed.rows.length === 0) {
    return { success: false, error: 'Candidate was already messaged', status: 409 };
  }

  // Build message from template if not provided
  let finalMessage = messageText;
  if (!finalMessage) {
    const templateResult = await pool.query<{ slot_fill_message_template: string | null; name: string }>(
      `SELECT cs.slot_fill_message_template, co.name
       FROM company_settings cs
       JOIN companies co ON co.id = cs.company_id
       WHERE cs.company_id = $1`,
      [companyId]
    );

    const clientResult = await pool.query<{ name: string }>(
      `SELECT name FROM clients WHERE id = $1`,
      [row.candidate_client_id]
    );

    const template = templateResult.rows[0]?.slot_fill_message_template
      ?? 'Hola {{client_name}}! Tenemos disponibilidad esta semana para {{service_name}} en {{company_name}}. Queres agendar tu turno? Responde y te busco horario.';

    finalMessage = template
      .replace(/\{\{client_name\}\}/g, clientResult.rows[0]?.name ?? '')
      .replace(/\{\{service_name\}\}/g, row.service_name)
      .replace(/\{\{company_name\}\}/g, templateResult.rows[0]?.name ?? '')
      .replace(/\{\{professional_name\}\}/g, row.professional_name);
  }

  // Send via reactivation system (candidate already claimed — no duplicate risk)
  const sendResult = await sendOutboundMessage(companyId, row.candidate_client_id, finalMessage);

  if (!sendResult.success) {
    // Rollback candidate claim on send failure
    await pool.query(
      `UPDATE slot_fill_candidates SET status = 'pending', updated_at = NOW() WHERE id = $1`,
      [candidateId]
    );
    return { success: false, error: sendResult.error, status: sendResult.status };
  }

  // Link reactivation message to candidate
  await pool.query(
    `UPDATE slot_fill_candidates SET reactivation_message_id = $1, updated_at = NOW() WHERE id = $2`,
    [sendResult.reactivationId, candidateId]
  );

  // Tag the reactivation_messages record as slot_fill
  await pool.query(
    `UPDATE reactivation_messages SET trigger_type = 'slot_fill' WHERE id = $1`,
    [sendResult.reactivationId]
  );

  // Update opportunity status to reviewed
  await pool.query(
    `UPDATE slot_fill_opportunities SET status = 'reviewed', updated_at = NOW() WHERE id = $1 AND status = 'pending'`,
    [opportunityId]
  );

  return { success: true, reactivationId: sendResult.reactivationId };
}

export async function dismissOpportunity(companyId: string, opportunityId: string): Promise<void> {
  await pool.query(
    `UPDATE slot_fill_opportunities SET status = 'dismissed', updated_at = NOW() WHERE id = $1 AND company_id = $2`,
    [opportunityId, companyId]
  );
}
