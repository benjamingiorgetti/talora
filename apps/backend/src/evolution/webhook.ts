import { Router } from 'express';
import type { Request } from 'express';
import { pool } from '../db/pool';
import { config } from '../config';
import { broadcast } from '../ws/server';
import { handleIncomingMessage } from '../agent/index';
import { EvolutionClient } from './client';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/timeout';
import { isResetCommand, resetConversationMemory } from '../conversations/reset';
import { isConversationInactive } from '../conversations/archive';
import { transcribeAudio } from '../agent/transcribe';
import type { WhatsAppInstance } from '@talora/shared';

const evolution = new EvolutionClient();

// Per-conversation lock to serialize entire webhook processing and prevent
// race conditions when multiple messages arrive simultaneously (e.g. backend
// was down and processes queued /reset + "hola" concurrently).
const webhookLocks = new Map<string, Promise<void>>();

function withConversationLock(lockKey: string, fn: () => Promise<void>): Promise<void> {
  const prev = webhookLocks.get(lockKey) ?? Promise.resolve();
  const current = prev
    .then(fn)
    .catch((err) => logger.error(`Error in webhook lock chain [${lockKey}]:`, err))
    .finally(() => {
      if (webhookLocks.get(lockKey) === current) {
        webhookLocks.delete(lockKey);
      }
    });
  webhookLocks.set(lockKey, current);
  return current;
}

// Per-conversation message buffer to debounce agent invocations.
// When multiple messages arrive within BUFFER_DELAY_MS, only one agent
// call is made after the last message, preventing fragmented responses.
//
//   msg1 arrives → Lock → DB Save → scheduleAgentResponse() → Release Lock (fast)
//   msg2 arrives → Lock → DB Save → scheduleAgentResponse() resets timer → Release Lock
//   ... 10s after last message ...
//   Timer fires → Lock → re-check bot_paused → Agent → Release Lock
//
const messageBuffers = new Map<string, {
  timer: ReturnType<typeof setTimeout>;
  firstMessageAt: number;
  messageCount: number;
  conversationId: string;
  instanceName: string;
}>();

function scheduleAgentResponse(
  lockKey: string,
  conversationId: string,
  instanceName: string
) {
  const existing = messageBuffers.get(lockKey);
  const now = Date.now();
  const firstMessageAt = existing?.firstMessageAt ?? now;
  const messageCount = (existing?.messageCount ?? 0) + 1;

  if (existing) {
    clearTimeout(existing.timer);
  }

  // If buffer has been open longer than max window, fire immediately
  const elapsed = now - firstMessageAt;
  const delay = elapsed >= config.messageBufferMaxWindowMs
    ? 0
    : config.messageBufferDelayMs;

  const timer = setTimeout(() => {
    messageBuffers.delete(lockKey);
    logger.info(`Agent buffer fired for ${lockKey} (${messageCount} messages buffered)`);

    withConversationLock(lockKey, async () => {
      // Re-check bot_paused at invocation time — state may have changed
      // since the message was received
      const conv = await pool.query<{ bot_paused: boolean }>(
        'SELECT bot_paused FROM conversations WHERE id = $1',
        [conversationId]
      );
      if (conv.rows[0]?.bot_paused) {
        logger.info(`Conversation ${conversationId} is paused; skipping buffered agent response`);
        return;
      }
      await handleIncomingMessage(conversationId, instanceName, '');
    });
  }, delay);

  messageBuffers.set(lockKey, {
    timer,
    firstMessageAt,
    messageCount,
    conversationId,
    instanceName,
  });

  if (messageCount === 1) {
    logger.info(`Buffering agent response for ${lockKey}, delay: ${delay}ms`);
  } else {
    logger.info(`Extended agent buffer for ${lockKey} (${messageCount} messages, elapsed: ${elapsed}ms)`);
  }
}

function cancelMessageBuffer(lockKey: string) {
  const existing = messageBuffers.get(lockKey);
  if (existing) {
    clearTimeout(existing.timer);
    messageBuffers.delete(lockKey);
    logger.info(`Agent buffer cancelled for ${lockKey} (reset command)`);
  }
}

// Export for testing
export { messageBuffers, scheduleAgentResponse, cancelMessageBuffer };

