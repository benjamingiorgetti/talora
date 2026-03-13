import { Router } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { authMiddleware, getRequestCompanyId, requireCompanyScope } from './middleware';
import { buildUpdateSet } from '../db/query-helpers';
import {
  validateBody,
  createServiceSchema,
  serviceImportApplySchema,
  serviceImportPreviewSchema,
  updateServiceSchema,
} from './validation';
import type { Service } from '@talora/shared';

export const servicesRouter = Router();

type ServiceRow = Service & {
  aliases?: string[];
};

type IncomingImportRow = {
  row_number: number;
  name?: string;
  price?: number | null;
  duration_minutes?: number | null;
};

type ServiceImportPreviewItem = {
  row_number: number;
  action: 'create' | 'update' | 'invalid';
  service_id: string | null;
  name: string;
  price: number | null;
  duration_minutes: number | null;
  error: string | null;
};

function normalizeImportName(value: string | undefined) {
  return (value ?? '').trim();
}

function buildImportItem(row: IncomingImportRow, existingByName: Map<string, { id: string }>): ServiceImportPreviewItem {
  const name = normalizeImportName(row.name);
  const price =
    typeof row.price === 'number' && Number.isInteger(row.price)
      ? row.price
      : null;
  const durationMinutes =
    typeof row.duration_minutes === 'number' && Number.isFinite(row.duration_minutes)
      ? Math.round(row.duration_minutes)
      : null;

  if (!name) {
    return {
      row_number: row.row_number,
      action: 'invalid',
      service_id: null,
      name,
      price,
      duration_minutes: durationMinutes,
      error: 'El nombre del servicio es obligatorio.',
    };
  }

  if (name.length > 200) {
    return {
      row_number: row.row_number,
      action: 'invalid',
      service_id: null,
      name,
      price,
      duration_minutes: durationMinutes,
      error: 'El nombre no puede superar 200 caracteres.',
    };
  }

  if (price === null || price < 0) {
    return {
      row_number: row.row_number,
      action: 'invalid',
      service_id: null,
      name,
      price,
      duration_minutes: durationMinutes,
      error: 'El precio debe ser un entero mayor o igual a 0.',
    };
  }

  if (durationMinutes === null || durationMinutes < 5 || durationMinutes > 480) {
    return {
      row_number: row.row_number,
      action: 'invalid',
      service_id: null,
      name,
      price,
      duration_minutes: durationMinutes,
      error: 'La duración debe estar entre 5 y 480 minutos.',
    };
  }

  const existing = existingByName.get(name);
  return {
    row_number: row.row_number,
    action: existing ? 'update' : 'create',
    service_id: existing?.id ?? null,
    name,
    price,
    duration_minutes: durationMinutes,
    error: null,
  };
}

function summarizeImport(items: ServiceImportPreviewItem[]) {
  return items.reduce(
    (summary, item) => {
      summary.total += 1;
      if (item.action === 'create') summary.create += 1;
      if (item.action === 'update') summary.update += 1;
      if (item.action === 'invalid') summary.invalid += 1;
      return summary;
    },
    { total: 0, create: 0, update: 0, invalid: 0 }
  );
}

servicesRouter.use(authMiddleware, requireCompanyScope);

servicesRouter.get('/', async (req, res) => {
  try {
    const result = await pool.query<ServiceRow>(
      `SELECT id, company_id, professional_id, name,
              COALESCE(aliases, ARRAY[]::text[]) AS aliases,
              duration_minutes, price, description, is_active, created_at, updated_at
       FROM services
       WHERE company_id = $1
       ORDER BY name ASC`,
      [getRequestCompanyId(req)]
    );
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing services:', err);
    res.status(500).json({ error: 'Failed to list services' });
  }
});

