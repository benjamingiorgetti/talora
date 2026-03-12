import { Router } from 'express';
import { pool } from '../db/pool';
import { EvolutionClient, EvolutionApiError } from '../evolution/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { WhatsAppInstance } from '@talora/shared';
import type { Request } from 'express';

export const instancesRouter = Router();
const evolution = new EvolutionClient();

function getScopedCompanyId(req: Request): string | null {
  if (req.user?.role === 'superadmin') {
    if (typeof req.body?.company_id === 'string') return req.body.company_id;
    if (typeof req.query.company_id === 'string') return req.query.company_id;
    return null;
  }
  return req.user?.companyId ?? null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Sync instance statuses from Evolution API into the DB (best-effort). */
async function syncInstancesFromEvolution(): Promise<void> {
  try {
    const evoInstances = await evolution.fetchInstances();
    const evoMap = new Map(evoInstances.map(i => [i.name, i]));

    const result = await pool.query<WhatsAppInstance>(
      'SELECT * FROM whatsapp_instances ORDER BY created_at DESC'
    );

    for (const inst of result.rows) {
      const evo = evoMap.get(inst.evolution_instance_name);
      if (!evo) continue;

      let needsUpdate = false;
      const updates: { status?: string; phone_number?: string } = {};

      if (evo.connectionStatus === 'open' && inst.status !== 'connected') {
        updates.status = 'connected';
        needsUpdate = true;
      } else if (evo.connectionStatus === 'close' && inst.status === 'connected') {
        updates.status = 'disconnected';
        needsUpdate = true;
      }

      if (!inst.phone_number && evo.ownerJid) {
        updates.phone_number = evo.ownerJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
        needsUpdate = true;
      }

      if (needsUpdate) {
        const setClauses: string[] = [];
        const params: unknown[] = [];
        let paramIdx = 1;

        if (updates.status) {
          setClauses.push(`status = $${paramIdx++}`);
          params.push(updates.status);
          if (updates.status === 'connected') {
            setClauses.push('qr_code = NULL');
          }
        }
        if (updates.phone_number) {
          setClauses.push(`phone_number = $${paramIdx++}`);
          params.push(updates.phone_number);
        }

        setClauses.push('updated_at = NOW()');
        params.push(inst.id);

        await pool.query(
          `UPDATE whatsapp_instances SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
          params
        );
      }
    }
    logger.info('Background Evolution API sync completed');
  } catch (err) {
    logger.warn('Background Evolution API sync failed:', err);
  }
}

// GET / — list all instances (returns DB data immediately, syncs Evolution API in background)
instancesRouter.get('/', async (_req, res) => {
  try {
    const req = _req;
    const companyId = getScopedCompanyId(req);
    const values: unknown[] = [];
    let query = 'SELECT * FROM whatsapp_instances';

    if (companyId) {
      query += ' WHERE company_id = $1';
      values.push(companyId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query<WhatsAppInstance>(
      query,
      values
    );

    // Fire-and-forget: sync with Evolution API in the background
    syncInstancesFromEvolution();

    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing instances:', err);
    res.status(500).json({ error: 'Failed to list instances' });
  }
});

// POST /sync — trigger Evolution API sync and return updated data
instancesRouter.post('/sync', async (_req, res) => {
  try {
    await syncInstancesFromEvolution();

    const companyId = getScopedCompanyId(_req);
    const values: unknown[] = [];
    let query = 'SELECT * FROM whatsapp_instances';

    if (companyId) {
      query += ' WHERE company_id = $1';
      values.push(companyId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query<WhatsAppInstance>(
      query,
      values
    );

    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error syncing instances:', err);
    res.status(500).json({ error: 'Failed to sync instances' });
  }
});

// POST / — create instance
instancesRouter.post('/', async (req, res) => {
  const { name } = req.body;
  const companyId = getScopedCompanyId(req);
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  if (!companyId) {
    res.status(400).json({ error: 'company_id is required' });
    return;
  }

  const evolutionInstanceName = slugify(name);
  const webhookUrl = `${config.webhookBaseUrl}/webhook/evolution`;

  try {
    await evolution.createInstance(evolutionInstanceName, webhookUrl);

    const result = await pool.query<WhatsAppInstance>(
      `INSERT INTO whatsapp_instances (company_id, name, evolution_instance_name, status)
       VALUES ($1, $2, $3, 'disconnected')
       RETURNING *`,
      [companyId, name, evolutionInstanceName]
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
      'SELECT * FROM whatsapp_instances WHERE id = $1 AND ($2::uuid IS NULL OR company_id = $2)',
      [id, getScopedCompanyId(req)]
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
      const is404 = connectErr instanceof EvolutionApiError && connectErr.statusCode === 404;
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
        } catch (retryErr) {
          logger.warn(`connectInstance after create failed for "${instanceName}":`, retryErr);
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
    const isTimeout = message.includes('AbortError') || message.includes('TimeoutError');
    const isAuthError = message.includes('(401)') || message.includes('(403)');

    let statusCode = 500;
    let errorMsg = 'Error al conectar la instancia de WhatsApp';

    if (isEvolutionDown) {
      statusCode = 502;
      errorMsg = 'Evolution API no disponible. Verifica que el container este corriendo.';
    } else if (isTimeout) {
      statusCode = 504;
      errorMsg = 'Evolution API no responde (timeout). Intenta de nuevo.';
    } else if (isAuthError) {
      statusCode = 502;
      errorMsg = 'Error de autenticacion con Evolution API. Verifica la API key.';
    }

    res.status(statusCode).json({ error: errorMsg });
  }
});

// GET /:id/qr — poll QR code status directly from Evolution API
instancesRouter.get('/:id/qr', async (req, res) => {
  const { id } = req.params;

  try {
    const instance = await pool.query<WhatsAppInstance>(
      'SELECT * FROM whatsapp_instances WHERE id = $1 AND ($2::uuid IS NULL OR company_id = $2)',
      [id, getScopedCompanyId(req)]
    );
    if (instance.rows.length === 0) {
      res.status(404).json({ error: 'Instance not found' });
      return;
    }

    const instanceName = instance.rows[0].evolution_instance_name;

    // 1. Check connection state first — if already connected, no QR needed
    try {
      const status = await evolution.getInstanceStatus(instanceName);
      if (status.state === 'open') {
        // Fetch and store phone number if not already set
        let phoneNumber = instance.rows[0].phone_number;
        if (!phoneNumber) {
          try {
            const info = await evolution.getInstanceInfo(instanceName);
            if (info.ownerJid) {
              phoneNumber = info.ownerJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
            }
          } catch {
            // non-critical
          }
        }
        await pool.query(
          'UPDATE whatsapp_instances SET status = $1, qr_code = NULL, phone_number = COALESCE($3, phone_number), updated_at = NOW() WHERE id = $2',
          ['connected', id, phoneNumber]
        );
        res.json({ data: { status: 'connected', qr_code: null, phone_number: phoneNumber } });
        return;
      }
    } catch {
      // instance might not exist yet in Evolution API, continue
    }

    // 2. Try to get QR from connect endpoint
    try {
      const qr = await evolution.connectInstance(instanceName);
      if (qr.base64) {
        await pool.query(
          'UPDATE whatsapp_instances SET qr_code = $1, status = $2, updated_at = NOW() WHERE id = $3',
          [qr.base64, 'qr_pending', id]
        );
        res.json({ data: { status: 'qr_pending', qr_code: qr.base64 } });
        return;
      }
    } catch {
      // no QR available from connect endpoint
    }

    // 3. Fall back to DB (QR may have arrived via webhook)
    const dbResult = await pool.query(
      'SELECT status, qr_code FROM whatsapp_instances WHERE id = $1 AND ($2::uuid IS NULL OR company_id = $2)',
      [id, getScopedCompanyId(req)]
    );
    const row = dbResult.rows[0];
    res.json({ data: { status: row.status, qr_code: row.qr_code } });
  } catch (err) {
    logger.error('Error polling QR:', err);
    res.status(500).json({ error: 'Failed to poll QR status' });
  }
});

// DELETE /:id — delete instance
instancesRouter.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const instance = await pool.query<WhatsAppInstance>(
      'SELECT * FROM whatsapp_instances WHERE id = $1 AND ($2::uuid IS NULL OR company_id = $2)',
      [id, getScopedCompanyId(req)]
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

    await pool.query(
      'DELETE FROM whatsapp_instances WHERE id = $1 AND ($2::uuid IS NULL OR company_id = $2)',
      [id, getScopedCompanyId(req)]
    );
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error('Error deleting instance:', err);
    res.status(500).json({ error: 'Failed to delete instance' });
  }
});
