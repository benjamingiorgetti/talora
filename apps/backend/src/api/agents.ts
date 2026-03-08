import { Router } from 'express';
import { pool } from '../db/pool';
import { buildUpdateSet } from '../db/query-helpers';
import { invalidateAgentCache } from '../cache/agent-cache';
import { logger } from '../utils/logger';
import type { Agent, PromptSection, AgentTool } from '@bottoo/shared';

export const agentsRouter = Router();

// GET / — list all agents
agentsRouter.get('/', async (_req, res) => {
  try {
    const result = await pool.query<Agent>('SELECT * FROM agents ORDER BY created_at DESC');
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing agents:', err);
    res.status(500).json({ error: 'Failed to list agents' });
  }
});

// GET /:id — get agent by id
agentsRouter.get('/:id', async (req, res) => {
  try {
    const result = await pool.query<Agent>('SELECT * FROM agents WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error getting agent:', err);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

// PUT /:id/prompt-sections/reorder — reorder sections (must be before /:id/prompt-sections/:sectionId)
agentsRouter.put('/:id/prompt-sections/reorder', async (req, res) => {
  const { id } = req.params;
  const { ids } = req.body as { ids: string[] };

  if (!Array.isArray(ids)) {
    res.status(400).json({ error: 'ids array is required' });
    return;
  }

  try {
    // Single query using unnest to batch-update all orders at once
    await pool.query(
      `UPDATE prompt_sections ps
       SET "order" = batch.new_order
       FROM (SELECT unnest($1::uuid[]) AS id, generate_series(0, $2::int) AS new_order) AS batch
       WHERE ps.id = batch.id AND ps.agent_id = $3`,
      [ids, ids.length - 1, id]
    );

    const result = await pool.query<PromptSection>(
      'SELECT * FROM prompt_sections WHERE agent_id = $1 ORDER BY "order" ASC',
      [id]
    );
    invalidateAgentCache();
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error reordering sections:', err);
    res.status(500).json({ error: 'Failed to reorder sections' });
  }
});

// GET /:id/prompt-sections — list prompt sections
agentsRouter.get('/:id/prompt-sections', async (req, res) => {
  try {
    const result = await pool.query<PromptSection>(
      'SELECT * FROM prompt_sections WHERE agent_id = $1 ORDER BY "order" ASC',
      [req.params.id]
    );
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing prompt sections:', err);
    res.status(500).json({ error: 'Failed to list prompt sections' });
  }
});

// POST /:id/prompt-sections — create section
agentsRouter.post('/:id/prompt-sections', async (req, res) => {
  const { id } = req.params;
  const { title, content, order } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  try {
    let sectionOrder = order;
    if (sectionOrder === undefined) {
      const maxResult = await pool.query<{ max: number }>(
        'SELECT COALESCE(MAX("order"), -1) as max FROM prompt_sections WHERE agent_id = $1',
        [id]
      );
      sectionOrder = maxResult.rows[0].max + 1;
    }

    const result = await pool.query<PromptSection>(
      `INSERT INTO prompt_sections (agent_id, title, content, "order")
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, title, content || '', sectionOrder]
    );
    invalidateAgentCache();
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error creating prompt section:', err);
    res.status(500).json({ error: 'Failed to create prompt section' });
  }
});

// PUT /:id/prompt-sections/:sectionId — update section
agentsRouter.put('/:id/prompt-sections/:sectionId', async (req, res) => {
  const { id, sectionId } = req.params;
  const { title, content, order, is_active } = req.body;

  const update = buildUpdateSet({ title, content, order, is_active });
  if (!update) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  update.values.push(sectionId, id);

  try {
    const result = await pool.query<PromptSection>(
      `UPDATE prompt_sections SET ${update.setClause}
       WHERE id = $${update.nextIndex} AND agent_id = $${update.nextIndex + 1}
       RETURNING *`,
      update.values
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }
    invalidateAgentCache();
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error updating prompt section:', err);
    res.status(500).json({ error: 'Failed to update prompt section' });
  }
});

// DELETE /:id/prompt-sections/:sectionId — delete section
agentsRouter.delete('/:id/prompt-sections/:sectionId', async (req, res) => {
  const { id, sectionId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM prompt_sections WHERE id = $1 AND agent_id = $2 RETURNING id',
      [sectionId, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }
    invalidateAgentCache();
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error('Error deleting prompt section:', err);
    res.status(500).json({ error: 'Failed to delete prompt section' });
  }
});

// GET /:id/tools — list tools
agentsRouter.get('/:id/tools', async (req, res) => {
  try {
    const result = await pool.query<AgentTool>(
      'SELECT * FROM tools WHERE agent_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing tools:', err);
    res.status(500).json({ error: 'Failed to list tools' });
  }
});

// POST /:id/tools — create tool
agentsRouter.post('/:id/tools', async (req, res) => {
  const { id } = req.params;
  const { name, description, parameters, implementation } = req.body;

  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  try {
    const result = await pool.query<AgentTool>(
      `INSERT INTO tools (agent_id, name, description, parameters, implementation)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, name, description || '', JSON.stringify(parameters || {}), implementation || 'webhook']
    );
    invalidateAgentCache();
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error creating tool:', err);
    res.status(500).json({ error: 'Failed to create tool' });
  }
});

// PUT /:id/tools/:toolId — update tool
agentsRouter.put('/:id/tools/:toolId', async (req, res) => {
  const { id, toolId } = req.params;
  const { name, description, parameters, implementation, is_active } = req.body;

  const update = buildUpdateSet({
    name,
    description,
    parameters: parameters !== undefined ? JSON.stringify(parameters) : undefined,
    implementation,
    is_active,
  });
  if (!update) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  update.values.push(toolId, id);

  try {
    const result = await pool.query<AgentTool>(
      `UPDATE tools SET ${update.setClause}
       WHERE id = $${update.nextIndex} AND agent_id = $${update.nextIndex + 1}
       RETURNING *`,
      update.values
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }
    invalidateAgentCache();
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error updating tool:', err);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

// DELETE /:id/tools/:toolId — delete tool
agentsRouter.delete('/:id/tools/:toolId', async (req, res) => {
  const { id, toolId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM tools WHERE id = $1 AND agent_id = $2 RETURNING id',
      [toolId, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Tool not found' });
      return;
    }
    invalidateAgentCache();
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error('Error deleting tool:', err);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});
