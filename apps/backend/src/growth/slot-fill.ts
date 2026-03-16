import { appEvents, type AppointmentCancelledEvent } from '../events';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { broadcast } from '../ws/server';
import { selectSlotFillCandidates } from './slot-fill-selector';

const MIN_HOURS_BEFORE_SLOT = 2;

export function initSlotFillListener(): void {
  appEvents.on('appointment:cancelled', async (event: AppointmentCancelledEvent) => {
    try {
      if (!event.serviceId) return;

      const hoursUntilSlot = (new Date(event.startsAt).getTime() - Date.now()) / 3_600_000;
      if (hoursUntilSlot < MIN_HOURS_BEFORE_SLOT) return;

      // Check company settings
      const settingsResult = await pool.query<{
        slot_fill_enabled: boolean;
        slot_fill_max_candidates: number;
      }>(
        `SELECT slot_fill_enabled, slot_fill_max_candidates
         FROM company_settings WHERE company_id = $1`,
        [event.companyId]
      );
      if (!settingsResult.rows[0]?.slot_fill_enabled) return;

      const maxCandidates = settingsResult.rows[0].slot_fill_max_candidates ?? 3;

      // Load context for opportunity record
      const contextResult = await pool.query<{
        service_name: string;
        company_name: string;
        professional_name: string;
        slot_ends_at: string | null;
      }>(
        `SELECT s.name AS service_name, co.name AS company_name,
                COALESCE(p.name, '') AS professional_name,
                a.ends_at AS slot_ends_at
         FROM appointments a
         JOIN services s ON s.id = a.service_id
         JOIN companies co ON co.id = a.company_id
         LEFT JOIN professionals p ON p.id = a.professional_id
         WHERE a.id = $1`,
        [event.appointmentId]
      );
      if (!contextResult.rows[0]) return;

      const ctx = contextResult.rows[0];

      // Run selector engine
      const candidates = await selectSlotFillCandidates({
        companyId: event.companyId,
        serviceId: event.serviceId,
        professionalId: event.professionalId,
        startsAt: event.startsAt,
        cancelledClientId: event.cancelledClientId,
        maxCandidates,
      });

      if (candidates.length === 0) return;

      // Create opportunity
      const oppResult = await pool.query<{ id: string }>(
        `INSERT INTO slot_fill_opportunities
          (company_id, appointment_id, service_id, professional_id, slot_starts_at, slot_ends_at, service_name, professional_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          event.companyId, event.appointmentId, event.serviceId, event.professionalId,
          event.startsAt, ctx.slot_ends_at,
          ctx.service_name, ctx.professional_name,
        ]
      );
      const opportunityId = oppResult.rows[0].id;

      // Insert candidates one by one (max 3, no perf concern)
      for (const candidate of candidates) {
        await pool.query(
          `INSERT INTO slot_fill_candidates (opportunity_id, client_id, score, match_reasons)
           VALUES ($1, $2, $3, $4)`,
          [opportunityId, candidate.client_id, candidate.score, candidate.match_reasons]
        );
      }

      // Broadcast WebSocket event
      broadcast({
        type: 'slot_fill:new_opportunity',
        payload: {
          id: opportunityId,
          company_id: event.companyId,
          service_name: ctx.service_name,
        },
      });

      logger.info(
        `[slot-fill] Created opportunity ${opportunityId} with ${candidates.length} candidates for cancelled appointment ${event.appointmentId}`
      );
    } catch (err) {
      // Slot-fill failures must NEVER propagate to the cancellation flow
      logger.error('[slot-fill] Error processing cancellation:', err);
    }
  });

  logger.info('[slot-fill] Slot fill listener initialized');
}
