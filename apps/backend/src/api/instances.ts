import { Router } from 'express';
import { pool } from '../db/pool';
import { EvolutionClient } from '../evolution/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { WhatsAppInstance } from '@bottoo/shared';

export const instancesRouter = Router();
const evolution = new EvolutionClient();

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// GET / — list all instances
instancesRouter.get('/', async (_req, res) => {
  try {
    const result = await pool.query<WhatsAppInstance>(
      'SELECT * FROM whatsapp_instances ORDER BY created_at DESC'
    );
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing instances:', err);
    res.status(500).json({ error: 'Failed to list instances' });
  }
});

// POST / — create instance
instancesRouter.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const evolutionInstanceName = slugify(name);
  const webhookUrl = `${config.webhookBaseUrl}/webhook/evolution`;

  try {
    await evolution.createInstance(evolutionInstanceName, webhookUrl);

    const result = await pool.query<WhatsAppInstance>(
      `INSERT INTO whatsapp_instances (name, evolution_instance_name, status)
       VALUES ($1, $2, 'disconnected')
       RETURNING *`,
      [name, evolutionInstanceName]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error creating instance:', err);
    res.status(500).json({ error: 'Failed to create instance' });
  }
});

// POST /:id/connect — connect instance (get QR)
instancesRouter.post('/:id/connect', async (req, res) => {
  const { id } = req.params;

  try {
    const instance = await pool.query<WhatsAppInstance>(
      'SELECT * FROM whatsapp_instances WHERE id = $1',
      [id]
    );
    if (instance.rows.length === 0) {
      res.status(404).json({ error: 'Instance not found' });
      return;
    }

    const instanceName = instance.rows[0].evolution_instance_name;
    const qrResponse = await evolution.connectInstance(instanceName);

    if (qrResponse.base64) {
      await pool.query(
        `UPDATE whatsapp_instances
         SET qr_code = $1, status = 'qr_pending', updated_at = NOW()
         WHERE id = $2`,
        [qrResponse.base64, id]
      );

      res.json({ data: { qr_code: qrResponse.base64, status: 'qr_pending' } });
    } else {
      logger.warn(`connectInstance for "${instanceName}" returned no base64 QR — waiting for webhook`);

      await pool.query(
        `UPDATE whatsapp_instances
         SET status = 'qr_pending', updated_at = NOW()
         WHERE id = $1`,
        [id]
      );

      res.json({ data: { qr_code: null, status: 'qr_pending' } });
    }
  } catch (err) {
    logger.error('Error connecting instance:', err);
    res.status(500).json({ error: 'Failed to connect instance' });
  }
});

// DELETE /:id — delete instance
instancesRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const instance = await pool.query<WhatsAppInstance>(
      'SELECT * FROM whatsapp_instances WHERE id = $1',
      [id]
    );
    if (instance.rows.length === 0) {
      res.status(404).json({ error: 'Instance not found' });
      return;
    }

    const instanceName = instance.rows[0].evolution_instance_name;

    try {
      await evolution.deleteInstance(instanceName);
    } catch (err) {
      logger.error('EvolutionAPI delete failed (continuing with DB delete):', err);
    }

    await pool.query('DELETE FROM whatsapp_instances WHERE id = $1', [id]);
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error('Error deleting instance:', err);
    res.status(500).json({ error: 'Failed to delete instance' });
  }
});
