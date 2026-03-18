import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { appEvents, type AppointmentCancelledEvent, type AppointmentCreatedEvent, type AppointmentRescheduledEvent, type AppointmentConfirmedEvent, type CompanySettingsUpdatedEvent } from '../events';

const DEFAULT_FALLBACK_TZ = 'America/Argentina/Buenos_Aires';
const DEFAULT_REMINDER_HOURS = 3;

export type ReminderLatePolicy = 'strict_due_at' | 'late_send';

interface ReminderCandidateRow {
  appointment_id: string;
  company_id: string;
  client_id: string | null;
  starts_at: string;
  status: string;
  reminder_enabled: boolean;
  reminder_hours_before: number;
  timezone: string;
}

export interface ReminderUpsertResult {
  status: 'pending' | 'skipped' | 'cancelled';
  dueAt: string | null;
  reason: string | null;
}

export interface ClaimedReminder {
  reminder_id: string;
  appointment_id: string;
  company_id: string;
  client_id: string;
  client_name: string;
  starts_at: string;
  service_name: string | null;
  company_name: string;
  professional_name: string | null;
  reminder_message_template: string | null;
  timezone: string;
}

let listenersInitialized = false;

function computeDueAt(startsAt: string, hoursBefore: number): string {
  return new Date(new Date(startsAt).getTime() - hoursBefore * 60 * 60 * 1000).toISOString();
}

async function persistReminderRow(params: {
  appointmentId: string;
  companyId: string;
  clientId: string | null;
  dueAt: string | null;
  status: 'pending' | 'skipped' | 'cancelled';
  reason: string | null;
}): Promise<ReminderUpsertResult> {
  const result = await pool.query<{ status: ReminderUpsertResult['status']; due_at: string | null; status_reason: string | null }>(
    `INSERT INTO appointment_reminders (
      appointment_id, company_id, client_id, due_at, status, status_reason,
      claimed_at, sent_at, last_error, outbound_message_id, created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      NULL, NULL, NULL, NULL, NOW(), NOW()
    )
    ON CONFLICT (appointment_id) DO UPDATE SET
      company_id = EXCLUDED.company_id,
      client_id = EXCLUDED.client_id,
      due_at = EXCLUDED.due_at,
      status = EXCLUDED.status,
      status_reason = EXCLUDED.status_reason,
      claimed_at = NULL,
      sent_at = NULL,
      last_error = NULL,
      outbound_message_id = NULL,
      updated_at = NOW()
    RETURNING status, due_at, status_reason`,
    [
      params.appointmentId,
      params.companyId,
      params.clientId,
      params.dueAt,
      params.status,
      params.reason,
    ]
  );

  return {
    status: result.rows[0]?.status ?? params.status,
    dueAt: result.rows[0]?.due_at ?? params.dueAt,
    reason: result.rows[0]?.status_reason ?? params.reason,
  };
}

export async function upsertReminderForAppointment(
  appointmentId: string,
  options: {
    now?: Date;
    latePolicy?: ReminderLatePolicy;
  } = {}
): Promise<ReminderUpsertResult> {
  const now = options.now ?? new Date();
  const latePolicy = options.latePolicy ?? 'strict_due_at';

  const result = await pool.query<ReminderCandidateRow>(
    `SELECT
      a.id AS appointment_id,
      a.company_id,
      a.client_id,
      a.starts_at,
      a.status,
      COALESCE(cs.reminder_enabled, false) AS reminder_enabled,
      COALESCE(cs.reminder_hours_before, ${DEFAULT_REMINDER_HOURS}) AS reminder_hours_before,
      COALESCE(cs.timezone, '${DEFAULT_FALLBACK_TZ}') AS timezone
     FROM appointments a
     LEFT JOIN company_settings cs ON cs.company_id = a.company_id
     WHERE a.id = $1
     LIMIT 1`,
    [appointmentId]
  );

  const row = result.rows[0];
  if (!row) {
    return { status: 'cancelled', dueAt: null, reason: 'appointment_not_found' };
  }

  if (row.status !== 'confirmed') {
    return persistReminderRow({
      appointmentId: row.appointment_id,
      companyId: row.company_id,
      clientId: row.client_id,
      dueAt: null,
      status: 'cancelled',
      reason: 'appointment_not_confirmed',
    });
  }

  if (!row.reminder_enabled) {
    return persistReminderRow({
      appointmentId: row.appointment_id,
      companyId: row.company_id,
      clientId: row.client_id,
      dueAt: null,
      status: 'cancelled',
      reason: 'reminder_disabled',
    });
  }

  if (!row.client_id) {
    return persistReminderRow({
      appointmentId: row.appointment_id,
      companyId: row.company_id,
      clientId: row.client_id,
      dueAt: null,
      status: 'skipped',
      reason: 'missing_client',
    });
  }

  const dueAt = computeDueAt(row.starts_at, row.reminder_hours_before);
  if (new Date(row.starts_at).getTime() <= now.getTime()) {
    return persistReminderRow({
      appointmentId: row.appointment_id,
      companyId: row.company_id,
      clientId: row.client_id,
      dueAt,
      status: 'skipped',
      reason: 'past_start',
    });
  }

  if (latePolicy === 'strict_due_at' && new Date(dueAt).getTime() <= now.getTime()) {
    return persistReminderRow({
      appointmentId: row.appointment_id,
      companyId: row.company_id,
      clientId: row.client_id,
      dueAt,
      status: 'skipped',
      reason: 'past_due_at',
    });
  }

  return persistReminderRow({
    appointmentId: row.appointment_id,
    companyId: row.company_id,
    clientId: row.client_id,
    dueAt,
    status: 'pending',
    reason: null,
  });
}

