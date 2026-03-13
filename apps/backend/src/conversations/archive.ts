import { pool } from '../db/pool';
import type { Conversation, ConversationArchiveReason } from '@talora/shared';

export const ARCHIVE_AFTER_INACTIVITY_MS = 48 * 60 * 60 * 1000;

export function isConversationInactive(lastMessageAt: string | null | undefined): boolean {
  if (!lastMessageAt) return false;
  const lastActivity = new Date(lastMessageAt).getTime();
  if (Number.isNaN(lastActivity)) return false;
  return Date.now() - lastActivity >= ARCHIVE_AFTER_INACTIVITY_MS;
}

export async function archiveConversation(
  conversationId: string,
  companyId: string,
  reason: ConversationArchiveReason
): Promise<Conversation | null> {
  const result = await pool.query<Conversation>(
    `UPDATE conversations
     SET archived_at = NOW(),
         archive_reason = $3,
         memory_reset_at = NOW(),
         updated_at = NOW()
     WHERE id = $1 AND company_id = $2
     RETURNING *`,
    [conversationId, companyId, reason]
  );
  return result.rows[0] ?? null;
}

export async function archiveStaleConversations(companyId: string, professionalId?: string | null): Promise<void> {
  const values: unknown[] = [companyId];
  let professionalClause = '';

  if (professionalId) {
    professionalClause = ` AND professional_id = $2`;
    values.push(professionalId);
  }

  await pool.query(
    `UPDATE conversations
     SET archived_at = NOW(),
         archive_reason = 'inactive_48h',
         memory_reset_at = NOW(),
         updated_at = NOW()
     WHERE company_id = $1
       ${professionalClause}
       AND archived_at IS NULL
       AND last_message_at IS NOT NULL
       AND last_message_at < NOW() - INTERVAL '48 hours'`,
    values
  );
}
