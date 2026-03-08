import { Router } from 'express';
import { pool } from '../db/pool';
import { EvolutionClient } from '../evolution/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { WhatsAppInstance } from '@talora/shared';

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

    // Auto-fix webhook URL if it points to localhost (unreachable from Docker)
    const expectedWebhookUrl = `${config.webhookBaseUrl}/webhook/evolution`;
    try {
      const webhook = await evolution.getWebhook(instanceName);
      if (webhook.url && webhook.url !== expectedWebhookUrl) {
        logger.info(`Updating stale webhook for "${instanceName}": ${webhook.url} → ${expectedWebhookUrl}`);
        await evolution.updateWebhook(instanceName, expectedWebhookUrl);
      }
    } catch (webhookErr) {
      logger.warn(`Could not check/update webhook for "${instanceName}":`, webhookErr);
    }

    let qrResponse: { base64?: string } = {};

    try {
      qrResponse = await evolution.connectInstance(instanceName);
    } catch (connectErr) {
      const is404 = connectErr instanceof Error && connectErr.message.includes('(404)');
      if (!is404) throw connectErr;

      // Instance exists in DB but not in Evolution API — create it (QR comes in create response)
      logger.info(`Instance "${instanceName}" not found in Evolution API — creating`);
      const webhookUrl = `${config.webhookBaseUrl}/webhook/evolution`;
      const createResult = await evolution.createInstance(instanceName, webhookUrl);
      if (createResult.qrcode?.base64) {
        qrResponse = { base64: createResult.qrcode.base64 };
      } else {
        // Fallback: try connectInstance after create
        try {
          qrResponse = await evolution.connectInstance(instanceName);
        } catch {
          logger.warn(`connectInstance after create failed for "${instanceName}" — will wait for webhook`);
        }
      }
    }

    // If no QR yet, wait for webhook — do NOT delete/recreate (that destroys the instance before Baileys generates QR)
    if (!qrResponse.base64) {
      logger.info(`No immediate QR for "${instanceName}" — waiting for webhook`);
    }

    if (qrResponse.base64) {
      await pool.query(
        `UPDATE whatsapp_instances
         SET qr_code = $1, status = 'qr_pending', updated_at = NOW()
         WHERE id = $2`,
        [qrResponse.base64, id]
      );

      res.json({ data: { qr_code: qrResponse.base64, status: 'qr_pending' } });
    } else {
      logger.info(`No QR available for "${instanceName}" — will arrive via webhook`);

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
    const message = err instanceof Error ? err.message : 'Failed to connect instance';
    const isEvolutionDown = message.includes('ECONNREFUSED') || message.includes('fetch failed');
    res.status(isEvolutionDown ? 502 : 500).json({
      error: isEvolutionDown
        ? 'Evolution API no disponible. Verifica que el container este corriendo.'
        : `Error al conectar: ${message}`,
    });
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