export async function cancelReminderForAppointment(appointmentId: string, reason = 'appointment_cancelled'): Promise<void> {
  await pool.query(
    `UPDATE appointment_reminders
     SET status = 'cancelled',
         status_reason = $2,
         updated_at = NOW()
     WHERE appointment_id = $1`,
    [appointmentId, reason]
  );
}

export async function rescheduleFutureRemindersForCompany(companyId: string): Promise<void> {
  const result = await pool.query<{ id: string }>(
    `SELECT id
     FROM appointments
     WHERE company_id = $1
       AND starts_at > NOW()`,
    [companyId]
  );

  for (const row of result.rows) {
    await upsertReminderForAppointment(row.id);
  }
}

export async function claimDueReminders(limit = 100, now = new Date()): Promise<ClaimedReminder[]> {
  const claimResult = await pool.query<{ id: string }>(
    `WITH due AS (
      SELECT ar.id
      FROM appointment_reminders ar
      JOIN appointments a ON a.id = ar.appointment_id
      WHERE ar.status = 'pending'
        AND ar.due_at IS NOT NULL
        AND ar.due_at <= $2
        AND a.starts_at > $2
      ORDER BY ar.due_at ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE appointment_reminders ar
    SET status = 'processing',
        claimed_at = NOW(),
        updated_at = NOW()
    FROM due
    WHERE ar.id = due.id
    RETURNING ar.id`,
    [limit, now.toISOString()]
  );

  const ids = claimResult.rows.map((row) => row.id);
  if (ids.length === 0) return [];

  const result = await pool.query<ClaimedReminder>(
    `SELECT
      ar.id AS reminder_id,
      ar.appointment_id,
      ar.company_id,
      ar.client_id,
      a.client_name,
      a.starts_at,
      s.name AS service_name,
      co.name AS company_name,
      p.name AS professional_name,
      cs.reminder_message_template,
      COALESCE(cs.timezone, '${DEFAULT_FALLBACK_TZ}') AS timezone
     FROM appointment_reminders ar
     JOIN appointments a ON a.id = ar.appointment_id
     JOIN companies co ON co.id = ar.company_id
     LEFT JOIN company_settings cs ON cs.company_id = ar.company_id
     LEFT JOIN services s ON s.id = a.service_id
     LEFT JOIN professionals p ON p.id = a.professional_id
     WHERE ar.id = ANY($1)
     ORDER BY ar.due_at ASC`,
    [ids]
  );

  return result.rows;
}

export async function markReminderSent(reminderId: string, outboundMessageId: string): Promise<void> {
  await pool.query(
    `UPDATE appointment_reminders
     SET status = 'sent',
         sent_at = NOW(),
         outbound_message_id = $2,
         status_reason = NULL,
         last_error = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [reminderId, outboundMessageId]
  );

  await pool.query(
    `UPDATE appointments
     SET reminder_sent_at = NOW(),
         updated_at = NOW()
     WHERE id = (
       SELECT appointment_id
       FROM appointment_reminders
       WHERE id = $1
     )`,
    [reminderId]
  );
}

export async function markReminderFailed(reminderId: string, error: string): Promise<void> {
  await pool.query(
    `UPDATE appointment_reminders
     SET status = 'failed',
         last_error = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [reminderId, error]
  );
}

async function syncFromCreated(event: AppointmentCreatedEvent | AppointmentRescheduledEvent | AppointmentConfirmedEvent) {
  try {
    await upsertReminderForAppointment(event.appointmentId);
  } catch (err) {
    logger.error('[reminders] Failed to sync reminder after appointment change:', err);
  }
}

async function syncFromCancelled(event: AppointmentCancelledEvent) {
  try {
    await cancelReminderForAppointment(event.appointmentId);
  } catch (err) {
    logger.error('[reminders] Failed to cancel reminder after appointment cancellation:', err);
  }
}

async function syncFromSettings(event: CompanySettingsUpdatedEvent) {
  try {
    if (!event.reminderSettingsChanged) return;
    await rescheduleFutureRemindersForCompany(event.companyId);
  } catch (err) {
    logger.error('[reminders] Failed to reschedule future reminders after settings update:', err);
  }
}

export function initReminderSyncListener(): void {
  if (listenersInitialized) return;
  listenersInitialized = true;

  appEvents.on('appointment:created', syncFromCreated);
  appEvents.on('appointment:rescheduled', syncFromCreated);
  appEvents.on('appointment:confirmed', syncFromCreated);
  appEvents.on('appointment:cancelled', syncFromCancelled);
  appEvents.on('company:settings_updated', syncFromSettings);

  logger.info('[reminders] Reminder sync listener initialized');
}