interface EvolutionWebhookBody {
  event: string;
  instance: string;
  data: Record<string, any>;
}

export const webhookRouter = Router();

// --- Idempotency map with max size cap ---
const processedMessages = new Map<string, number>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_PROCESSED_ENTRIES = 10_000;

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, ts] of processedMessages) {
    if (now - ts > IDEMPOTENCY_TTL_MS) {
      processedMessages.delete(id);
    }
  }
}, 5 * 60 * 1000);

/**
 * Enforce max size on the idempotency map.
 * When exceeding MAX_PROCESSED_ENTRIES, evict entries older than TTL first,
 * then remove the oldest entries by timestamp if still over limit.
 */
function enforceIdempotencyMapSize() {
  if (processedMessages.size <= MAX_PROCESSED_ENTRIES) return;

  const now = Date.now();

  // First pass: evict expired entries by timestamp
  for (const [id, ts] of processedMessages) {
    if (now - ts > IDEMPOTENCY_TTL_MS) {
      processedMessages.delete(id);
    }
  }

  // If still over limit, evict the oldest entries by timestamp
  if (processedMessages.size > MAX_PROCESSED_ENTRIES) {
    const sorted = [...processedMessages.entries()].sort((a, b) => a[1] - b[1]);
    const entriesToDelete = processedMessages.size - MAX_PROCESSED_ENTRIES;
    for (let i = 0; i < entriesToDelete; i++) {
      processedMessages.delete(sorted[i][0]);
    }
  }
}

// --- Phone number normalization ---
/**
 * Normalize a phone number: strip non-digit characters.
 * Ensures consistent format for conversation lookups.
 */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '');
}

// --- Processing timeout ---
const PROCESSING_TIMEOUT_MS = 120_000; // 120 seconds

// --- Webhook origin validation ---
function getClientIp(req: Request): string {
  // Support proxied requests (X-Forwarded-For) and fall back to direct IP
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '';
}

export function isWebhookAuthorized(req: Request): boolean {
  const secret = config.webhookSecret;

  // If a webhook secret is configured, check it first (takes priority)
  if (secret) {
    const headerSecret = req.headers['x-webhook-secret'] as string | undefined;
    const querySecret = req.query.secret as string | undefined;
    if (headerSecret === secret || querySecret === secret) {
      return true;
    }
    // Secret configured but not matched — reject
    return false;
  }

  // Fall back to IP/hostname allowlist
  const allowedHosts = config.webhookAllowedHosts;
  const allowedList = allowedHosts
    ? allowedHosts.split(',').map((h) => h.trim()).filter(Boolean)
    : [];

  if (allowedList.length > 0) {
    const clientIp = getClientIp(req);
    const hostname = req.hostname || '';
    return allowedList.some((allowed) => clientIp === allowed || hostname === allowed);
  }

  // No secret and no allowlist configured
  // Only accept in development mode — reject in production
  if (config.nodeEnv === 'development') {
    logger.warn('Webhook received with no secret or allowlist configured — accepting in development mode');
    return true;
  }

  logger.error('Webhook rejected: no WEBHOOK_SECRET or WEBHOOK_ALLOWED_HOSTS configured in production');
  return false;
}

// --- Instance existence cache (short-lived) ---
const knownInstances = new Set<string>();
const INSTANCE_CACHE_TTL_MS = 60_000;

// Refresh known instances every minute
async function refreshKnownInstances() {
  try {
    const result = await pool.query<WhatsAppInstance>(
      'SELECT evolution_instance_name FROM whatsapp_instances'
    );
    knownInstances.clear();
    for (const row of result.rows) {
      if (row.evolution_instance_name) {
        knownInstances.add(row.evolution_instance_name);
      }
    }
  } catch (err) {
    logger.error('Failed to refresh known instances cache:', err);
  }
}

// Initial load + periodic refresh
refreshKnownInstances();
setInterval(refreshKnownInstances, INSTANCE_CACHE_TTL_MS);

