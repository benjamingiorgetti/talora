import { Router } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { authMiddleware, getRequestCompanyId, requireCompanyScope } from './middleware';
import { buildUpdateSet } from '../db/query-helpers';
import { validateBody, createServiceSchema, updateServiceSchema } from './validation';
import type { Service } from '@talora/shared';

export const servicesRouter = Router();

servicesRouter.use(authMiddleware, requireCompanyScope);

servicesRouter.get('/', async (req, res) => {
  try {
    const result = await pool.query<Service>(
      'SELECT * FROM services WHERE company_id = $1 ORDER BY name ASC',
      [getRequestCompanyId(req)]
    );
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing services:', err);
    res.status(500).json({ error: 'Failed to list services' });
  }
});

servicesRouter.post('/', validateBody(createServiceSchema), async (req, res) => {
  const { professional_id, name, duration_minutes, price_label, description, is_active } = req.body;

  try {
    const result = await pool.query<Service>(
      `INSERT INTO services (company_id, professional_id, name, duration_minutes, price_label, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [getRequestCompanyId(req), professional_id || null, name, duration_minutes, price_label, description, is_active]
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
    duration_minutes: req.body.duration_minutes,
    price_label: req.body.price_label,
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
