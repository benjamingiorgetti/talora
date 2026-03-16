import { Router } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { authMiddleware, getRequestCompanyId, getRequestProfessionalId, requireCompanyScope } from './middleware';
import { bookSlot, checkSlot, createEvent, deleteEvent, updateEvent } from '../calendar/operations';
import { validateBody, createAppointmentSchema, reprogramAppointmentSchema } from './validation';
import type { Appointment, AppointmentWsPayload, Client, Professional, Service, WsEvent } from '@talora/shared';
import { broadcast } from '../ws/server';
import { appEvents, type AppointmentCancelledEvent } from '../events';

export const appointmentsRouter = Router();

function buildAppointmentWsPayload(
  appointment: Appointment,
  professionalName?: string | null,
  serviceName?: string | null
): AppointmentWsPayload {
  return {
    id: appointment.id,
    company_id: appointment.company_id,
    professional_id: appointment.professional_id,
    client_name: appointment.client_name,
    starts_at: appointment.starts_at,
    professional_name: professionalName ?? null,
    service_name: serviceName ?? null,
  };
}

appointmentsRouter.use(authMiddleware, requireCompanyScope);

type AppointmentSource = Appointment['source'];

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

async function getProfessional(companyId: string, professionalId: string): Promise<Professional | null> {
  const result = await pool.query<Professional>(
    'SELECT * FROM professionals WHERE id = $1 AND company_id = $2 LIMIT 1',
    [professionalId, companyId]
  );
  return result.rows[0] ?? null;
}

async function getService(companyId: string, serviceId: string | null): Promise<Service | null> {
  if (!serviceId) return null;
  const result = await pool.query<Service>(
    'SELECT * FROM services WHERE id = $1 AND company_id = $2 LIMIT 1',
    [serviceId, companyId]
  );
  return result.rows[0] ?? null;
}

function parseSource(value: unknown): AppointmentSource {
  if (value === 'bot' || value === 'google_calendar') return value;
  return 'manual';
}

function getDurationMinutes(appointment: Appointment): number {
  return Math.max(
    15,
    Math.round((new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000)
  );
}

async function validateAssignment(companyId: string, professionalId: string, serviceId: string | null) {
  const professional = await getProfessional(companyId, professionalId);
  if (!professional) {
    return { error: 'Professional not found' as const };
  }

  const service = await getService(companyId, serviceId);
  if (service && service.professional_id && service.professional_id !== professional.id) {
    return { error: 'Service does not belong to the selected professional' as const };
  }

  return {
    professional,
    service,
  };
}

async function resolveScopedProfessionalId(
  req: Parameters<typeof authMiddleware>[0],
  companyId: string,
  requestedProfessionalId: string | null | undefined
): Promise<string | null> {
  const sessionProfessionalId = getRequestProfessionalId(req);

  if (req.user?.role === 'professional') {
    if (requestedProfessionalId && requestedProfessionalId !== sessionProfessionalId) {
      throw new Error('A professional can only operate their own appointments');
    }
    return sessionProfessionalId;
  }

  if (!requestedProfessionalId) {
    return null;
  }

  const professional = await getProfessional(companyId, requestedProfessionalId);
  if (!professional) {
    throw new Error('Professional not found');
  }

  return professional.id;
}

async function getPrimaryAgentId(companyId: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    'SELECT id FROM agents WHERE company_id = $1 ORDER BY created_at ASC LIMIT 1',
    [companyId]
  );
  return result.rows[0]?.id ?? null;
}

