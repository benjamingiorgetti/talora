import { pool } from '../db/pool';
import type { Conversation } from '@talora/shared';

export type ConversationPausePayload = Pick<
  Conversation,
  'id' | 'company_id' | 'instance_id' | 'professional_id' | 'last_message_at' | 'bot_paused' | 'auto_resume_at' | 'archived_at' | 'archive_reason'
>;

export function isAutoPauseExpired(autoResumeAt: string | null | undefined): boolean {
  if (!autoResumeAt) return false;
  const expiresAt = new Date(autoResumeAt).getTime();
  return !Number.isNaN(expiresAt) && expiresAt <= Date.now();
}

export async function clearExpiredAutoPause(conversationId: string): Promise<ConversationPausePayload | null> {
  const result = await pool.query<ConversationPausePayload>(
    `UPDATE conversations
     SET bot_paused = false,
         paused_at = NULL,
         paused_by_user_id = NULL,
         auto_resume_at = NULL,
         updated_at = NOW()
     WHERE id = $1
       AND bot_paused = true
       AND auto_resume_at IS NOT NULL
       AND auto_resume_at <= NOW()
     RETURNING id, company_id, instance_id, professional_id, last_message_at, bot_paused, auto_resume_at, archived_at, archive_reason`,
    [conversationId],
  );

  if (result.rows.length === 0) {
    return null;
  }

  await pool.query(
    `UPDATE conversation_pauses
     SET resumed_at = NOW()
     WHERE conversation_id = $1 AND resumed_at IS NULL`,
    [conversationId],
  );

  return result.rows[0];
}
