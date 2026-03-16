import { appEvents, type AppointmentCancelledEvent } from '../events';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { sendReactivationMessage } from './reactivation';

const MAX_RECIPIENTS = 5;
const DEDUP_DAYS = 7;
const MIN_HOURS_BEFORE_SLOT = 2;

const SLOT_FILL_DEFAULT_TEMPLATE =
  'Hola {{client_name}}! Tenemos disponibilidad esta semana para {{service_name}} en {{company_name}}. Queres agendar tu turno? Responde y te busco horario.';

export function initSlotFillListener(): void {
  appEvents.on('appointment:cancelled', async (event: AppointmentCancelledEvent) => {
    try {
      if (!event.serviceId) return;

      const hoursUntilSlot = (new Date(event.startsAt).getTime() - Date.now()) / 3_600_000;
      if (hoursUntilSlot < MIN_HOURS_BEFORE_SLOT) return;

      // Check company setting
      const settingsResult = await pool.query<{
        slot_fill_enabled: boolean;
        slot_fill_message_template: string | null;
      }>(
        `SELECT slot_fill_enabled, slot_fill_message_template
         FROM company_settings WHERE company_id = $1`,
        [event.companyId]
      );
      if (!settingsResult.rows[0]?.slot_fill_enabled) return;
      const customTemplate = settingsResult.rows[0].slot_fill_message_template;

      // Load service name + company name
      const contextResult = await pool.query<{ service_name: string; company_name: string }>(
        `SELECT s.name AS service_name, co.name AS company_name
         FROM services s, companies co
         WHERE s.id = $1 AND co.id = $2`,
        [event.serviceId, event.companyId]
      );
      if (!contextResult.rows[0]) return;
      const { service_name, company_name } = contextResult.rows[0];

      // Find eligible clients: booked same service before, active, not canceller, not recently messaged
      const eligible = await pool.query<{ client_id: string; client_name: string }>(
        `SELECT DISTINCT ON (c.id) c.id AS client_id, c.name AS client_name
         FROM appointments a
         JOIN clients c ON c.id = a.client_id
         WHERE a.company_id = $1
           AND a.service_id = $2
           AND a.status = 'confirmed'
           AND a.client_id IS NOT NULL
           AND ($3::uuid IS NULL OR a.client_id != $3)
           AND c.is_active = true
           AND NOT EXISTS (
             SELECT 1 FROM reactivation_messages rm
             WHERE rm.client_id = c.id
               AND rm.sent_at >= NOW() - INTERVAL '7 days'
               AND rm.status IN ('sent', 'converted')
           )
         ORDER BY c.id
         LIMIT $4`,
        [event.companyId, event.serviceId, event.cancelledClientId, MAX_RECIPIENTS]
      );

      if (eligible.rows.length === 0) return;

      let sent = 0;
      for (const row of eligible.rows) {
        const message = (customTemplate ?? SLOT_FILL_DEFAULT_TEMPLATE)
          .replace(/\{\{client_name\}\}/g, row.client_name)
          .replace(/\{\{service_name\}\}/g, service_name)
          .replace(/\{\{company_name\}\}/g, company_name);

        const result = await sendReactivationMessage(event.companyId, row.client_id, message);
        if (!result.success) {
          if (result.status === 429) {
            logger.info(`[slot-fill] Rate limit reached, stopping. Sent ${sent}/${eligible.rows.length}`);
            break;
          }
          logger.warn(`[slot-fill] Failed to send to client ${row.client_id}: ${result.error}`);
          continue;
        }

        // Tag the reactivation_messages record as slot_fill
        await pool.query(
          `UPDATE reactivation_messages SET trigger_type = 'slot_fill' WHERE id = $1`,
          [result.reactivationId]
        );
        sent++;
      }

      logger.info(
        `[slot-fill] Sent ${sent}/${eligible.rows.length} messages for cancelled appointment ${event.appointmentId}`
      );
    } catch (err) {
      // Slot-fill failures must NEVER propagate to the cancellation flow
      logger.error('[slot-fill] Error processing cancellation:', err);
    }
  });

  logger.info('[slot-fill] Slot fill listener initialized');
}
