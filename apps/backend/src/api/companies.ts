import { Router } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { authMiddleware, getRequestCompanyId, requireCompanyScope, requireSuperadmin } from './middleware';
import { validateBody, createCompanySchema } from './validation';
import type { Company, Professional, Service, User } from '@talora/shared';
import { getCompanyOverview, listCompanyOverviews } from '../companies/overview';
import { buildDefaultCoreTools } from '../agent/core-tool-registry';

export const companiesRouter = Router();

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildDefaultPrompt(companyName: string, industry: string): string {
  return [
    `Sos el asistente de WhatsApp de ${companyName}.`,
    `El negocio pertenece al rubro ${industry}.`,
    'Tu objetivo es ayudar con preguntas frecuentes y gestionar turnos.',
    'Podes consultar disponibilidad, reservar, reprogramar y cancelar turnos.',
    'Habla claro, amable y profesional.',
    'Si falta informacion, pedila de forma concreta.',
    'Nunca hables de IDs internos ni datos tecnicos del sistema.',
    'Si el servicio no esta claro, ofrece opciones humanas breves antes de avanzar.',
    'Si el cliente menciona un profesional por nombre, usa ese nombre humano en la tool y no un ID interno.',
    'Si sirve, podes apoyarte en el ultimo turno confirmado del cliente para sugerir repetirlo.',
    'Usa {{userName}} y {{phoneNumber}} cuando haya datos del cliente.',
    'Servicios disponibles: {{availableServices}}.',
    'Profesionales disponibles: {{availableProfessionals}}.',
    'Historial reciente del cliente: {{recentBookingsSummary}}.',
  ].join('\n');
}

companiesRouter.get('/', authMiddleware, requireSuperadmin, async (_req, res) => {
  try {
    const companies = await listCompanyOverviews();
    res.json({ data: companies });
  } catch (err) {
    logger.error('Error listing companies:', err);
    res.status(500).json({ error: 'Failed to list companies' });
  }
});

companiesRouter.get('/current', authMiddleware, requireCompanyScope, async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req)!;
    const company = await getCompanyOverview(companyId);
    if (!company) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }
    res.json({ data: company });
  } catch (err) {
    logger.error('Error loading current company:', err);
    res.status(500).json({ error: 'Failed to load company' });
  }
});

companiesRouter.post('/', authMiddleware, requireSuperadmin, validateBody(createCompanySchema), async (req, res) => {
  const {
    name,
    industry,
    whatsapp_number,
    admin_email,
    admin_password,
    admin_full_name,
    professionals,
    services,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const slugBase = slugify(name);
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

    const companyResult = await client.query<Company>(
      `INSERT INTO companies (name, slug, industry, whatsapp_number, calendar_connected)
       VALUES ($1, $2, $3, $4, false)
       RETURNING *`,
      [name, slug, industry, whatsapp_number || null]
    );
    const company = companyResult.rows[0];

    const passwordHash = await Bun.password.hash(admin_password, { algorithm: 'bcrypt', cost: 12 });
    const adminResult = await client.query<User>(
      `INSERT INTO users (company_id, email, full_name, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, 'admin_empresa', true)
       RETURNING id, company_id, email, full_name, role, is_active, created_at, updated_at`,
      [company.id, admin_email, admin_full_name, passwordHash]
    );

    const agentResult = await client.query(
      `INSERT INTO agents (company_id, name, model, system_prompt)
       VALUES ($1, $2, 'gpt-4o-mini', $3)
       RETURNING id`,
      [company.id, `${name} Assistant`, buildDefaultPrompt(name, industry)]
    );
    const agentId = agentResult.rows[0].id as string;

    const systemVariables = [
      ['userName', 'Cliente', 'Nombre del contacto'],
      ['phoneNumber', '', 'Numero de telefono del cliente'],
      ['availableServices', '', 'Servicios configurados para este negocio'],
      ['availableProfessionals', '', 'Profesionales configurados para este negocio'],
      ['contextoCliente', 'Cliente no registrado', 'Notas y contexto del cliente'],
      ['recentBookingsSummary', 'Sin turnos confirmados previos.', 'Ultimos turnos confirmados del cliente para sugerir repetir un servicio'],
    ];
    for (const [key, defaultValue, description] of systemVariables) {
      await client.query(
        `INSERT INTO variables (agent_id, key, default_value, description, category)
         VALUES ($1, $2, $3, $4, 'system')
         ON CONFLICT DO NOTHING`,
        [agentId, key, defaultValue, description]
      );
    }

    for (const tool of buildDefaultCoreTools(agentId)) {
      await client.query(
        `INSERT INTO tools (agent_id, name, description, parameters, implementation, source)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [agentId, tool.name, tool.description, JSON.stringify(tool.parameters), tool.implementation, tool.source]
      );
    }

    for (const professional of professionals as Array<Partial<Professional>>) {
      if (!professional?.name) continue;
      const professionalResult = await client.query<Professional>(
        `INSERT INTO professionals (company_id, name, specialty, calendar_id, color_hex, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING *`,
        [
          company.id,
          professional.name,
          professional.specialty || '',
          professional.calendar_id || 'primary',
          professional.color_hex || null,
        ]
      );
      const createdProfessional = professionalResult.rows[0];
      await client.query(
        `INSERT INTO google_calendar_connections (company_id, professional_id, calendar_id, is_active)
         VALUES ($1, $2, $3, true)`,
        [company.id, createdProfessional.id, createdProfessional.calendar_id]
      );
    }

    for (const service of services as Array<Partial<Service>>) {
      if (!service?.name) continue;
      await client.query(
        `INSERT INTO services (company_id, professional_id, name, aliases, duration_minutes, price, description, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [
          company.id,
          service.professional_id || null,
          service.name,
          service.aliases || [],
          service.duration_minutes || 60,
          service.price ?? 0,
          service.description || '',
        ]
      );
    }

    await client.query('COMMIT');
    const overview = await getCompanyOverview(company.id);
    res.status(201).json({
      data: {
        company: overview ?? company,
        admin: adminResult.rows[0],
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Error creating company:', err);
    res.status(500).json({ error: 'Failed to create company' });
  } finally {
    client.release();
  }
});
