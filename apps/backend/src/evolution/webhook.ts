import { Router } from 'express';
import type { Request } from 'express';
import { pool } from '../db/pool';
import { config } from '../config';
import { broadcast } from '../ws/server';
import { handleIncomingMessage } from '../agent/index';
import { EvolutionClient } from './client';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/timeout';
import type { WhatsAppInstance } from '@talora/shared';

const evolution = new EvolutionClient();

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
function normalizePhone(raw: string): string {
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

function isWebhookAuthorized(req: Request): boolean {
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

async function handleMessagesUpsert(body: EvolutionWebhookBody) {
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
  const messageText =
    data.message?.conversation ||
    data.message?.extendedTextMessage?.text ||
    data.message?.imageMessage?.caption ||
    '';

  // If no text was extracted but the message object exists, it's a non-text message
  // (audio, image without caption, video, sticker, document, etc.)
  if (!messageText) {
    if (data.message) {
      try {
        await evolution.sendText(
          instanceName,
          phone,
          '¡Gracias por tu mensaje! Por ahora solo puedo leer texto. Si querés mostrarme una referencia de tatuaje, describímelo con palabras y te ayudo a encontrar lo que buscás. 🎨',
        );
      } catch (err) {
        logger.error(`Failed to send unsupported media reply to ${phone}:`, err);
      }
    }
    return;
  }

  const contactName = data.pushName || null;

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

  // Update known instances cache
  knownInstances.add(instanceName);

  // Find or create conversation
  const convResult = await pool.query(
    `INSERT INTO conversations (instance_id, phone_number, contact_name, last_message_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (instance_id, phone_number)
     DO UPDATE SET contact_name = COALESCE($3, conversations.contact_name), last_message_at = NOW()
     RETURNING *`,
    [instance.id, phone, contactName]
  );

  const conversation = convResult.rows[0];

  // Save user message
  await pool.query(
    `INSERT INTO messages (conversation_id, role, content)
     VALUES ($1, 'user', $2)`,
    [conversation.id, messageText]
  );

  // Handle incoming message with agent
  await handleIncomingMessage(conversation.id, instanceName, messageText);
}

async function handleConnectionUpdate(body: EvolutionWebhookBody) {
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
     RETURNING id, status, qr_code`,
    [status, instanceName]
  );

  if (result.rows.length > 0) {
    const row = result.rows[0];
    broadcast({
      type: 'instance:status',
      payload: { id: row.id, status: row.status as any, qr_code: row.qr_code },
    });
  }
}

async function handleQrCodeUpdate(body: EvolutionWebhookBody) {
  const instanceName = body.instance;
  const qrCode = body.data?.qrcode?.base64 || body.data?.base64 || null;

  if (!instanceName || !qrCode) return;

  const result = await pool.query<WhatsAppInstance>(
    `UPDATE whatsapp_instances
     SET qr_code = $1, status = 'qr_pending', updated_at = NOW()
     WHERE evolution_instance_name = $2
     RETURNING id, status, qr_code`,
    [qrCode, instanceName]
  );

  if (result.rows.length > 0) {
    const row = result.rows[0];
    broadcast({
      type: 'instance:status',
      payload: { id: row.id, status: 'qr_pending', qr_code: row.qr_code },
    });
  }
}