webhookRouter.post('/evolution/:event?', (req, res) => {
  // Origin validation
  if (!isWebhookAuthorized(req)) {
    logger.warn(`Webhook rejected: unauthorized origin ${getClientIp(req)}`);
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const body = req.body as EvolutionWebhookBody;
  const event = body.event;

  // Validate instance exists in DB
  if (body.instance && !knownInstances.has(body.instance)) {
    // Not in cache — could be newly created. Do a synchronous-ish check:
    // For now, log a warning but still process (the handler will query DB anyway)
    logger.warn(`Webhook received for unknown instance: ${body.instance}`);
  }

  // Respond immediately, process in background
  res.status(200).json({ received: true });

  // Process asynchronously with timeout
  (async () => {
    try {
      const label = `${event}:${body.instance}`;

      if (event === 'messages.upsert' || event === 'MESSAGES_UPSERT') {
        await withTimeout(handleMessagesUpsert(body), PROCESSING_TIMEOUT_MS, label);
      } else if (event === 'connection.update' || event === 'CONNECTION_UPDATE') {
        await withTimeout(handleConnectionUpdate(body), PROCESSING_TIMEOUT_MS, label);
      } else if (event === 'qrcode.updated' || event === 'QRCODE_UPDATED') {
        await withTimeout(handleQrCodeUpdate(body), PROCESSING_TIMEOUT_MS, label);
      }
    } catch (err) {
      logger.error('Webhook processing error:', err);
    }
  })();
});

export async function handleMessagesUpsert(body: EvolutionWebhookBody) {
  const data = body.data;
  if (!data) return;

  // Idempotency check
  const messageId = data.key?.id;
  if (messageId) {
    if (processedMessages.has(messageId)) return;
    processedMessages.set(messageId, Date.now());
    enforceIdempotencyMapSize();
  }

  // Skip messages from self (status broadcast or own messages)
  const isFromMe = data.key?.fromMe;
  if (isFromMe) return;

  const instanceName = body.instance;
  const remoteJid = data.key?.remoteJid;
  if (!remoteJid || remoteJid === 'status@broadcast') return;

  // Extract and normalize phone number (remove @s.whatsapp.net / @g.us)
  const rawPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
  const phone = normalizePhone(rawPhone);

  // Extract message text
  let messageText =
    data.message?.conversation ||
    data.message?.extendedTextMessage?.text ||
    data.message?.imageMessage?.caption ||
    '';

  // Handle audio messages via Whisper transcription
  const audioMessage = data.message?.audioMessage;
  if (!messageText && audioMessage) {
    try {
      const base64Audio = audioMessage.base64 || data.message?.base64;
      if (!base64Audio) {
        await evolution.sendText(instanceName, phone,
          'No pude procesar tu audio. ¿Podés escribirlo como texto?');
        return;
      }
      const transcript = await transcribeAudio(base64Audio, audioMessage.mimetype || 'audio/ogg');
      if (!transcript) {
        await evolution.sendText(instanceName, phone,
          'No pude entender tu audio. ¿Podés repetirlo o escribirlo?');
        return;
      }
      messageText = `[Audio] ${transcript}`;
    } catch (err) {
      logger.error(`Audio transcription failed for ${phone}:`, err);
      try {
        await evolution.sendText(instanceName, phone,
          'Hubo un error procesando tu audio. ¿Podés escribirlo como texto?');
      } catch (sendErr) {
        logger.error(`Failed to send audio error reply to ${phone}:`, sendErr);
      }
      return;
    }
  }

  // If still no text (video, sticker, document, image without caption)
  if (!messageText) {
    if (data.message) {
      try {
        await evolution.sendText(
          instanceName,
          phone,
          'Gracias por tu mensaje. Por ahora solo puedo procesar texto y audios. Si queres compartir una referencia o explicarme tu consulta, describila con palabras y te ayudo desde aca.',
        );
      } catch (err) {
        logger.error(`Failed to send unsupported media reply to ${phone}:`, err);
      }
    }
    return;
  }

  const contactName = data.pushName || null;

  // Serialize all DB-touching work for the same conversation to prevent race
  // conditions (e.g. /reset + "hola" arriving simultaneously after downtime).
  const lockKey = `${instanceName}:${phone}`;
  await withConversationLock(lockKey, async () => {
    // Find the instance in DB
    const instanceResult = await pool.query<WhatsAppInstance>(
      'SELECT * FROM whatsapp_instances WHERE evolution_instance_name = $1',
      [instanceName]
    );

    if (instanceResult.rows.length === 0) {
      logger.error(`Instance not found for name: ${instanceName}`);
      return;
    }

    const instance = instanceResult.rows[0];

    // Check if bot is enabled for this company
    const companyResult = await pool.query<{ bot_enabled: boolean }>(
      'SELECT bot_enabled FROM companies WHERE id = $1',
      [instance.company_id]
    );
    if (companyResult.rows[0]?.bot_enabled === false) {
      logger.info(`Bot disabled for company ${instance.company_id}, ignoring message from ${phone}`);
      return;
    }

    // Update known instances cache
    knownInstances.add(instanceName);

    const clientResult = await pool.query<{ professional_id: string | null }>(
      `SELECT professional_id
       FROM clients
       WHERE company_id = $1 AND phone_number = $2
       LIMIT 1`,
      [instance.company_id, phone]
    );
    let resolvedProfessionalId = clientResult.rows[0]?.professional_id ?? null;

    // Fallback: if no client-based professional, auto-assign when company has exactly 1 active professional
    if (!resolvedProfessionalId) {
      const proResult = await pool.query<{ id: string }>(
        'SELECT id FROM professionals WHERE company_id = $1 AND is_active = true',
        [instance.company_id]
      );
      if (proResult.rows.length === 1) {
        resolvedProfessionalId = proResult.rows[0].id;
      }
    }

    const existingConversationResult = await pool.query<{
      id: string;
      archived_at: string | null;
      last_message_at: string | null;
    }>(
      `SELECT id, archived_at, last_message_at
       FROM conversations
       WHERE instance_id = $1 AND phone_number = $2
       LIMIT 1`,
      [instance.id, phone]
    );
    const existingConversation = existingConversationResult.rows[0] ?? null;
    const shouldResetForInactivity = existingConversation !== null && isConversationInactive(existingConversation.last_message_at);

    // INVARIANT: COALESCE preserves existing professional_id. A conversation's
    // professional is set once (from the client lookup) and never silently
    // overwritten by subsequent messages. Reassignment is an explicit admin action.
    const convResult = await pool.query(
      `INSERT INTO conversations (company_id, professional_id, instance_id, phone_number, contact_name, last_message_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (instance_id, phone_number)
       DO UPDATE SET professional_id = CASE
                         WHEN conversations.professional_binding_suppressed THEN NULL
                         ELSE COALESCE(conversations.professional_id, $2)
                       END,
                     contact_name = COALESCE($5, conversations.contact_name),
                     archived_at = NULL,
                     archive_reason = NULL,
                     last_message_at = NOW(),
                     updated_at = NOW()
       RETURNING *`,
      [instance.company_id, resolvedProfessionalId, instance.id, phone, contactName]
    );

    let conversation = convResult.rows[0];

    if (shouldResetForInactivity) {
      const refreshedConversation = await pool.query(
        `UPDATE conversations
         SET memory_reset_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [conversation.id]
      );
      if (refreshedConversation.rows[0]) {
        conversation = refreshedConversation.rows[0];
      }
    }

    if (isResetCommand(messageText)) {
      cancelMessageBuffer(lockKey);
      const resetResult = await resetConversationMemory(conversation.id, conversation.company_id);

      broadcast({
        type: 'conversation:updated',
        payload: {
          id: resetResult.conversation.id,
          company_id: resetResult.conversation.company_id,
          instance_id: resetResult.conversation.instance_id,
          professional_id: resetResult.conversation.professional_id ?? null,
          last_message_at: resetResult.conversation.last_message_at,
          bot_paused: resetResult.conversation.bot_paused,
          archived_at: resetResult.conversation.archived_at,
          archive_reason: resetResult.conversation.archive_reason,
        },
      });

      const message = resetResult.systemMessage;
      broadcast({
        type: 'message:new',
        payload: {
          id: message.id,
          conversation_id: resetResult.conversation.id,
          role: message.role,
          content: message.content,
          tool_calls: message.tool_calls ?? null,
          tool_call_id: message.tool_call_id ?? null,
          created_at: message.created_at,
          company_id: resetResult.conversation.company_id,
        },
      });

      try {
        const messageKey = data.key?.id && data.key?.remoteJid
          ? {
              id: data.key.id as string,
              remoteJid: data.key.remoteJid as string,
              fromMe: Boolean(data.key.fromMe),
            }
          : null;
        if (messageKey) {
          await evolution.sendReaction(instanceName, messageKey, '✅');
        }
      } catch (err) {
        logger.error(`Failed to react to reset command for ${phone}:`, err);
      }
      return;
    }

    // Save user message
    const messageResult = await pool.query<{ id: string; created_at: string }>(
      `INSERT INTO messages (conversation_id, role, content)
       VALUES ($1, 'user', $2)
       RETURNING id, created_at`,
      [conversation.id, messageText]
    );

    // Broadcast conversation update and new message via WebSocket
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

    if (messageResult.rows[0]) {
      broadcast({
        type: 'message:new',
        payload: {
          id: messageResult.rows[0].id,
          conversation_id: conversation.id,
          role: 'user',
          content: messageText,
          tool_calls: null,
          tool_call_id: null,
          created_at: messageResult.rows[0].created_at,
          company_id: conversation.company_id,
        },
      });
    }

    if (conversation.bot_paused) {
      logger.info(`Conversation ${conversation.id} is paused; skipping bot response`);
      return;
    }

    // Schedule agent response with debounce — waits for user to finish typing
    scheduleAgentResponse(lockKey, conversation.id, instanceName);
  });
}

export async function handleConnectionUpdate(body: EvolutionWebhookBody) {
  const instanceName = body.instance;
  const state = body.data?.state;

  if (!instanceName || !state) return;

  let status: string;
  switch (state) {
    case 'open':
      status = 'connected';
      break;
    case 'close':
      status = 'disconnected';
      break;
    case 'connecting':
      status = 'qr_pending';
      break;
    default:
      status = 'disconnected';
  }

  const result = await pool.query<WhatsAppInstance>(
    `UPDATE whatsapp_instances
     SET status = $1, qr_code = CASE WHEN $1 = 'connected' THEN NULL ELSE qr_code END, updated_at = NOW()
     WHERE evolution_instance_name = $2
     RETURNING id, company_id, status, qr_code, phone_number`,
    [status, instanceName]
  );

  if (result.rows.length > 0) {
    const row = result.rows[0];
    let phoneNumber = row.phone_number;

    // On connection, fetch and store phone number from Evolution API
    if (status === 'connected' && !phoneNumber) {
      try {
        const info = await evolution.getInstanceInfo(instanceName);
        if (info.ownerJid) {
          phoneNumber = info.ownerJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
          await pool.query(
            'UPDATE whatsapp_instances SET phone_number = $1 WHERE id = $2',
            [phoneNumber, row.id]
          );
        }
      } catch (err) {
        logger.warn('Failed to fetch phone number on connection:', err);
      }
    }

    broadcast({
      type: 'instance:status',
      payload: { id: row.id, company_id: row.company_id, status: row.status as any, qr_code: row.qr_code, phone_number: phoneNumber },
    });
  }
}

export async function handleQrCodeUpdate(body: EvolutionWebhookBody) {
  const instanceName = body.instance;
  const qrCode = body.data?.qrcode?.base64 || body.data?.base64 || null;

  if (!instanceName) return;

  if (!qrCode) {
    logger.warn(`QR webhook for "${instanceName}" arrived without QR data.`, {
      dataKeys: Object.keys(body.data || {}),
      hasQrcode: !!body.data?.qrcode,
      hasBase64: !!body.data?.base64,
    });
    return;
  }

  const result = await pool.query<WhatsAppInstance>(
    `UPDATE whatsapp_instances
     SET qr_code = $1, status = 'qr_pending', updated_at = NOW()
     WHERE evolution_instance_name = $2
     RETURNING id, company_id, status, qr_code`,
    [qrCode, instanceName]
  );

  if (result.rows.length > 0) {
    const row = result.rows[0];
    broadcast({
      type: 'instance:status',
      payload: { id: row.id, company_id: row.company_id, status: 'qr_pending', qr_code: row.qr_code, phone_number: null },
    });
  }
}
