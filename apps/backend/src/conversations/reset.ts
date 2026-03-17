import { pool } from '../db/pool';
import type { Conversation, Message } from '@talora/shared';

export const RESET_CONFIRMATION_MESSAGE = 'Listo, ya borre la memoria de esta conversacion. Arranquemos de cero.';
export const RESET_SYSTEM_EVENT_MESSAGE = 'Memoria reseteada. Conversacion archivada.';

export function isResetCommand(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized === '/reset' || normalized === 'reset';
}

export async function resetConversationMemory(
  conversationId: string,
  companyId: string,
): Promise<{ conversation: Conversation; systemMessage: Message }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const systemResult = await client.query<Message>(
      `INSERT INTO messages (conversation_id, role, content)
       VALUES ($1, 'system', $2)
       RETURNING *`,
      [conversationId, RESET_SYSTEM_EVENT_MESSAGE],
    );

    const conversationResult = await client.query<Conversation>(
      `UPDATE conversations
       SET professional_id = NULL,
           professional_binding_suppressed = true,
           bot_paused = false,
           paused_at = NULL,
           paused_by_user_id = NULL,
           auto_resume_at = NULL,
           memory_reset_at = NOW(),
           archived_at = NOW(),
           archive_reason = 'manual_reset',
           last_message_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [conversationId, companyId],
    );

    if (conversationResult.rows.length === 0) {
      throw new Error('Conversation not found');
    }

    await client.query(
      `UPDATE conversation_pauses
       SET resumed_at = NOW()
       WHERE conversation_id = $1 AND company_id = $2 AND resumed_at IS NULL`,
      [conversationId, companyId]
    );

    await client.query('COMMIT');

    return {
      conversation: conversationResult.rows[0],
      systemMessage: systemResult.rows[0],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
