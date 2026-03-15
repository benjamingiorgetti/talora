import { appEvents, type AppointmentCreatedEvent } from '../events';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';

export function initAttributionListener(): void {
  appEvents.on('appointment:created', async (event: AppointmentCreatedEvent) => {
    try {
      if (!event.clientId) return;

      // Query most recent reactivation message for this client in last 7 days with status='sent'
      const result = await pool.query<{ id: string }>(
        `SELECT id FROM reactivation_messages
         WHERE client_id = $1
           AND sent_at >= NOW() - INTERVAL '7 days'
           AND status = 'sent'
         ORDER BY sent_at DESC
         LIMIT 1`,
        [event.clientId]
      );

      const reactivationMessage = result.rows[0];
      if (!reactivationMessage) return;

      await pool.query(
        `UPDATE reactivation_messages
         SET status = 'converted',
             converted_at = NOW(),
             attributed_appointment_id = $1
         WHERE id = $2`,
        [event.appointmentId, reactivationMessage.id]
      );

      logger.info(
        `[attribution] Attributed appointment ${event.appointmentId} to reactivation message ${reactivationMessage.id} for client ${event.clientId}`
      );
    } catch (err) {
      // Attribution failures must NEVER propagate
      logger.error('[attribution] Failed to attribute appointment to reactivation message:', err);
    }
  });

  logger.info('[attribution] Attribution listener initialized');
}
