import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { broadcast } from '../ws/server';
import { EvolutionClient } from '../evolution/client';
import { getConnectedInstance } from '../evolution/helpers';
import type { Conversation, Message } from '@talora/shared';

export type OutboundPurpose = 'reactivation' | 'slot_fill' | 'reminder' | 'manual' | 'agent';

export interface SendWhatsAppMessageParams {
  companyId: string;
  clientId: string;
  messageText: string;
  purpose: OutboundPurpose;
  sourceType: string;
  sourceId?: string | null;
}

export type SendWhatsAppMessageResult =
  | { success: true; outboundMessageId: string; conversationId: string | null }
  | { success: false; error: string; status: number; outboundMessageId?: string | null };

function providerMessageIdFrom(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const record = result as Record<string, unknown>;
  const key = record.key;
  if (!key || typeof key !== 'object') return null;
  const providerId = (key as Record<string, unknown>).id;
  return typeof providerId === 'string' ? providerId : null;
}

async function insertOutboundMessage(params: {
  companyId: string;
  clientId: string;
  conversationId?: string | null;
  purpose: OutboundPurpose;
  sourceType: string;
  sourceId?: string | null;
  messageText: string;
  status: 'sent' | 'failed';
  providerMessageId?: string | null;
  error?: string | null;
}): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO outbound_messages (
      company_id, client_id, conversation_id, channel, purpose, source_type, source_id,
      message_text, status, provider_message_id, error, sent_at, failed_at, created_at, updated_at
    ) VALUES (
      $1, $2, $3, 'whatsapp', $4, $5, $6, $7, $8, $9, $10,
      CASE WHEN $8 = 'sent' THEN NOW() ELSE NULL END,
      CASE WHEN $8 = 'failed' THEN NOW() ELSE NULL END,
      NOW(), NOW()
    )
    RETURNING id`,
    [
      params.companyId,
      params.clientId,
      params.conversationId ?? null,
      params.purpose,
      params.sourceType,
      params.sourceId ?? null,
      params.messageText,
      params.status,
      params.providerMessageId ?? null,
      params.error ?? null,
    ]
  );

  return result.rows[0]?.id ?? null;
}

export async function sendWhatsAppMessage(
  params: SendWhatsAppMessageParams
): Promise<SendWhatsAppMessageResult> {
  const clientResult = await pool.query<{ id: string; name: string; phone_number: string }>(
    `SELECT id, name, phone_number FROM clients WHERE id = $1 AND company_id = $2 LIMIT 1`,
    [params.clientId, params.companyId]
  );

  const client = clientResult.rows[0];
  if (!client) {
    return { success: false, error: 'Client not found', status: 404 };
  }

  const companyResult = await pool.query<{ name: string }>(
    `SELECT name FROM companies WHERE id = $1 LIMIT 1`,
    [params.companyId]
  );

  const company = companyResult.rows[0];
  if (!company) {
    return { success: false, error: 'Company not found', status: 404 };
  }

  const instance = await getConnectedInstance(params.companyId);
  if (!instance) {
    const outboundMessageId = await insertOutboundMessage({
      companyId: params.companyId,
      clientId: params.clientId,
      purpose: params.purpose,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      messageText: params.messageText,
      status: 'failed',
      error: 'No connected WhatsApp instance',
    });

    logger.error(`[outbound] No connected WhatsApp instance for company ${params.companyId}`);
    return {
      success: false,
      error: 'No connected WhatsApp instance',
      status: 503,
      outboundMessageId,
    };
  }

  let providerMessageId: string | null = null;
  try {
    const evolution = new EvolutionClient();
    const sendResult = await evolution.sendText(
      instance.evolution_instance_name,
      client.phone_number,
      params.messageText
    );
    providerMessageId = providerMessageIdFrom(sendResult);
  } catch (err) {
    logger.error(`[outbound] Failed to send WhatsApp message to client ${params.clientId}:`, err);

    const outboundMessageId = await insertOutboundMessage({
      companyId: params.companyId,
      clientId: params.clientId,
      purpose: params.purpose,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      messageText: params.messageText,
      status: 'failed',
      error: err instanceof Error ? err.message : 'Failed to send WhatsApp message',
    });

    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to send WhatsApp message',
      status: 502,
      outboundMessageId,
    };
  }

  let conversation: Conversation | null = null;

  const existingConv = await pool.query<Conversation>(
    `SELECT * FROM conversations
     WHERE company_id = $1 AND phone_number = $2
     ORDER BY archived_at IS NULL DESC, last_message_at DESC
     LIMIT 1`,
    [params.companyId, client.phone_number]
  );

  if (existingConv.rows[0]) {
    conversation = existingConv.rows[0];
    await pool.query(
      `UPDATE conversations
       SET last_message_at = NOW(), updated_at = NOW(), archived_at = NULL, archive_reason = NULL
       WHERE id = $1`,
      [conversation.id]
    );
    conversation = { ...conversation, last_message_at: new Date().toISOString(), archived_at: null };
  } else {
    const instanceIdResult = await pool.query<{ id: string }>(
      `SELECT id FROM whatsapp_instances WHERE company_id = $1 AND evolution_instance_name = $2 LIMIT 1`,
      [params.companyId, instance.evolution_instance_name]
    );

    const instanceId = instanceIdResult.rows[0]?.id ?? null;
    if (!instanceId) {
      logger.warn(`[outbound] Could not find instance row for ${instance.evolution_instance_name}`);
    }

    const newConv = await pool.query<Conversation>(
      `INSERT INTO conversations (company_id, instance_id, phone_number, contact_name, last_message_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [params.companyId, instanceId, client.phone_number, client.name]
    );
    conversation = newConv.rows[0] ?? null;
  }

  let newMessage: Message | null = null;
  if (conversation) {
    const msgResult = await pool.query<Message>(
      `INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'assistant', $2) RETURNING *`,
      [conversation.id, params.messageText]
    );
    newMessage = msgResult.rows[0] ?? null;
  }

  const outboundMessageId = await insertOutboundMessage({
    companyId: params.companyId,
    clientId: params.clientId,
    conversationId: conversation?.id ?? null,
    purpose: params.purpose,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    messageText: params.messageText,
    status: 'sent',
    providerMessageId,
  });

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
        auto_resume_at: conversation.auto_resume_at ?? null,
        archived_at: conversation.archived_at,
        archive_reason: conversation.archive_reason,
      },
    });

    if (newMessage) {
      broadcast({
        type: 'message:new',
        payload: { ...newMessage, company_id: params.companyId },
      });
    }
  }

  return {
    success: true,
    outboundMessageId: outboundMessageId ?? '',
    conversationId: conversation?.id ?? null,
  };
}
