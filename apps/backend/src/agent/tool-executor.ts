import { pool } from '../db/pool';
import { bookSlot, checkSlot, deleteEvent, updateEvent } from '../calendar/operations';
import { validateWebhookUrl } from '../utils/url-validator';
import { logger } from '../utils/logger';
import { EvolutionClient } from '../evolution/client';
import type { Appointment, Client, Professional, Service } from '@talora/shared';

type ToolExecutionContext = {
  companyId?: string;
  conversationId?: string;
  phoneNumber?: string;
  contactName?: string | null;
  professionalId?: string | null;
};

type ServiceOption = {
  name: string;
  durationMinutes: number;
  description: string;
};

type SchedulingIssue = {
  error: string;
  needsServiceSelection?: boolean;
  serviceOptions?: ServiceOption[];
  requestedService?: string | null;
  needsProfessionalSelection?: boolean;
  professionalOptions?: string[];
  requestedProfessional?: string | null;
};

type ServiceResolution =
  | { kind: 'resolved'; service: Service }
  | { kind: 'missing'; issue: SchedulingIssue }
  | { kind: 'ambiguous'; issue: SchedulingIssue };

type ProfessionalResolution =
  | { kind: 'resolved'; professional: Professional }
  | { kind: 'missing'; issue: SchedulingIssue }
  | { kind: 'ambiguous'; issue: SchedulingIssue }
  | { kind: 'none' };

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

function hasSchedulingHints(toolInput: Record<string, unknown>): boolean {
  return Boolean(
    asString(toolInput.professionalId) ??
      asString(toolInput.professional_id) ??
      asString(toolInput.serviceId) ??
      asString(toolInput.service_id) ??
      asString(toolInput.calendarId) ??
      asString(toolInput.calendar_id)
  );
}

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenize(value: string): string[] {
  return normalizeLabel(value).split(' ').filter(Boolean);
}

