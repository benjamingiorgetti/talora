import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { sendOutboundMessage } from '../growth/reactivation';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BATCH_LIMIT = 100;
const DEFAULT_FALLBACK_TZ = 'America/Argentina/Buenos_Aires';

export const DEFAULT_REMINDER_TEMPLATE =
  'Hola {{client_name}}! Te recordamos que tenes turno {{time_description}} para {{service_name}} en {{company_name}}. Te esperamos!';

let intervalId: ReturnType<typeof setInterval> | null = null;

interface PendingReminder {
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

/**
 * Formats a date into localized parts for a given timezone.
 * Falls back to DEFAULT_FALLBACK_TZ if the timezone is invalid.
 */
function formatDateParts(
  startsAt: string,
  timezone: string,
  now = new Date()
): { date: string; time: string; timeDescription: string } {
  let tz = timezone;
  try {
    // Validate timezone by attempting to use it
    new Intl.DateTimeFormat('es-AR', { timeZone: tz }).format();
  } catch {
    tz = DEFAULT_FALLBACK_TZ;
  }

  const apptDate = new Date(startsAt);

  const dateFormatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
  });
  const timeFormatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const date = dateFormatter.format(apptDate);
  const time = timeFormatter.format(apptDate);

  // Compare calendar days in the company timezone
  const dayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const apptDay = dayFormatter.format(apptDate);
  const todayDay = dayFormatter.format(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDay = dayFormatter.format(tomorrow);

  let timeDescription: string;
  if (apptDay === todayDay) {
    timeDescription = `hoy a las ${time}`;
  } else if (apptDay === tomorrowDay) {
    timeDescription = `manana a las ${time}`;
  } else {
    timeDescription = `el ${date} a las ${time}`;
  }

  return { date, time, timeDescription };
}

export function generateReminderMessage(params: {
  clientName: string;
  serviceName: string;
  companyName: string;
  professionalName: string;
  startsAt: string;
  timezone: string;
  customTemplate?: string | null;
  now?: Date;
}): string {
  const template = params.customTemplate ?? DEFAULT_REMINDER_TEMPLATE;
  const { date, time, timeDescription } = formatDateParts(params.startsAt, params.timezone, params.now);

  return template
    .replace(/\{\{client_name\}\}/g, params.clientName)
    .replace(/\{\{service_name\}\}/g, params.serviceName)
    .replace(/\{\{company_name\}\}/g, params.companyName)
    .replace(/\{\{professional_name\}\}/g, params.professionalName)
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{time\}\}/g, time)
    .replace(/\{\{time_description\}\}/g, timeDescription);
}

export async function processReminders(): Promise<void> {
  try {
    const result = await pool.query<PendingReminder>(
      `SELECT
        a.id AS appointment_id,
        a.company_id,
        a.client_id,
        a.client_name,
        a.starts_at,
        s.name AS service_name,
        co.name AS company_name,
        p.name AS professional_name,
        cs.reminder_message_template,
        COALESCE(cs.timezone, 'America/Argentina/Buenos_Aires') AS timezone
      FROM appointments a
      JOIN company_settings cs ON cs.company_id = a.company_id
      JOIN companies co ON co.id = a.company_id
      LEFT JOIN services s ON s.id = a.service_id
      LEFT JOIN professionals p ON p.id = a.professional_id
      WHERE cs.reminder_enabled = true
        AND a.status = 'confirmed'
        AND a.reminder_sent_at IS NULL
        AND a.client_id IS NOT NULL
        AND a.starts_at > NOW()
        AND a.starts_at <= NOW() + (cs.reminder_hours_before * INTERVAL '1 hour')
      ORDER BY a.starts_at ASC
      LIMIT $1`,
      [BATCH_LIMIT]
    );

    const pending = result.rows;
    if (pending.length === 0) return;

    logger.info(`[reminders] Processing cycle: found ${pending.length} pending reminders`);

    const sentIds: string[] = [];
    let stopped = false;

    for (const row of pending) {
      if (stopped) break;

      const message = generateReminderMessage({
        clientName: row.client_name,
        serviceName: row.service_name ?? 'tu turno',
        companyName: row.company_name,
        professionalName: row.professional_name ?? '',
        startsAt: row.starts_at,
        timezone: row.timezone,
        customTemplate: row.reminder_message_template,
      });

      const sendResult = await sendOutboundMessage(row.company_id, row.client_id, message);

      if (sendResult.success) {
        sentIds.push(row.appointment_id);
        logger.info(`[reminders] Sent reminder for appointment ${row.appointment_id}`);
      } else if (sendResult.status === 429) {
        logger.info(`[reminders] Rate limit hit, stopping cycle. Sent ${sentIds.length}/${pending.length}`);
        stopped = true;
      } else {
        logger.warn(`[reminders] Failed to send reminder for appointment ${row.appointment_id}: ${sendResult.error}`);
      }
    }

    // Batch update all successfully sent reminders
    if (sentIds.length > 0) {
      await pool.query(
        `UPDATE appointments SET reminder_sent_at = NOW() WHERE id = ANY($1)`,
        [sentIds]
      );
    }

    logger.info(`[reminders] Cycle complete: ${sentIds.length}/${pending.length} sent`);
  } catch (err) {
    logger.error('[reminders] Error in processing cycle:', err);
  }
}

export function initReminderScheduler(): void {
  // Run once immediately (non-blocking)
  processReminders().catch((err) => {
    logger.error('[reminders] Error in initial run:', err);
  });

  intervalId = setInterval(() => {
    processReminders().catch((err) => {
      logger.error('[reminders] Error in scheduled run:', err);
    });
  }, POLL_INTERVAL_MS);

  logger.info('[reminders] Scheduler initialized, polling every 5 minutes');
}

export function stopReminderScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[reminders] Scheduler stopped');
  }
}
