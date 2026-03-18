import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { sendWhatsAppMessage } from '../outbound/service';

const DEFAULT_TEMPLATE =
  'Hola {{client_name}}! Hace {{days}} dias que no te vemos por {{company_name}}. Queres agendar tu proximo turno?';

export function generateReactivationMessage(params: {
  clientName: string;
  daysSinceLast: number;
  companyName: string;
  professionalName?: string;
  lastService?: string;
  customTemplate?: string | null;
}): string {
  const template = params.customTemplate ?? DEFAULT_TEMPLATE;
  return template
    .replace(/\{\{client_name\}\}/g, params.clientName)
    .replace(/\{\{days\}\}/g, String(params.daysSinceLast))
    .replace(/\{\{company_name\}\}/g, params.companyName)
    .replace(/\{\{professional_name\}\}/g, params.professionalName ?? '')
    .replace(/\{\{last_service\}\}/g, params.lastService ?? '');
}

export async function sendOutboundMessage(
  companyId: string,
  clientId: string,
  messageText?: string,
  options: { triggerType?: 'reactivation' | 'slot_fill' } = {}
): Promise<{ success: true; reactivationId: string } | { success: false; error: string; status: number }> {
  const triggerType = options.triggerType ?? 'reactivation';

  // 1. Rate limit check: max 20 messages per day
  const rateLimitResult = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM reactivation_messages
     WHERE company_id = $1
       AND sent_at >= CURRENT_DATE
       AND status IN ('sent', 'converted')`,
    [companyId]
  );

    if ((rateLimitResult.rows[0]?.count ?? 0) >= 20) {
      return { success: false, error: 'Daily reactivation message limit reached (20 per day)', status: 429 };
    }

  // 2. Load client
  const clientResult = await pool.query<{ id: string; name: string; phone_number: string }>(
    `SELECT id, name, phone_number FROM clients WHERE id = $1 AND company_id = $2 LIMIT 1`,
    [clientId, companyId]
  );

  const client = clientResult.rows[0];
  if (!client) {
    return { success: false, error: 'Client not found', status: 404 };
  }

  // 3. Load company
  const companyResult = await pool.query<{ name: string }>(
    `SELECT name FROM companies WHERE id = $1 LIMIT 1`,
    [companyId]
  );

  const company = companyResult.rows[0];
  if (!company) {
    return { success: false, error: 'Company not found', status: 404 };
  }

  // 4. Generate message if not provided
  let analyticsResult;
  if (!messageText) {
    analyticsResult = await pool.query<{
      days_since_last: number | null;
      reactivation_message_template: string | null;
    }>(
      `SELECT
        ca.days_since_last,
        cs.reactivation_message_template
       FROM clients c
       LEFT JOIN client_analytics ca ON ca.client_id = c.id
       LEFT JOIN company_settings cs ON cs.company_id = c.company_id
       WHERE c.id = $1`,
      [clientId]
    );
  }

  const daysSinceLast = analyticsResult?.rows[0]?.days_since_last ?? 0;
  const customTemplate = analyticsResult?.rows[0]?.reactivation_message_template ?? null;

  const finalMessage =
    messageText ??
    generateReactivationMessage({
      clientName: client.name,
      daysSinceLast,
      companyName: company.name,
      customTemplate,
    });

  const outboundResult = await sendWhatsAppMessage({
    companyId,
    clientId,
    messageText: finalMessage,
    purpose: triggerType === 'slot_fill' ? 'slot_fill' : 'reactivation',
    sourceType: triggerType,
    sourceId: clientId,
  });

  if (!outboundResult.success) {
    await pool.query(
      `INSERT INTO reactivation_messages (
        company_id, client_id, message_text, status, trigger_type, created_at
      )
       VALUES ($1, $2, $3, 'failed', $4, NOW())`,
      [companyId, clientId, finalMessage, triggerType]
    );

    return {
      success: false,
      error: outboundResult.error,
      status: outboundResult.status,
    };
  }

  // 5. Insert reactivation_messages record
  const reactivationResult = await pool.query<{ id: string }>(
    `INSERT INTO reactivation_messages (
      company_id, client_id, message_text, status, trigger_type, outbound_message_id, sent_at, created_at
    )
     VALUES ($1, $2, $3, 'sent', $4, $5, NOW(), NOW())
     RETURNING id`,
    [companyId, clientId, finalMessage, triggerType, outboundResult.outboundMessageId]
  );

  const reactivationId = reactivationResult.rows[0]?.id;

  return { success: true, reactivationId: reactivationId! };
}