async function upsertClient(
  companyId: string,
  agentId: string,
  professionalId: string,
  phoneNumber: string,
  name: string
): Promise<Client | null> {
  if (!phoneNumber) return null;

  const normalizedPhone = normalizePhone(phoneNumber);
  const existing = await pool.query<Client>(
    'SELECT * FROM clients WHERE company_id = $1 AND phone_number = $2 LIMIT 1',
    [companyId, normalizedPhone]
  );

  if (existing.rows[0]) {
    const client = existing.rows[0];
    if (client.professional_id && client.professional_id !== professionalId) {
      throw new Error('This client already belongs to another professional');
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
    [companyId, agentId, professionalId, normalizedPhone, name || 'Cliente']
  );
  return result.rows[0] ?? null;
}

async function loadAppointmentWithScope(companyId: string, appointmentId: string, professionalId: string | null): Promise<Appointment | null> {
  const params: unknown[] = [appointmentId, companyId];
  let query = 'SELECT * FROM appointments WHERE id = $1 AND company_id = $2';

  if (professionalId) {
    params.push(professionalId);
    query += ` AND professional_id = $${params.length}`;
  }

  query += ' LIMIT 1';
  const result = await pool.query<Appointment>(query, params);
  return result.rows[0] ?? null;
}

async function reprogramAppointment(
  req: Parameters<typeof authMiddleware>[0],
  companyId: string,
  appointmentId: string,
  startsAt: string,
  options?: {
    professionalId?: string | null;
    serviceId?: string | null;
    notes?: string | null;
  }
) {
  const scopedProfessionalId = getRequestProfessionalId(req);
  const appointment = await loadAppointmentWithScope(companyId, appointmentId, scopedProfessionalId);
  if (!appointment) {
    return { status: 404 as const, body: { error: 'Appointment not found' } };
  }

  const professionalId = await resolveScopedProfessionalId(req, companyId, options?.professionalId ?? appointment.professional_id);
  if (!professionalId) {
    return { status: 400 as const, body: { error: 'Appointment has no professional assigned' } };
  }

  const assignment = await validateAssignment(companyId, professionalId, options?.serviceId ?? appointment.service_id);
  if ('error' in assignment) {
    return {
      status: assignment.error === 'Professional not found' ? (404 as const) : (400 as const),
      body: { error: assignment.error },
    };
  }

  const { professional, service } = assignment;
  const durationMinutes = service?.duration_minutes ?? getDurationMinutes(appointment);
  const availability = await checkSlot(startsAt, durationMinutes, professional.calendar_id, professional.id);
  if (!availability.available) {
    return { status: 409 as const, body: { error: 'Slot not available', suggestions: availability.suggestions ?? [] } };
  }

  const title = service?.name ? `${appointment.client_name} - ${service.name}` : appointment.title;
  let newGoogleEventId: string | null = null;

  if (appointment.google_event_id) {
    const updateResult = await updateEvent(
      appointment.google_event_id,
      startsAt,
      durationMinutes,
      professional.calendar_id,
      professional.id,
      title,
      options?.notes ?? appointment.notes
    );
    if (!updateResult.success) {
      return { status: 502 as const, body: { error: updateResult.error ?? 'Failed to update calendar event' } };
    }
  } else {
    const creation = await createEvent(
      title,
      startsAt,
      durationMinutes,
      options?.notes ?? appointment.notes ?? '',
      professional.calendar_id,
      professional.id
    );
    if (!creation.success) {
      return { status: 502 as const, body: { error: 'Failed to create calendar event' } };
    }
    newGoogleEventId = creation.eventId ?? null;
  }

  const endsAt = new Date(new Date(startsAt).getTime() + durationMinutes * 60 * 1000).toISOString();
  const updated = await pool.query<Appointment>(
    `UPDATE appointments
     SET professional_id = $1,
         service_id = $2,
         starts_at = $3,
         ends_at = $4,
         title = $5,
         notes = $6,
         status = 'rescheduled',
         google_event_id = COALESCE($7, google_event_id),
         updated_at = NOW()
     WHERE id = $8 AND company_id = $9
     RETURNING *`,
    [
      professional.id,
      service?.id ?? null,
      startsAt,
      endsAt,
      title,
      options?.notes ?? appointment.notes,
      newGoogleEventId,
      appointmentId,
      companyId,
    ]
  );

  const rescheduled = updated.rows[0];
  if (rescheduled) {
    broadcast({
      type: 'appointment:rescheduled',
      payload: buildAppointmentWsPayload(rescheduled, professional.name, service?.name),
    });
  }

  return { status: 200 as const, body: { data: rescheduled } };
}

async function cancelAppointment(req: Parameters<typeof authMiddleware>[0], companyId: string, appointmentId: string) {
  const professionalId = getRequestProfessionalId(req);
  const appointment = await loadAppointmentWithScope(companyId, appointmentId, professionalId);
  if (!appointment) {
    return { status: 404 as const, body: { error: 'Appointment not found' } };
  }

  const professional = appointment.professional_id
    ? await getProfessional(companyId, appointment.professional_id)
    : null;

  if (appointment.google_event_id && professional) {
    const deletion = await deleteEvent(appointment.google_event_id, professional.calendar_id, professional.id);
    if (!deletion.success) {
      return { status: 502 as const, body: { error: deletion.error ?? 'Failed to delete calendar event' } };
    }
  }

  const updated = await pool.query<Appointment>(
    `UPDATE appointments
     SET status = 'cancelled', google_event_id = NULL, updated_at = NOW()
     WHERE id = $1 AND company_id = $2
     RETURNING *`,
    [appointmentId, companyId]
  );

  const cancelled = updated.rows[0];
  if (cancelled) {
    broadcast({
      type: 'appointment:cancelled',
      payload: buildAppointmentWsPayload(cancelled, professional?.name),
    });

    appEvents.emit('appointment:cancelled', {
      appointmentId: cancelled.id,
      companyId,
      serviceId: cancelled.service_id ?? null,
      professionalId: cancelled.professional_id ?? null,
      startsAt: cancelled.starts_at,
      cancelledClientId: cancelled.client_id ?? null,
    } satisfies AppointmentCancelledEvent);
  }

  return { status: 200 as const, body: { data: cancelled } };
}

appointmentsRouter.get('/', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;
  const dateFrom =
    typeof req.query.date_from === 'string' ? req.query.date_from
    : typeof req.query.from === 'string' ? req.query.from
    : null;
  const dateTo =
    typeof req.query.date_to === 'string' ? req.query.date_to
    : typeof req.query.to === 'string' ? req.query.to
    : null;

  try {
    const scopedProfessionalId = await resolveScopedProfessionalId(
      req,
      companyId,
      typeof req.query.professional_id === 'string' ? req.query.professional_id : null
    );

    const params: unknown[] = [companyId];
    let query = `
      SELECT a.*,
             p.name AS professional_name,
             s.name AS service_name
      FROM appointments a
      LEFT JOIN professionals p ON p.id = a.professional_id
      LEFT JOIN services s ON s.id = a.service_id
      WHERE a.company_id = $1
    `;

    if (scopedProfessionalId) {
      params.push(scopedProfessionalId);
      query += ` AND a.professional_id = $${params.length}`;
    }

    if (dateFrom) {
      params.push(dateFrom);
      query += ` AND a.starts_at >= $${params.length}`;
    }
    if (dateTo) {
      params.push(dateTo);
      query += ` AND a.starts_at <= $${params.length}`;
    }

    query += ' ORDER BY a.starts_at ASC';
    const result = await pool.query<Appointment & { professional_name?: string | null; service_name?: string | null }>(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing appointments:', err);
    res.status(500).json({ error: 'Failed to list appointments' });
  }
});

appointmentsRouter.get('/availability', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;
  const startsAt = typeof req.query.starts_at === 'string' ? req.query.starts_at : '';
  const serviceId = typeof req.query.service_id === 'string' ? req.query.service_id : null;
  const durationQuery = typeof req.query.duration_minutes === 'string' ? Number(req.query.duration_minutes) : null;

  if (!startsAt) {
    res.status(400).json({ error: 'starts_at is required' });
    return;
  }

  try {
    const professionalId = await resolveScopedProfessionalId(
      req,
      companyId,
      typeof req.query.professional_id === 'string' ? req.query.professional_id : null
    );
    if (!professionalId) {
      res.status(400).json({ error: 'professional_id is required' });
      return;
    }

    const professional = await getProfessional(companyId, professionalId);
    if (!professional) {
      res.status(404).json({ error: 'Professional not found' });
      return;
    }

    const service = await getService(companyId, serviceId);
    const durationMinutes = durationQuery || service?.duration_minutes || 60;
    const availability = await checkSlot(startsAt, durationMinutes, professional.calendar_id, professional.id);
    res.json({ data: availability });
  } catch (err) {
    logger.error('Error checking appointment availability:', err);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

appointmentsRouter.post('/', validateBody(createAppointmentSchema), async (req, res) => {
  const companyId = getRequestCompanyId(req)!;
  const {
    professional_id,
    service_id,
    starts_at,
    client_name,
    phone_number,
    notes,
    conversation_id,
    source,
  } = req.body;

  try {
    const scopedProfessionalId = await resolveScopedProfessionalId(req, companyId, professional_id ?? null);
    if (!scopedProfessionalId) {
      res.status(400).json({ error: 'professional_id is required' });
      return;
    }

    const assignment = await validateAssignment(companyId, scopedProfessionalId, service_id ?? null);
    if ('error' in assignment) {
      res.status(assignment.error === 'Professional not found' ? 404 : 400).json({ error: assignment.error });
      return;
    }

    const { professional, service } = assignment;
    const durationMinutes = service?.duration_minutes ?? 60;
    const title = service?.name ? `${client_name} - ${service.name}` : client_name;
    const description = [service?.description, notes, phone_number ? `Telefono: ${phone_number}` : ''].filter(Boolean).join('\n\n');

    const booking = await bookSlot(title, starts_at, durationMinutes, description, professional.calendar_id, professional.id);
    if (!booking.success) {
      res.status(409).json({ error: booking.error ?? 'Slot not available', suggestions: booking.suggestions ?? [] });
      return;
    }

    const agentId = await getPrimaryAgentId(companyId);
    if (!agentId) {
      res.status(500).json({ error: 'Company agent not configured' });
      return;
    }

    const client = await upsertClient(companyId, agentId, professional.id, phone_number, client_name);
    const end = new Date(new Date(starts_at).getTime() + durationMinutes * 60 * 1000).toISOString();
    const result = await pool.query<Appointment>(
      `INSERT INTO appointments (
        company_id, client_id, professional_id, service_id, conversation_id, phone_number, client_name,
        google_event_id, starts_at, ends_at, status, source, title, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed', $11, $12, $13)
      RETURNING *`,
      [
        companyId,
        client?.id ?? null,
        professional.id,
        service?.id ?? null,
        conversation_id,
        normalizePhone(phone_number),
        client_name,
        booking.eventId ?? null,
        starts_at,
        end,
        parseSource(source),
        title,
        notes,
      ]
    );

    const created = result.rows[0];
    res.status(201).json({ data: created });

    if (created) {
      broadcast({
        type: 'appointment:created',
        payload: buildAppointmentWsPayload(created, professional.name, service?.name),
      });
      appEvents.emit('appointment:created', {
        appointmentId: created.id,
        clientId: created.client_id,
        companyId: created.company_id,
        serviceId: created.service_id,
        professionalId: created.professional_id,
      });
    }
  } catch (err) {
    logger.error('Error creating appointment:', err);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

appointmentsRouter.post('/:id/reprogram', validateBody(reprogramAppointmentSchema), async (req, res) => {
  const companyId = getRequestCompanyId(req)!;
  const appointmentId = req.params.id as string;
  const { starts_at, professional_id, service_id, notes } = req.body;

  try {
    const response = await reprogramAppointment(req, companyId, appointmentId, starts_at, {
      professionalId: professional_id ?? null,
      serviceId: service_id ?? null,
      notes: notes ?? null,
    });
    res.status(response.status).json(response.body);
  } catch (err) {
    logger.error('Error reprogramming appointment:', err);
    res.status(500).json({ error: 'Failed to reprogram appointment' });
  }
});

appointmentsRouter.put('/:id', validateBody(reprogramAppointmentSchema), async (req, res) => {
  const companyId = getRequestCompanyId(req)!;
  const appointmentId = req.params.id as string;
  const { starts_at, professional_id, service_id, notes } = req.body;

  try {
    const response = await reprogramAppointment(req, companyId, appointmentId, starts_at, {
      professionalId: professional_id ?? null,
      serviceId: service_id ?? null,
      notes: notes ?? null,
    });
    res.status(response.status).json(response.body);
  } catch (err) {
    logger.error('Error reprogramming appointment:', err);
    res.status(500).json({ error: 'Failed to reprogram appointment' });
  }
});

appointmentsRouter.post('/:id/confirm', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;
  const appointmentId = req.params.id as string;

  try {
    const professionalId = getRequestProfessionalId(req);
    const appointment = await loadAppointmentWithScope(companyId, appointmentId, professionalId);
    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    if (appointment.status !== 'draft') {
      res.status(400).json({ error: 'Solo se pueden confirmar turnos en estado borrador' });
      return;
    }

    const updated = await pool.query<Appointment>(
      `UPDATE appointments
       SET status = 'confirmed', updated_at = NOW()
       WHERE id = $1 AND company_id = $2 AND status = 'draft'
       RETURNING *`,
      [appointmentId, companyId]
    );

    const confirmed = updated.rows[0];
    if (!confirmed) {
      res.status(409).json({ error: 'El turno ya fue modificado por otra operación' });
      return;
    }

    const professional = confirmed.professional_id
      ? await getProfessional(companyId, confirmed.professional_id)
      : null;
    const service = await getService(companyId, confirmed.service_id);

    broadcast({
      type: 'appointment:confirmed',
      payload: buildAppointmentWsPayload(confirmed, professional?.name, service?.name),
    });

    res.json({ data: confirmed });
  } catch (err) {
    logger.error('Error confirming appointment:', err);
    res.status(500).json({ error: 'Failed to confirm appointment' });
  }
});

appointmentsRouter.post('/:id/cancel', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;
  try {
    const response = await cancelAppointment(req, companyId, req.params.id);
    res.status(response.status).json(response.body);
  } catch (err) {
    logger.error('Error cancelling appointment:', err);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

appointmentsRouter.delete('/:id', async (req, res) => {
  const companyId = getRequestCompanyId(req)!;
  try {
    const response = await cancelAppointment(req, companyId, req.params.id);
    res.status(response.status).json(response.body);
  } catch (err) {
    logger.error('Error cancelling appointment:', err);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});