function normalizePhone(value: string | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getAppointmentDurationMinutes(appointment: Appointment): number {
  return Math.max(
    15,
    Math.round((new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000)
  );
}

async function getProfessional(companyId: string, professionalId: string): Promise<Professional | null> {
  if (!isUuid(professionalId)) {
    return null;
  }
  const result = await pool.query<Professional>(
    'SELECT * FROM professionals WHERE id = $1 AND company_id = $2 AND is_active = true LIMIT 1',
    [professionalId, companyId]
  );
  return result.rows[0] ?? null;
}

async function listActiveProfessionals(companyId: string): Promise<Professional[]> {
  const result = await pool.query<Professional>(
    `SELECT *
     FROM professionals
     WHERE company_id = $1
       AND is_active = true
     ORDER BY name ASC`,
    [companyId]
  );
  return result.rows;
}

async function getService(companyId: string, serviceId: string): Promise<Service | null> {
  const result = await pool.query<Service>(
    `SELECT id, company_id, professional_id, name,
            COALESCE(aliases, ARRAY[]::text[]) AS aliases,
            duration_minutes, price, description, is_active, created_at, updated_at
     FROM services
     WHERE id = $1 AND company_id = $2 AND is_active = true
     LIMIT 1`,
    [serviceId, companyId]
  );
  return result.rows[0] ?? null;
}

async function listScopedServices(companyId: string, professionalId?: string | null): Promise<Service[]> {
  const result = await pool.query<Service>(
    `SELECT id, company_id, professional_id, name,
            COALESCE(aliases, ARRAY[]::text[]) AS aliases,
            duration_minutes, price, description, is_active, created_at, updated_at
     FROM services
     WHERE company_id = $1
       AND is_active = true
       AND ($2::uuid IS NULL OR professional_id IS NULL OR professional_id = $2)
     ORDER BY name ASC`,
    [companyId, professionalId ?? null]
  );
  return result.rows;
}

function toServiceOption(service: Service): ServiceOption {
  return {
    name: service.name,
    durationMinutes: service.duration_minutes,
    description: service.description,
  };
}

function scoreServiceMatch(query: string, service: Service): number {
  const normalizedQuery = normalizeLabel(query);
  if (!normalizedQuery) return 0;

  const queryTokens = tokenize(normalizedQuery);
  const variants = [service.name, ...(service.aliases ?? [])]
    .map((variant) => normalizeLabel(variant))
    .filter(Boolean);

  let bestScore = 0;
  for (const variant of variants) {
    if (variant === normalizedQuery) {
      bestScore = Math.max(bestScore, 400);
      continue;
    }

    const variantTokens = tokenize(variant);
    const overlap = queryTokens.filter((token) => variantTokens.includes(token)).length;
    const allQueryTokensPresent = queryTokens.length > 0 && queryTokens.every((token) => variantTokens.includes(token));
    const allVariantTokensPresent = variantTokens.length > 0 && variantTokens.every((token) => queryTokens.includes(token));

    if (allQueryTokensPresent && allVariantTokensPresent) {
      bestScore = Math.max(bestScore, 320);
      continue;
    }

    if (variant.startsWith(normalizedQuery) || variant.includes(` ${normalizedQuery}`)) {
      bestScore = Math.max(bestScore, 260);
      continue;
    }

    if (allQueryTokensPresent) {
      bestScore = Math.max(bestScore, 220 + overlap);
      continue;
    }

    if (overlap > 0) {
      bestScore = Math.max(bestScore, 80 + overlap * 10);
    }
  }

  return bestScore;
}

async function resolveServiceSelection(
  companyId: string,
  toolInput: Record<string, unknown>,
  professionalId?: string | null
): Promise<ServiceResolution> {
  const serviceId =
    asString(toolInput.serviceId) ??
    asString(toolInput.service_id) ??
    null;
  if (serviceId) {
    const service = await getService(companyId, serviceId);
    if (service && (!professionalId || !service.professional_id || service.professional_id === professionalId)) {
      return { kind: 'resolved', service };
    }
  }

  const serviceQuery =
    asString(toolInput.serviceName) ??
    asString(toolInput.service_name) ??
    asString(toolInput.serviceHint) ??
    asString(toolInput.service_hint) ??
    asString(toolInput.service) ??
    null;

  const scopedServices = await listScopedServices(companyId, professionalId);
  if (scopedServices.length === 0) {
    return {
      kind: 'missing',
      issue: {
        error: 'No hay servicios activos cargados para este profesional.',
        needsServiceSelection: true,
        serviceOptions: [],
        requestedService: serviceQuery,
      },
    };
  }

  if (!serviceQuery) {
    if (scopedServices.length === 1) {
      return { kind: 'resolved', service: scopedServices[0] };
    }

    return {
      kind: 'missing',
      issue: {
        error: 'Necesito saber que servicio quiere reservar el cliente.',
        needsServiceSelection: true,
        serviceOptions: scopedServices.slice(0, 4).map(toServiceOption),
        requestedService: null,
      },
    };
  }

  const matches = scopedServices
    .map((service) => ({ service, score: scoreServiceMatch(serviceQuery, service) }))
    .filter((candidate) => candidate.score >= 180)
    .sort((left, right) => right.score - left.score || left.service.name.localeCompare(right.service.name));

  if (matches.length === 0) {
    return {
      kind: 'missing',
      issue: {
        error: `No encontre un servicio que coincida con "${serviceQuery}".`,
        needsServiceSelection: true,
        serviceOptions: scopedServices.slice(0, 4).map(toServiceOption),
        requestedService: serviceQuery,
      },
    };
  }

  const topScore = matches[0].score;
  const topMatches = matches.filter((candidate) => candidate.score === topScore);
  if (topMatches.length > 1) {
    return {
      kind: 'ambiguous',
      issue: {
        error: `Hay varios servicios posibles para "${serviceQuery}".`,
        needsServiceSelection: true,
        serviceOptions: topMatches.slice(0, 4).map((candidate) => toServiceOption(candidate.service)),
        requestedService: serviceQuery,
      },
    };
  }

  return { kind: 'resolved', service: matches[0].service };
}

function scoreProfessionalMatch(query: string, professional: Professional): number {
  const normalizedQuery = normalizeLabel(query);
  if (!normalizedQuery) return 0;

  const normalizedName = normalizeLabel(professional.name);
  if (!normalizedName) return 0;
  if (normalizedName === normalizedQuery) return 400;

  const queryTokens = tokenize(normalizedQuery);
  const nameTokens = tokenize(normalizedName);
  const overlap = queryTokens.filter((token) => nameTokens.includes(token)).length;
  const allQueryTokensPresent = queryTokens.length > 0 && queryTokens.every((token) => nameTokens.includes(token));
  const allNameTokensPresent = nameTokens.length > 0 && nameTokens.every((token) => queryTokens.includes(token));

  if (allQueryTokensPresent && allNameTokensPresent) return 320;
  if (normalizedName.startsWith(normalizedQuery) || normalizedName.includes(` ${normalizedQuery}`)) return 260;
  if (allQueryTokensPresent) return 220 + overlap;
  if (overlap > 0) return 80 + overlap * 10;
  return 0;
}

async function resolveProfessionalSelection(
  companyId: string,
  toolInput: Record<string, unknown>,
  contextProfessionalId?: string | null
): Promise<ProfessionalResolution> {
  if (contextProfessionalId) {
    const professional = await getProfessional(companyId, contextProfessionalId);
    if (professional) {
      return { kind: 'resolved', professional };
    }
  }

  const inputProfessionalId =
    asString(toolInput.professionalId) ??
    asString(toolInput.professional_id) ??
    null;
  const professionalName =
    asString(toolInput.professionalName) ??
    asString(toolInput.professional_name) ??
    asString(toolInput.professionalHint) ??
    asString(toolInput.professional_hint) ??
    null;

  if (inputProfessionalId && isUuid(inputProfessionalId)) {
    const professional = await getProfessional(companyId, inputProfessionalId);
    if (professional) {
      return { kind: 'resolved', professional };
    }
  }

  const professionalQuery = professionalName ?? (inputProfessionalId && !isUuid(inputProfessionalId) ? inputProfessionalId : null);
  if (!professionalQuery) {
    return { kind: 'none' };
  }

  const professionals = await listActiveProfessionals(companyId);
  if (professionals.length === 0) {
    return {
      kind: 'missing',
      issue: {
        error: 'No hay profesionales activos disponibles en este momento.',
        needsProfessionalSelection: true,
        professionalOptions: [],
        requestedProfessional: professionalQuery,
      },
    };
  }

  const matches = professionals
    .map((professional) => ({ professional, score: scoreProfessionalMatch(professionalQuery, professional) }))
    .filter((candidate) => candidate.score >= 180)
    .sort((left, right) => right.score - left.score || left.professional.name.localeCompare(right.professional.name));

  if (matches.length === 0) {
    return {
      kind: 'missing',
      issue: {
        error: `No encontre un profesional que coincida con "${professionalQuery}".`,
        needsProfessionalSelection: true,
        professionalOptions: professionals.slice(0, 4).map((professional) => professional.name),
        requestedProfessional: professionalQuery,
      },
    };
  }

  const topScore = matches[0].score;
  const topMatches = matches.filter((candidate) => candidate.score === topScore);
  if (topMatches.length > 1) {
    return {
      kind: 'ambiguous',
      issue: {
        error: `Hay varios profesionales posibles para "${professionalQuery}".`,
        needsProfessionalSelection: true,
        professionalOptions: topMatches.slice(0, 4).map((candidate) => candidate.professional.name),
        requestedProfessional: professionalQuery,
      },
    };
  }

  return { kind: 'resolved', professional: matches[0].professional };
}

async function resolveSchedulingContext(
  companyId: string,
  toolInput: Record<string, unknown>,
  contextProfessionalId?: string | null,
  conversationId?: string | null,
): Promise<{ professional: Professional; service: Service | null; durationMinutes: number; calendarId: string; issue?: SchedulingIssue }> {
  const calendarIdOverride =
    asString(toolInput.calendarId) ??
    asString(toolInput.calendar_id) ??
    null;

  const professionalResolution = await resolveProfessionalSelection(companyId, toolInput, contextProfessionalId);
  if (professionalResolution.kind === 'missing' || professionalResolution.kind === 'ambiguous') {
    return {
      professional: null as never,
      service: null,
      durationMinutes: 0,
      calendarId: '',
      issue: professionalResolution.issue,
    };
  }

  const resolvedProfessional = professionalResolution.kind === 'resolved' ? professionalResolution.professional : null;

  const serviceResolution = await resolveServiceSelection(companyId, toolInput, resolvedProfessional?.id ?? null);
  if (serviceResolution.kind !== 'resolved') {
    return {
      professional: null as never,
      service: null,
      durationMinutes: 0,
      calendarId: '',
      issue: serviceResolution.issue,
    };
  }

  const service = serviceResolution.service;
  let professional: Professional | null = resolvedProfessional;
  if (!professional && service?.professional_id) {
    professional = await getProfessional(companyId, service.professional_id);
  }

  if (!professional) {
    throw new Error('No se pudo determinar el profesional para esta operación. La conversación no tiene un profesional asignado.');
  }

  // Bind professional to conversation on first resolution
  if (!contextProfessionalId && conversationId && professional) {
    try {
      await pool.query(
        `UPDATE conversations SET professional_id = $1, updated_at = NOW()
         WHERE id = $2 AND professional_id IS NULL AND NOT professional_binding_suppressed`,
        [professional.id, conversationId]
      );
    } catch (err) {
      logger.error('Failed to bind professional to conversation:', err);
    }
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
  toolInput: Record<string, unknown>,
  professionalId: string | null = null
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
    const values: unknown[] = [appointmentId, companyId];
    let query = 'SELECT * FROM appointments WHERE id = $1 AND company_id = $2';
    if (professionalId) {
      values.push(professionalId);
      query += ' AND professional_id = $3';
    }
    query += ' LIMIT 1';
    const result = await pool.query<Appointment>(query, values);
    return result.rows[0] ?? null;
  }

  if (eventId) {
    const values: unknown[] = [eventId, companyId];
    let query = 'SELECT * FROM appointments WHERE google_event_id = $1 AND company_id = $2';
    if (professionalId) {
      values.push(professionalId);
      query += ' AND professional_id = $3';
    }
    query += ' ORDER BY created_at DESC LIMIT 1';
    const result = await pool.query<Appointment>(query, values);
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

        const scheduling = await resolveSchedulingContext(context.companyId, toolInput, context.professionalId, context.conversationId);
        if (scheduling.issue) {
          return JSON.stringify(scheduling.issue);
        }
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

        const scheduling = await resolveSchedulingContext(context.companyId, toolInput, context.professionalId, context.conversationId);
        if (scheduling.issue) {
          return JSON.stringify(scheduling.issue);
        }
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

        const appointment = await resolveAppointmentByReference(context.companyId, toolInput, context.professionalId);
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
        }, context.professionalId, context.conversationId);
        if (scheduling.issue) {
          return JSON.stringify(scheduling.issue);
        }
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

        const appointment = await resolveAppointmentByReference(context.companyId, toolInput, context.professionalId);
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

      case 'escalate': {
        const reason = asString(toolInput.reason) ?? 'Sin razón especificada';
        if (!context.companyId) {
          return JSON.stringify({ error: 'No company context' });
        }

        const companyRow = await pool.query<{ escalation_number: string | null; name: string }>(
          'SELECT escalation_number, name FROM companies WHERE id = $1',
          [context.companyId]
        );
        const escalationNumber = companyRow.rows[0]?.escalation_number;
        if (!escalationNumber) {
          return JSON.stringify({ error: 'No hay número de escalación configurado para esta empresa.' });
        }

        const instanceRow = await pool.query<{ evolution_instance_name: string }>(
          `SELECT evolution_instance_name FROM whatsapp_instances WHERE company_id = $1 AND status = 'connected' LIMIT 1`,
          [context.companyId]
        );
        if (!instanceRow.rows[0]) {
          return JSON.stringify({ error: 'No hay instancia de WhatsApp conectada.' });
        }

        const clientInfo = context.contactName
          ? `${context.contactName} (${context.phoneNumber})`
          : context.phoneNumber ?? 'desconocido';
        const escalationMessage = `⚠️ *Escalación — ${companyRow.rows[0].name}*\n\nCliente: ${clientInfo}\nMotivo: ${reason}`;

        const evolution = new EvolutionClient();
        await evolution.sendText(instanceRow.rows[0].evolution_instance_name, escalationNumber, escalationMessage);

        return JSON.stringify({ success: true, message: 'Escalación enviada al equipo.' });
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
      error: `La herramienta "${toolName}" no pudo completar la operación. Intenta de nuevo o sugiere una alternativa al usuario.`,
    });
  }
}
