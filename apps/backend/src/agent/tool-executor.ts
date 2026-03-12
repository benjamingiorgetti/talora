import { pool } from '../db/pool';
import { bookSlot, checkSlot, deleteEvent, updateEvent } from '../calendar/operations';
import { validateWebhookUrl } from '../utils/url-validator';
import { logger } from '../utils/logger';
import type { Appointment, Client, Professional, Service } from '@talora/shared';

type ToolExecutionContext = {
  companyId?: string;
  conversationId?: string;
  phoneNumber?: string;
  contactName?: string | null;
  professionalId?: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizePhone(value: string | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function getAppointmentDurationMinutes(appointment: Appointment): number {
  return Math.max(
    15,
    Math.round((new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000)
  );
}

async function getProfessional(companyId: string, professionalId: string): Promise<Professional | null> {
  const result = await pool.query<Professional>(
    'SELECT * FROM professionals WHERE id = $1 AND company_id = $2 AND is_active = true LIMIT 1',
    [professionalId, companyId]
  );
  return result.rows[0] ?? null;
}

async function getService(companyId: string, serviceId: string): Promise<Service | null> {
  const result = await pool.query<Service>(
    'SELECT * FROM services WHERE id = $1 AND company_id = $2 AND is_active = true LIMIT 1',
    [serviceId, companyId]
  );
  return result.rows[0] ?? null;
}

async function resolveSchedulingContext(
  companyId: string,
  toolInput: Record<string, unknown>,
  contextProfessionalId?: string | null
): Promise<{ professional: Professional; service: Service | null; durationMinutes: number; calendarId: string }> {
  const inputProfessionalId =
    asString(toolInput.professionalId) ??
    asString(toolInput.professional_id) ??
    null;
  // Priority: conversation's professional > tool input > service's professional
  const effectiveProfessionalId = contextProfessionalId ?? inputProfessionalId;
  const serviceId =
    asString(toolInput.serviceId) ??
    asString(toolInput.service_id) ??
    null;
  const calendarIdOverride =
    asString(toolInput.calendarId) ??
    asString(toolInput.calendar_id) ??
    null;

  const service = serviceId ? await getService(companyId, serviceId) : null;
  let professional: Professional | null = effectiveProfessionalId ? await getProfessional(companyId, effectiveProfessionalId) : null;

  if (!professional && service?.professional_id) {
    professional = await getProfessional(companyId, service.professional_id);
  }

  if (!professional) {
    throw new Error('No se pudo determinar el profesional para esta operación. La conversación no tiene un profesional asignado.');
  }

  const durationMinutes =
    asNumber(toolInput.durationMinutes) ??
    asNumber(toolInput.duration_minutes) ??
    service?.duration_minutes ??
    60;

  return {
    professional,
    service,
    durationMinutes,
    calendarId: calendarIdOverride ?? professional.calendar_id,
  };
}

async function getPrimaryAgentId(companyId: string): Promise<string> {
  const result = await pool.query<{ id: string }>(
    'SELECT id FROM agents WHERE company_id = $1 ORDER BY created_at ASC LIMIT 1',
    [companyId]
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error('No hay agente configurado para esta empresa');
  return id;
}

async function upsertClient(
  companyId: string,
  agentId: string,
  professionalId: string,
  phoneNumber: string,
  contactName: string
): Promise<Client | null> {
  const normalizedPhone = normalizePhone(phoneNumber);
  if (!normalizedPhone) return null;

  const existing = await pool.query<Client>(
    'SELECT * FROM clients WHERE company_id = $1 AND phone_number = $2 LIMIT 1',
    [companyId, normalizedPhone]
  );
  if (existing.rows[0]) {
    const client = existing.rows[0];
    if (client.professional_id && client.professional_id !== professionalId) {
      throw new Error('El cliente ya pertenece a otro profesional');
    }
    if (!client.professional_id) {
      const updated = await pool.query<Client>(
        `UPDATE clients
         SET professional_id = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [professionalId, client.id]
      );
      return updated.rows[0] ?? client;
    }
    return client;
  }

  const result = await pool.query<Client>(
    `INSERT INTO clients (company_id, agent_id, professional_id, phone_number, name, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING *`,
    [companyId, agentId, professionalId, normalizedPhone, contactName || 'Cliente']
  );
  return result.rows[0] ?? null;
}

async function resolveAppointmentByReference(
  companyId: string,
  toolInput: Record<string, unknown>
): Promise<Appointment | null> {
  const appointmentId =
    asString(toolInput.appointmentId) ??
    asString(toolInput.appointment_id) ??
    null;
  const eventId =
    asString(toolInput.eventId) ??
    asString(toolInput.event_id) ??
    null;

  if (appointmentId) {
    const result = await pool.query<Appointment>(
      'SELECT * FROM appointments WHERE id = $1 AND company_id = $2 LIMIT 1',
      [appointmentId, companyId]
    );
    return result.rows[0] ?? null;
  }

  if (eventId) {
    const result = await pool.query<Appointment>(
      'SELECT * FROM appointments WHERE google_event_id = $1 AND company_id = $2 ORDER BY created_at DESC LIMIT 1',
      [eventId, companyId]
    );
    return result.rows[0] ?? null;
  }

  return null;
}

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  context: ToolExecutionContext = {}
): Promise<string> {
  try {
    switch (toolName) {
      case 'google_calendar_check': {
        const date = asString(toolInput.date) ?? asString(toolInput.startsAt) ?? asString(toolInput.starts_at);
        if (!date) {
          return JSON.stringify({ error: 'date is required' });
        }

        if (!context.companyId) {
          const durationMinutes = asNumber(toolInput.durationMinutes) ?? 60;
          const result = await checkSlot(date, durationMinutes);
          return JSON.stringify(result);
        }

        const scheduling = await resolveSchedulingContext(context.companyId, toolInput, context.professionalId);
        const result = await checkSlot(date, scheduling.durationMinutes, scheduling.calendarId, scheduling.professional.id);
        return JSON.stringify(result);
      }

      case 'google_calendar_book': {
        if (context.companyId && !context.professionalId) {
          return JSON.stringify({
            error: 'No hay profesional asignado a esta conversación. No se pueden gestionar turnos automáticamente. Contactar al administrador para asignar un profesional.',
          });
        }

        const date = asString(toolInput.date) ?? asString(toolInput.startsAt) ?? asString(toolInput.starts_at);
        if (!date) {
          return JSON.stringify({ error: 'date is required' });
        }

        const name =
          asString(toolInput.name) ??
          asString(toolInput.clientName) ??
          context.contactName ??
          'Cliente';
        const description = asString(toolInput.description) ?? asString(toolInput.notes) ?? '';

        if (!context.companyId) {
          const durationMinutes = asNumber(toolInput.durationMinutes) ?? 60;
          const result = await bookSlot(name, date, durationMinutes, description);
          return JSON.stringify(result);
        }

        const scheduling = await resolveSchedulingContext(context.companyId, toolInput, context.professionalId);
        const title = scheduling.service ? `${name} - ${scheduling.service.name}` : name;
        const fullDescription = [
          scheduling.service?.description,
          description,
          context.phoneNumber ? `Telefono: ${normalizePhone(context.phoneNumber)}` : '',
        ].filter(Boolean).join('\n\n');
        const booking = await bookSlot(
          title,
          date,
          scheduling.durationMinutes,
          fullDescription,
          scheduling.calendarId,
          scheduling.professional.id
        );
        if (!booking.success) {
          return JSON.stringify(booking);
        }

        const agentId = await getPrimaryAgentId(context.companyId);
        const client = await upsertClient(
          context.companyId,
          agentId,
          scheduling.professional.id,
          context.phoneNumber ?? '',
          name
        );
        const endsAt = new Date(new Date(date).getTime() + scheduling.durationMinutes * 60 * 1000).toISOString();

        const result = await pool.query<Appointment>(
          `INSERT INTO appointments (
             company_id, client_id, professional_id, service_id, conversation_id, phone_number, client_name,
             google_event_id, starts_at, ends_at, status, source, title, notes
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed', 'bot', $11, $12)
           RETURNING *`,
          [
            context.companyId,
            client?.id ?? null,
            scheduling.professional.id,
            scheduling.service?.id ?? null,
            context.conversationId ?? null,
            normalizePhone(context.phoneNumber),
            name,
            booking.eventId ?? null,
            date,
            endsAt,
            title,
            description,
          ]
        );

        return JSON.stringify({
          success: true,
          eventId: booking.eventId,
          appointmentId: result.rows[0]?.id ?? null,
          professionalId: scheduling.professional.id,
          serviceId: scheduling.service?.id ?? null,
        });
      }

      case 'google_calendar_reprogram': {
        if (context.companyId && !context.professionalId) {
          return JSON.stringify({
            error: 'No hay profesional asignado a esta conversación. No se pueden gestionar turnos automáticamente. Contactar al administrador para asignar un profesional.',
          });
        }

        if (!context.companyId) {
          return JSON.stringify({ error: 'Company context required for reprogramming' });
        }

        const appointment = await resolveAppointmentByReference(context.companyId, toolInput);
        if (!appointment) {
          return JSON.stringify({ error: 'Appointment not found' });
        }

        const startsAt = asString(toolInput.startsAt) ?? asString(toolInput.starts_at) ?? asString(toolInput.date);
        if (!startsAt) {
          return JSON.stringify({ error: 'startsAt is required' });
        }

        const professionalId =
          asString(toolInput.professionalId) ??
          asString(toolInput.professional_id) ??
          appointment.professional_id;
        const serviceId =
          asString(toolInput.serviceId) ??
          asString(toolInput.service_id) ??
          appointment.service_id;

        if (!professionalId) {
          return JSON.stringify({ error: 'professionalId is required' });
        }

        const scheduling = await resolveSchedulingContext(context.companyId, {
          ...toolInput,
          professionalId,
          serviceId,
          durationMinutes: getAppointmentDurationMinutes(appointment),
        }, context.professionalId);
        const nextNotes = asString(toolInput.notes) ?? appointment.notes;
        const nextTitle = scheduling.service ? `${appointment.client_name} - ${scheduling.service.name}` : appointment.title;

        const availability = await checkSlot(
          startsAt,
          scheduling.durationMinutes,
          scheduling.calendarId,
          scheduling.professional.id
        );
        if (!availability.available) {
          return JSON.stringify({ success: false, error: 'Slot not available', suggestions: availability.suggestions ?? [] });
        }

        if (appointment.google_event_id) {
          const updated = await updateEvent(
            appointment.google_event_id,
            startsAt,
            scheduling.durationMinutes,
            scheduling.calendarId,
            scheduling.professional.id,
            nextTitle,
            nextNotes
          );
          if (!updated.success) {
            return JSON.stringify(updated);
          }
        }

        const endsAt = new Date(new Date(startsAt).getTime() + scheduling.durationMinutes * 60 * 1000).toISOString();
        await pool.query(
          `UPDATE appointments
           SET professional_id = $1,
               service_id = $2,
               starts_at = $3,
               ends_at = $4,
               title = $5,
               notes = $6,
               status = 'rescheduled',
               updated_at = NOW()
           WHERE id = $7 AND company_id = $8`,
          [
            scheduling.professional.id,
            scheduling.service?.id ?? null,
            startsAt,
            endsAt,
            nextTitle,
            nextNotes,
            appointment.id,
            context.companyId,
          ]
        );

        return JSON.stringify({ success: true, appointmentId: appointment.id });
      }

      case 'google_calendar_cancel': {
        if (context.companyId && !context.professionalId) {
          return JSON.stringify({
            error: 'No hay profesional asignado a esta conversación. No se pueden gestionar turnos automáticamente. Contactar al administrador para asignar un profesional.',
          });
        }

        const eventId = asString(toolInput.eventId) ?? asString(toolInput.event_id);

        if (!context.companyId) {
          if (!eventId) return JSON.stringify({ error: 'eventId is required' });
          const result = await deleteEvent(eventId);
          return JSON.stringify(result);
        }

        const appointment = await resolveAppointmentByReference(context.companyId, toolInput);
        if (!appointment) {
          return JSON.stringify({ error: 'Appointment not found' });
        }

        if (appointment.google_event_id && appointment.professional_id) {
          const professional = await getProfessional(context.companyId, appointment.professional_id);
          if (!professional) {
            return JSON.stringify({ error: 'Professional not found' });
          }
          const result = await deleteEvent(appointment.google_event_id, professional.calendar_id, professional.id);
          if (!result.success) {
            return JSON.stringify(result);
          }
        } else if (eventId) {
          const result = await deleteEvent(eventId);
          if (!result.success) {
            return JSON.stringify(result);
          }
        }

        await pool.query(
          `UPDATE appointments
           SET status = 'cancelled', updated_at = NOW()
           WHERE id = $1 AND company_id = $2`,
          [appointment.id, context.companyId]
        );

        return JSON.stringify({ success: true, appointmentId: appointment.id });
      }

      case 'webhook': {
        const url = toolInput.url as string;
        await validateWebhookUrl(url);

        // Sanitize payload: strip conversation/prompt data to prevent exfiltration
        const rawPayload = (toolInput.payload || toolInput) as Record<string, unknown>;
        const SENSITIVE_KEYS = new Set(['messages', 'conversation', 'history', 'system_prompt', 'prompt']);
        const sanitizedPayload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(rawPayload)) {
          if (!SENSITIVE_KEYS.has(key)) {
            sanitizedPayload[key] = value;
          }
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sanitizedPayload),
          signal: AbortSignal.timeout(10_000),
        });

        const contentType = response.headers.get('content-type') || '';

        // Don't return HTML bodies (likely error pages or non-API responses)
        if (contentType.includes('text/html')) {
          return JSON.stringify({ status: response.status, message: 'HTML response' });
        }

        // Truncate response to prevent excessive token usage
        const text = await response.text();
        return text.length > 4096 ? text.slice(0, 4096) : text;
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err) {
    logger.error(`Tool execution error (${toolName}):`, err);
    return JSON.stringify({
      error: `Tool execution failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    });
  }
}
