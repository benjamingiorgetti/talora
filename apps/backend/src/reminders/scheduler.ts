import { logger } from '../utils/logger';
import { sendWhatsAppMessage } from '../outbound/service';
import { claimDueReminders, initReminderSyncListener, markReminderFailed, markReminderSent } from './service';

const POLL_INTERVAL_MS = 60 * 1000; // 1 minute
const BATCH_LIMIT = 100;
const DEFAULT_FALLBACK_TZ = 'America/Argentina/Buenos_Aires';

export const DEFAULT_REMINDER_TEMPLATE =
  'Hola {{client_name}}! Te recordamos que tenes turno {{time_description}} para {{service_name}} en {{company_name}}. Te esperamos!';

let intervalId: ReturnType<typeof setInterval> | null = null;

function formatDateParts(
  startsAt: string,
  timezone: string,
  now = new Date()
): { date: string; time: string; timeDescription: string } {
  let tz = timezone;
  try {
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
    const dueReminders = await claimDueReminders(BATCH_LIMIT);
    if (dueReminders.length === 0) return;

    logger.info(`[reminders] Processing cycle: found ${dueReminders.length} due reminders`);

    for (const row of dueReminders) {
      const message = generateReminderMessage({
        clientName: row.client_name,
        serviceName: row.service_name ?? 'tu turno',
        companyName: row.company_name,
        professionalName: row.professional_name ?? '',
        startsAt: row.starts_at,
        timezone: row.timezone,
        customTemplate: row.reminder_message_template,
      });

      const sendResult = await sendWhatsAppMessage({
        companyId: row.company_id,
        clientId: row.client_id,
        messageText: message,
        purpose: 'reminder',
        sourceType: 'appointment_reminder',
        sourceId: row.reminder_id,
      });

      if (sendResult.success) {
        await markReminderSent(row.reminder_id, sendResult.outboundMessageId);
        logger.info(`[reminders] Sent reminder for appointment ${row.appointment_id}`);
        continue;
      }

      await markReminderFailed(row.reminder_id, sendResult.error);
      logger.warn(`[reminders] Failed to send reminder for appointment ${row.appointment_id}: ${sendResult.error}`);
    }

    logger.info(`[reminders] Cycle complete: ${dueReminders.length}/${dueReminders.length} processed`);
  } catch (err) {
    logger.error('[reminders] Error in processing cycle:', err);
  }
}

export function initReminderScheduler(): void {
  initReminderSyncListener();

  processReminders().catch((err) => {
    logger.error('[reminders] Error in initial run:', err);
  });

  intervalId = setInterval(() => {
    processReminders().catch((err) => {
      logger.error('[reminders] Error in scheduled run:', err);
    });
  }, POLL_INTERVAL_MS);

  logger.info('[reminders] Scheduler initialized, polling every 1 minute');
}

export function stopReminderScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[reminders] Scheduler stopped');
  }
}
