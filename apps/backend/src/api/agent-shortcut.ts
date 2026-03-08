import { Router } from 'express';
import { pool } from '../db/pool';
import { buildUpdateSet } from '../db/query-helpers';
import { invalidateAgentCache } from '../cache/agent-cache';
import { logger } from '../utils/logger';
import type { Agent, PromptSection, AgentTool } from '@bottoo/shared';

export const agentShortcutRouter = Router();

// Resolve the single agent for all routes
async function getAgentId(): Promise<string | null> {
  const result = await pool.query<Agent>('SELECT id FROM agents LIMIT 1');
  return result.rows.length > 0 ? result.rows[0].id : null;
}

// --- Sections ---

agentShortcutRouter.get('/sections', async (_req, res) => {
  try {
    const agentId = await getAgentId();
    if (!agentId) { res.status(404).json({ error: 'No agent configured' }); return; }

    const result = await pool.query<PromptSection>(
      'SELECT * FROM prompt_sections WHERE agent_id = $1 ORDER BY "order" ASC',
      [agentId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing sections:', err);
    res.status(500).json({ error: 'Failed to list sections' });
  }
});

agentShortcutRouter.post('/sections', async (req, res) => {
  try {
    const agentId = await getAgentId();
    if (!agentId) { res.status(404).json({ error: 'No agent configured' }); return; }

    const { title, content, order } = req.body;
    if (!title) { res.status(400).json({ error: 'Title is required' }); return; }

    let sectionOrder = order;
    if (sectionOrder === undefined) {
      const maxResult = await pool.query<{ max: number }>(
        'SELECT COALESCE(MAX("order"), -1) as max FROM prompt_sections WHERE agent_id = $1',
        [agentId]
      );
      sectionOrder = maxResult.rows[0].max + 1;
    }

    const result = await pool.query<PromptSection>(
      `INSERT INTO prompt_sections (agent_id, title, content, "order")
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [agentId, title, content || '', sectionOrder]
    );
    invalidateAgentCache();
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error creating section:', err);
    res.status(500).json({ error: 'Failed to create section' });
  }
});

agentShortcutRouter.put('/sections/:sectionId', async (req, res) => {
  const { sectionId } = req.params;
  const { title, content, order, is_active } = req.body;

  const update = buildUpdateSet({ title, content, order, is_active });
  if (!update) { res.status(400).json({ error: 'No fields to update' }); return; }

  update.values.push(sectionId);

  try {
    const result = await pool.query<PromptSection>(
      `UPDATE prompt_sections SET ${update.setClause}
       WHERE id = $${update.nextIndex} RETURNING *`,
      update.values
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Section not found' }); return; }
    invalidateAgentCache();
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error updating section:', err);
    res.status(500).json({ error: 'Failed to update section' });
  }
});

agentShortcutRouter.delete('/sections/:sectionId', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM prompt_sections WHERE id = $1 RETURNING id',
      [req.params.sectionId]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Section not found' }); return; }
    invalidateAgentCache();
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error('Error deleting section:', err);
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

// --- Tools ---

agentShortcutRouter.get('/tools', async (_req, res) => {
  try {
    const agentId = await getAgentId();
    if (!agentId) { res.status(404).json({ error: 'No agent configured' }); return; }

    const result = await pool.query<AgentTool>(
      'SELECT * FROM tools WHERE agent_id = $1 ORDER BY created_at ASC',
      [agentId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing tools:', err);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

agentShortcutRouter.post('/tools', async (req, res) => {
  try {
    const agentId = await getAgentId();
    if (!agentId) { res.status(404).json({ error: 'No agent configured' }); return; }

    const { name, description, parameters, implementation } = req.body;
    if (!name) { res.status(400).json({ error: 'Name is required' }); return; }

    const result = await pool.query<AgentTool>(
      `INSERT INTO tools (agent_id, name, description, parameters, implementation)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [agentId, name, description || '', JSON.stringify(parameters || {}), implementation || 'webhook']
    );
    invalidateAgentCache();
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error creating tool:', err);
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

agentShortcutRouter.put('/tools/:toolId', async (req, res) => {
  const { toolId } = req.params;
  const { name, description, parameters, implementation, is_active } = req.body;

  const update = buildUpdateSet({
    name,
    description,
    parameters: parameters !== undefined ? JSON.stringify(parameters) : undefined,
    implementation,
    is_active,
  });
  if (!update) { res.status(400).json({ error: 'No fields to update' }); return; }

  update.values.push(toolId);

  try {
    const result = await pool.query<AgentTool>(
      `UPDATE tools SET ${update.setClause}
       WHERE id = $${update.nextIndex} RETURNING *`,
      update.values
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Tool not found' }); return; }
    invalidateAgentCache();
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error updating tool:', err);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

agentShortcutRouter.delete('/tools/:toolId', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM tools WHERE id = $1 RETURNING id',
      [req.params.toolId]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Tool not found' }); return; }
    invalidateAgentCache();
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error('Error deleting tool:', err);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});
