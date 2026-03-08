import { Router } from 'express';
import { pool } from '../db/pool';
import { buildUpdateSet, getNextSectionOrder } from '../db/query-helpers';
import { invalidateAgentCache } from '../cache/agent-cache';
import { logger } from '../utils/logger';
import type { Agent, PromptSection, AgentTool } from '@bottoo/shared';

export const agentsRouter = Router();

// --- Input validation helpers ---
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

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
  if (!isValidUuid(req.params.id)) {
    res.status(400).json({ error: 'Invalid agent ID format' });
    return;
  }

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

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids must be a non-empty array' });
    return;
  }

  if (!ids.every((id: unknown) => typeof id === 'string' && isValidUuid(id as string))) {
    res.status(400).json({ error: 'All ids must be valid UUIDs' });
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

  if (!isNonEmptyString(title)) {
    res.status(400).json({ error: 'Title must be a non-empty string' });
    return;
  }

  if (content !== undefined && typeof content !== 'string') {
    res.status(400).json({ error: 'Content must be a string' });
    return;
  }

  if (order !== undefined && (typeof order !== 'number' || !Number.isInteger(order) || order < 0)) {
    res.status(400).json({ error: 'Order must be a non-negative integer' });
    return;
  }

  try {
    const sectionOrder = await getNextSectionOrder(id, order);

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

  if (!isNonEmptyString(name)) {
    res.status(400).json({ error: 'Name must be a non-empty string' });
    return;
  }

  if (description !== undefined && typeof description !== 'string') {
    res.status(400).json({ error: 'Description must be a string' });
    return;
  }

  if (parameters !== undefined && (typeof parameters !== 'object' || parameters === null)) {
    res.status(400).json({ error: 'Parameters must be an object' });
    return;
  }

  if (implementation !== undefined && typeof implementation !== 'string') {
    res.status(400).json({ error: 'Implementation must be a string' });
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