servicesRouter.post('/import/preview', validateBody(serviceImportPreviewSchema), async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req)!;
    const existingServices = await pool.query<{ id: string; name: string }>(
      'SELECT id, name FROM services WHERE company_id = $1',
      [companyId]
    );
    const existingByName = new Map(
      existingServices.rows.map((service) => [service.name.trim(), { id: service.id }])
    );

    const items = req.body.rows.map((row: IncomingImportRow) => buildImportItem(row, existingByName));
    res.json({
      data: {
        summary: summarizeImport(items),
        items,
      },
    });
  } catch (err) {
    logger.error('Error previewing service import:', err);
    res.status(500).json({ error: 'Failed to preview service import' });
  }
});

servicesRouter.post('/import/apply', validateBody(serviceImportApplySchema), async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req)!;
    const existingServices = await pool.query<{ id: string; name: string }>(
      'SELECT id, name FROM services WHERE company_id = $1',
      [companyId]
    );
    const existingByName = new Map(
      existingServices.rows.map((service) => [service.name.trim(), { id: service.id }])
    );

    let created = 0;
    let updated = 0;

    for (const rawItem of req.body.items as IncomingImportRow[]) {
      const item = buildImportItem(rawItem, existingByName);
      if (item.action === 'invalid') continue;

      const currentMatch = existingByName.get(item.name);
      const targetId = item.service_id ?? currentMatch?.id ?? null;

      if (targetId) {
        const updateResult = await pool.query(
          `UPDATE services
           SET name = $1,
               duration_minutes = $2,
               price = $3,
               updated_at = NOW()
           WHERE id = $4 AND company_id = $5`,
          [item.name, item.duration_minutes, item.price, targetId, companyId]
        );
        if (updateResult.rowCount && updateResult.rowCount > 0) {
          existingByName.set(item.name, { id: targetId });
          updated += 1;
          continue;
        }
      }

      const insertResult = await pool.query<{ id: string }>(
        `INSERT INTO services (company_id, professional_id, name, aliases, duration_minutes, price, description, is_active)
         VALUES ($1, NULL, $2, ARRAY[]::text[], $3, $4, '', true)
         RETURNING id`,
        [companyId, item.name, item.duration_minutes, item.price]
      );
      existingByName.set(item.name, { id: insertResult.rows[0].id });
      created += 1;
    }

    res.json({ data: { created, updated } });
  } catch (err) {
    logger.error('Error applying service import:', err);
    res.status(500).json({ error: 'Failed to apply service import' });
  }
});

servicesRouter.post('/', validateBody(createServiceSchema), async (req, res) => {
  const { professional_id, name, aliases, duration_minutes, price, description, is_active } = req.body;

  try {
    const result = await pool.query<Service>(
      `INSERT INTO services (company_id, professional_id, name, aliases, duration_minutes, price, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [getRequestCompanyId(req), professional_id || null, name, aliases, duration_minutes, price, description, is_active]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error creating service:', err);
    res.status(500).json({ error: 'Failed to create service' });
  }
});

servicesRouter.put('/:id', validateBody(updateServiceSchema), async (req, res) => {
  const update = buildUpdateSet({
    professional_id: req.body.professional_id,
    name: req.body.name,
    aliases: req.body.aliases,
    duration_minutes: req.body.duration_minutes,
    price: req.body.price,
    description: req.body.description,
    is_active: req.body.is_active,
  });

  if (!update) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  update.setClause += ', updated_at = NOW()';
  update.values.push(getRequestCompanyId(req), req.params.id);

  try {
    const result = await pool.query<Service>(
      `UPDATE services
       SET ${update.setClause}
       WHERE ($${update.nextIndex}::uuid IS NULL OR company_id = $${update.nextIndex})
         AND id = $${update.nextIndex + 1}
       RETURNING *`,
      update.values
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }

    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error updating service:', err);
    res.status(500).json({ error: 'Failed to update service' });
  }
});

servicesRouter.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM services WHERE id = $1 AND ($2::uuid IS NULL OR company_id = $2) RETURNING id',
      [req.params.id, getRequestCompanyId(req)]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error('Error deleting service:', err);
    res.status(500).json({ error: 'Failed to delete service' });
  }
});
