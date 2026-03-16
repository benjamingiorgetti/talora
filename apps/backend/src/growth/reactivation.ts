import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { broadcast } from '../ws/server';
import { EvolutionClient } from '../evolution/client';
import { getConnectedInstance } from '../evolution/helpers';
import type { Conversation, Message } from '@talora/shared';

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

export async function sendReactivationMessage(
  companyId: string,
  clientId: string,
  messageText?: string
): Promise<{ success: true; reactivationId: string } | { success: false; error: string; status: number }> {
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

  // 4. Get connected WhatsApp instance
  const instance = await getConnectedInstance(companyId);
  if (!instance) {
    const insertResult = await pool.query<{ id: string }>(
      `INSERT INTO reactivation_messages (company_id, client_id, message_text, status, created_at)
       VALUES ($1, $2, $3, 'failed', NOW())
       RETURNING id`,
      [companyId, clientId, messageText ?? '']
    );
    logger.error(`[reactivation] No connected WhatsApp instance for company ${companyId}`);
    return { success: false, error: 'No connected WhatsApp instance', status: 503 };
  }

  // 5. Generate message if not provided
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

  // 6. Send via Evolution API
  try {
    const evolution = new EvolutionClient();
    await evolution.sendText(instance.evolution_instance_name, client.phone_number, finalMessage);
  } catch (err) {
    logger.error(`[reactivation] Failed to send WhatsApp message to client ${clientId}:`, err);

    const insertResult = await pool.query<{ id: string }>(
      `INSERT INTO reactivation_messages (company_id, client_id, message_text, status, created_at)
       VALUES ($1, $2, $3, 'failed', NOW())
       RETURNING id`,
      [companyId, clientId, finalMessage]
    );

    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send WhatsApp message',
      status: 502,
    };
  }

  // 7. Find or create conversation
  let conversation: Conversation | null = null;

  // Look for any conversation (active or archived) — unarchive if needed
  const existingConv = await pool.query<Conversation>(
    `SELECT * FROM conversations WHERE company_id = $1 AND phone_number = $2 ORDER BY archived_at IS NULL DESC, last_message_at DESC LIMIT 1`,
    [companyId, client.phone_number]
  );

  if (existingConv.rows[0]) {
    conversation = existingConv.rows[0];
    await pool.query(
      `UPDATE conversations SET last_message_at = NOW(), updated_at = NOW(), archived_at = NULL, archive_reason = NULL WHERE id = $1`,
      [conversation.id]
    );
    conversation = { ...conversation, last_message_at: new Date().toISOString(), archived_at: null };
  } else {
    // Need instance_id from whatsapp_instances
    const instanceIdResult = await pool.query<{ id: string }>(
      `SELECT id FROM whatsapp_instances WHERE company_id = $1 AND evolution_instance_name = $2 LIMIT 1`,
      [companyId, instance.evolution_instance_name]
    );

    const instanceId = instanceIdResult.rows[0]?.id;
    if (!instanceId) {
      logger.warn(`[reactivation] Could not find instance row for ${instance.evolution_instance_name}`);
    }

    const newConv = await pool.query<Conversation>(
      `INSERT INTO conversations (company_id, instance_id, phone_number, contact_name, last_message_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [companyId, instanceId ?? null, client.phone_number, client.name]
    );
    conversation = newConv.rows[0] ?? null;
  }

  // 8. Insert message into conversation
  let newMessage: Message | null = null;
  if (conversation) {
    const msgResult = await pool.query<Message>(
      `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'assistant', $2) RETURNING *`,
      [conversation.id, finalMessage]
    );
    newMessage = msgResult.rows[0] ?? null;
  }

  // 9. Insert reactivation_messages record
  const reactivationResult = await pool.query<{ id: string }>(
    `INSERT INTO reactivation_messages (company_id, client_id, message_text, status, sent_at, created_at)
     VALUES ($1, $2, $3, 'sent', NOW(), NOW())
     RETURNING id`,
    [companyId, clientId, finalMessage]
  );

  const reactivationId = reactivationResult.rows[0]?.id;

  // 10. Broadcast WebSocket events
  if (conversation) {
    broadcast({
      type: 'conversation:updated',
      payload: {
        id: conversation.id,
        company_id: conversation.company_id,
        instance_id: conversation.instance_id,
        professional_id: conversation.professional_id ?? null,
        last_message_at: conversation.last_message_at,
        bot_paused: conversation.bot_paused,
        archived_at: conversation.archived_at,
        archive_reason: conversation.archive_reason,
      },
    });

    if (newMessage) {
      broadcast({
        type: 'message:new',
        payload: { ...newMessage, company_id: companyId },
      });
    }
  }

  return { success: true, reactivationId: reactivationId! };
}
