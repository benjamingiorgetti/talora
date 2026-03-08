import { Router } from 'express';
import { pool } from '../db/pool';
import { buildUpdateSet, getNextSectionOrder } from '../db/query-helpers';
import { getAgentConfig, invalidateAgentCache } from '../cache/agent-cache';
import { getResolvedPreview } from '../agent/prompt-builder';
import { handleTestMessage } from '../agent/test-chat';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { PromptSection, AgentTool, Variable, TestSession, TestMessage } from '@talora/shared';

export const agentShortcutRouter = Router();

// Reuse the existing agent config cache (60s TTL) instead of a separate cache
async function getAgentId(): Promise<string | null> {
  const config = await getAgentConfig();
  return config?.agent.id ?? null;
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

    const sectionOrder = await getNextSectionOrder(agentId, order);

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

// --- Variables ---

agentShortcutRouter.get('/variables', async (_req, res) => {
  try {
    const agentId = await getAgentId();
    if (!agentId) { res.status(404).json({ error: 'No agent configured' }); return; }

    const result = await pool.query<Variable>(
      'SELECT * FROM variables WHERE agent_id = $1 ORDER BY category, key',
      [agentId]
    );
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing variables:', err);
    res.status(500).json({ error: 'Failed to list variables' });
  }
});

agentShortcutRouter.post('/variables', async (req, res) => {
  try {
    const agentId = await getAgentId();
    if (!agentId) { res.status(404).json({ error: 'No agent configured' }); return; }

    const { key, default_value, description } = req.body;
    if (!key) { res.status(400).json({ error: 'Key is required' }); return; }

    const result = await pool.query<Variable>(
      `INSERT INTO variables (agent_id, key, default_value, description, category)
       VALUES ($1, $2, $3, $4, 'custom') RETURNING *`,
      [agentId, key, default_value || '', description || '']
    );
    invalidateAgentCache();
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error creating variable:', err);
    res.status(500).json({ error: 'Failed to create variable' });
  }
});

agentShortcutRouter.put('/variables/:id', async (req, res) => {
  const { id } = req.params;
  const { key, default_value, description } = req.body;

  const update = buildUpdateSet({ key, default_value, description });
  if (!update) { res.status(400).json({ error: 'No fields to update' }); return; }

  update.values.push(id);

  try {
    const result = await pool.query<Variable>(
      `UPDATE variables SET ${update.setClause}
       WHERE id = $${update.nextIndex} RETURNING *`,
      update.values
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Variable not found' }); return; }
    invalidateAgentCache();
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error updating variable:', err);
    res.status(500).json({ error: 'Failed to update variable' });
  }
});

agentShortcutRouter.delete('/variables/:id', async (req, res) => {
  try {
    // Only allow deleting custom variables
    const check = await pool.query<Variable>(
      'SELECT category FROM variables WHERE id = $1',
      [req.params.id]
    );
    if (check.rows.length === 0) { res.status(404).json({ error: 'Variable not found' }); return; }
    if (check.rows[0].category === 'system') {
      res.status(403).json({ error: 'Cannot delete system variables' });
      return;
    }

    await pool.query('DELETE FROM variables WHERE id = $1', [req.params.id]);
    invalidateAgentCache();
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error('Error deleting variable:', err);
    res.status(500).json({ error: 'Failed to delete variable' });
  }
});

// --- Test Chat ---

agentShortcutRouter.post('/test-chat/session', async (_req, res) => {
  try {
    const agentId = await getAgentId();
    if (!agentId) { res.status(404).json({ error: 'No agent configured' }); return; }

    const result = await pool.query<TestSession>(
      `INSERT INTO test_sessions (agent_id) VALUES ($1) RETURNING *`,
      [agentId]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error creating test session:', err);
    res.status(500).json({ error: 'Failed to create test session' });
  }
});

agentShortcutRouter.post('/test-chat/message', async (req, res) => {
  try {
    const { session_id, content } = req.body;
    if (!session_id || !content) {
      res.status(400).json({ error: 'session_id and content are required' });
      return;
    }

    // Verify session exists and is not expired
    const sessionResult = await pool.query<TestSession>(
      'SELECT * FROM test_sessions WHERE id = $1 AND expires_at > NOW()',
      [session_id]
    );
    if (sessionResult.rows.length === 0) {
      res.status(404).json({ error: 'Test session not found or expired' });
      return;
    }

    const response = await handleTestMessage(session_id, content);
    res.json({ data: response });
  } catch (err) {
    logger.error('Error in test chat message:', err);
    res.status(500).json({ error: 'Failed to process test message' });
  }
});

agentShortcutRouter.get('/test-chat/session/:id/messages', async (req, res) => {
  try {
    const result = await pool.query<TestMessage>(
      'SELECT * FROM test_messages WHERE session_id = $1 ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing test messages:', err);
    res.status(500).json({ error: 'Failed to list test messages' });
  }
});

agentShortcutRouter.delete('/test-chat/session/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM test_sessions WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error('Error deleting test session:', err);
    res.status(500).json({ error: 'Failed to delete test session' });
  }
});

// --- Unified Prompt ---

agentShortcutRouter.get('/prompt', async (_req, res) => {
  try {
    const agentId = await getAgentId();
    if (!agentId) { res.status(404).json({ error: 'No agent configured' }); return; }

    const result = await pool.query<{ system_prompt: string }>(
      'SELECT system_prompt FROM agents WHERE id = $1',
      [agentId]
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'Agent not found' }); return; }
    res.json({ data: { prompt: result.rows[0].system_prompt } });
  } catch (err) {
    logger.error('Error fetching prompt:', err);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

agentShortcutRouter.put('/prompt', async (req, res) => {
  try {
    const agentId = await getAgentId();
    if (!agentId) { res.status(404).json({ error: 'No agent configured' }); return; }

    const { prompt } = req.body;
    if (typeof prompt !== 'string') { res.status(400).json({ error: 'prompt must be a string' }); return; }

    await pool.query(
      'UPDATE agents SET system_prompt = $1, updated_at = NOW() WHERE id = $2',
      [prompt, agentId]
    );
    invalidateAgentCache();
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error('Error updating prompt:', err);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// --- Prompt Preview ---

agentShortcutRouter.get('/prompt-preview', async (_req, res) => {
  try {
    const agentConfig = await getAgentConfig();
    if (!agentConfig) { res.status(404).json({ error: 'No agent configured' }); return; }

    const { agent, variables } = agentConfig;

    const preview = getResolvedPreview({
      systemPrompt: agent.system_prompt,
      customVariables: variables,
      timezone: config.timezone,
    });

    res.json({ data: { prompt: preview } });
  } catch (err) {
    logger.error('Error generating prompt preview:', err);
    res.status(500).json({ error: 'Failed to generate prompt preview' });
  }
});
