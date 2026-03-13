import { Router } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { EvolutionApiError, EvolutionClient } from '../evolution/client';
import { authMiddleware, getRequestCompanyId, getRequestProfessionalId, requireCompanyScope } from './middleware';
import { validateBody, manualMessageSchema, isValidUuid, parsePositiveInt } from './validation';
import type { AgentMessageTrace, Conversation, Message } from '@talora/shared';
import { archiveStaleConversations } from '../conversations/archive';

export const conversationsRouter = Router();
const evolution = new EvolutionClient();

conversationsRouter.use(authMiddleware, requireCompanyScope);

function getScopedProfessionalId(req: Parameters<typeof conversationsRouter.get>[1] extends never ? never : any): string | null {
  return req.user?.role === 'professional' ? req.user.professionalId ?? null : getRequestProfessionalId(req);
}

// GET / — list conversations with optional instance_id filter, paginated
conversationsRouter.get('/', async (req, res) => {
  const { instance_id, page = '1', limit = '20', state = 'active' } = req.query;
  const companyId = getRequestCompanyId(req)!;
  const professionalId = getScopedProfessionalId(req);

  // Validate instance_id if provided
  if (instance_id && !isValidUuid(instance_id as string)) {
    res.status(400).json({ error: 'Invalid instance_id format' });
    return;
  }

  const parsedPage = parsePositiveInt(page, 1);
  const parsedLimit = parsePositiveInt(limit, 20);

  if (parsedPage === null || parsedLimit === null) {
    res.status(400).json({ error: 'page and limit must be valid positive numbers' });
    return;
  }

  if (state !== 'active' && state !== 'archived' && state !== 'all') {
    res.status(400).json({ error: 'state must be one of active, archived or all' });
    return;
  }

  const pageNum = Math.max(1, parsedPage);
  const limitNum = Math.min(100, Math.max(1, parsedLimit));
  const offset = (pageNum - 1) * limitNum;

  try {
    await archiveStaleConversations(companyId, professionalId);

    // Single query with COUNT(*) OVER() window function to get data + total in one round-trip
    let query = 'SELECT *, COUNT(*) OVER() AS _total FROM conversations WHERE company_id = $1';
    const values: unknown[] = [companyId];

    if (professionalId) {
      query += ` AND professional_id = $${values.length + 1}`;
      values.push(professionalId);
    }

    if (instance_id) {
      query += ` AND instance_id = $${values.length + 1}`;
      values.push(instance_id);
    }

    if (state === 'active') {
      query += ' AND archived_at IS NULL';
    } else if (state === 'archived') {
      query += ' AND archived_at IS NOT NULL';
    }

    query += ' ORDER BY last_message_at DESC NULLS LAST';
    query += ` LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(limitNum, offset);

    const result = await pool.query<Conversation & { _total: string }>(query, values);
    const total = result.rows.length > 0 ? parseInt(result.rows[0]._total, 10) : 0;

    // Strip the _total column from response rows
    const data = result.rows.map(({ _total, ...row }) => row);

    res.json({
      data,
      pagination: { page: pageNum, limit: limitNum, total },
    });
  } catch (err) {
    logger.error('Error listing conversations:', err);
    res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// GET /:id/messages — list messages for conversation (cursor-based pagination)
conversationsRouter.get('/:id/messages', async (req, res) => {
  const { id } = req.params;
  const companyId = getRequestCompanyId(req)!;
  const professionalId = getScopedProfessionalId(req);

  if (!isValidUuid(id)) {
    res.status(400).json({ error: 'Invalid conversation ID format' });
    return;
  }

  const { before, limit: limitParam } = req.query;

  // Validate 'before' cursor if provided
  if (before && !isValidUuid(before as string)) {
    res.status(400).json({ error: 'Invalid cursor format' });
    return;
  }

  const parsedLimit = parsePositiveInt(limitParam, 50);
  if (parsedLimit === null) {
    res.status(400).json({ error: 'limit must be a valid positive number' });
    return;
  }

  const limit = Math.min(100, Math.max(1, parsedLimit));

  try {
    let query: string;
    const values: unknown[] = [id, companyId];
    const conversationScope = professionalId
      ? `SELECT id FROM conversations WHERE id = $1 AND company_id = $2 AND professional_id = $3`
      : `SELECT id FROM conversations WHERE id = $1 AND company_id = $2`;

    if (before) {
      if (professionalId) values.push(professionalId);
      values.push(before, limit + 1);
      query = `SELECT * FROM messages
               WHERE conversation_id = $1
                 AND conversation_id IN (${conversationScope})
                 AND created_at < (SELECT created_at FROM messages WHERE id = $${professionalId ? 4 : 3})
               ORDER BY created_at DESC
               LIMIT $${professionalId ? 5 : 4}`;
    } else {
      if (professionalId) values.push(professionalId);
      values.push(limit + 1);
      query = `SELECT * FROM messages
               WHERE conversation_id = $1
                 AND conversation_id IN (${conversationScope})
               ORDER BY created_at DESC
               LIMIT $${professionalId ? 4 : 3}`;
    }

    const result = await pool.query<Message>(query, values);
    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit).reverse();

    res.json({
      data: rows,
      pagination: {
        has_more: hasMore,
        oldest_cursor: rows.length > 0 ? rows[0].id : null,
      },
    });
  } catch (err) {
    logger.error('Error listing messages:', err);
    res.status(500).json({ error: 'Failed to list messages' });
  }
});

conversationsRouter.get('/:id/traces', async (req, res) => {
  const { id } = req.params;
  const companyId = getRequestCompanyId(req)!;
  const professionalId = getScopedProfessionalId(req);

  if (!isValidUuid(id)) {
    res.status(400).json({ error: 'Invalid conversation ID format' });
    return;
  }

  try {
    const values: unknown[] = [id, companyId];
    let scopeQuery = `SELECT id FROM conversations WHERE id = $1 AND company_id = $2`;

    if (professionalId) {
      values.push(professionalId);
      scopeQuery += ` AND professional_id = $3`;
    }

    const scopeResult = await pool.query<{ id: string }>(scopeQuery, values);
    if (scopeResult.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const result = await pool.query<AgentMessageTrace>(
      `SELECT *
       FROM agent_message_traces
       WHERE conversation_id = $1
         AND company_id = $2
       ORDER BY created_at ASC`,
      [id, companyId],
    );

    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing conversation traces:', err);
    res.status(500).json({ error: 'Failed to list conversation traces' });
  }
});

conversationsRouter.post('/:id/pause', async (req, res) => {
  try {
    const professionalId = getScopedProfessionalId(req);
    const result = await pool.query<Conversation>(
      `UPDATE conversations
       SET bot_paused = true, paused_at = NOW(), paused_by_user_id = $1, updated_at = NOW()
       WHERE id = $2 AND company_id = $3
         AND ($4::uuid IS NULL OR professional_id = $4)
       RETURNING *`,
      [req.user!.userId, req.params.id, getRequestCompanyId(req), professionalId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    await pool.query(
      `INSERT INTO conversation_pauses (conversation_id, company_id, paused_by_user_id, paused_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (conversation_id)
       DO UPDATE SET paused_by_user_id = $3, paused_at = NOW(), resumed_at = NULL`,
      [req.params.id, getRequestCompanyId(req), req.user!.userId]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error pausing conversation:', err);
    res.status(500).json({ error: 'Failed to pause conversation' });
  }
});

conversationsRouter.post('/:id/resume', async (req, res) => {
  try {
    const professionalId = getScopedProfessionalId(req);
    const result = await pool.query<Conversation>(
      `UPDATE conversations
       SET bot_paused = false, paused_at = NULL, paused_by_user_id = NULL, updated_at = NOW()
       WHERE id = $1 AND company_id = $2
         AND ($3::uuid IS NULL OR professional_id = $3)
       RETURNING *`,
      [req.params.id, getRequestCompanyId(req), professionalId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }
    await pool.query(
      `UPDATE conversation_pauses
       SET resumed_at = NOW()
       WHERE conversation_id = $1 AND company_id = $2`,
      [req.params.id, getRequestCompanyId(req)]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error resuming conversation:', err);
    res.status(500).json({ error: 'Failed to resume conversation' });
  }
});

conversationsRouter.post('/:id/messages/manual', validateBody(manualMessageSchema), async (req, res) => {
  const { content } = req.body;

  try {
    const professionalId = getScopedProfessionalId(req);
    const result = await pool.query<Conversation & { evolution_instance_name: string; instance_status: string }>(
      `SELECT c.*, wi.evolution_instance_name
             , wi.status AS instance_status
       FROM conversations c
       JOIN whatsapp_instances wi ON wi.id = c.instance_id
       WHERE c.id = $1 AND c.company_id = $2
         AND ($3::uuid IS NULL OR c.professional_id = $3)
       LIMIT 1`,
      [req.params.id, getRequestCompanyId(req), professionalId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const conversation = result.rows[0];
    if (conversation.archived_at) {
      res.status(409).json({
        error: 'Failed to send manual message',
        message: 'La conversacion esta archivada. Espera un mensaje nuevo del cliente para reabrirla.',
        code: 'CONVERSATION_ARCHIVED',
      });
      return;
    }

    if (conversation.instance_status !== 'connected') {
      res.status(409).json({
        error: 'Failed to send manual message',
        message: 'La instancia de WhatsApp no está conectada. Pedí un QR nuevo o refrescá el estado antes de enviar mensajes manuales.',
        code: 'INSTANCE_NOT_CONNECTED',
      });
      return;
    }

    await evolution.sendText(conversation.evolution_instance_name, conversation.phone_number, content);
    const messageResult = await pool.query<Message>(
      `INSERT INTO messages (conversation_id, role, content)
       VALUES ($1, 'assistant', $2)
       RETURNING *`,
      [conversation.id, content]
    );
    await pool.query(
      'UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1 AND company_id = $2',
      [conversation.id, getRequestCompanyId(req)]
    );
    res.status(201).json({ data: messageResult.rows[0] });
  } catch (err) {
    logger.error('Error sending manual message:', err);
    if (err instanceof EvolutionApiError) {
      const statusCode = err.statusCode === 404 ? 409 : err.statusCode >= 400 && err.statusCode < 500 ? 400 : 502;
      res.status(statusCode).json({
        error: 'Failed to send manual message',
        message:
          err.statusCode === 404
            ? 'La instancia de WhatsApp no existe o perdió su conexión. Volvé a pedir QR y refrescá el estado.'
            : err.statusCode === 401 || err.statusCode === 403
              ? 'Evolution rechazó el envío. Revisá las credenciales o la autorización de la instancia.'
              : 'Evolution no pudo entregar el mensaje manual. Reintentá cuando la instancia esté conectada.',
        code: 'EVOLUTION_SEND_FAILED',
        details: err.message,
      });
      return;
    }

    if (err instanceof Error && /fetch failed|AbortError|TimeoutError|ECONNREFUSED|ECONNRESET/i.test(err.message)) {
      res.status(502).json({
        error: 'Failed to send manual message',
        message: 'No se pudo conectar con Evolution para enviar el mensaje manual.',
        code: 'EVOLUTION_UNAVAILABLE',
        details: err.message,
      });
      return;
    }

    res.status(500).json({
      error: 'Failed to send manual message',
      message: err instanceof Error ? err.message : 'Unexpected error while sending manual message',
      code: 'MANUAL_SEND_FAILED',
    });
  }
});
