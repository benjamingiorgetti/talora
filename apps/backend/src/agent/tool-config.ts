import { pool } from '../db/pool';
import { applyCoreToolDefinition, buildDefaultCoreTools, isCoreToolImplementation, isCoreToolName } from './core-tool-registry';
import type { AgentTool } from '@talora/shared';

function normalizeToolSource(tool: AgentTool): AgentTool {
  const source = tool.source ?? (isCoreToolImplementation(tool.implementation) || isCoreToolName(tool.name) ? 'core' : 'custom');
  const normalized = { ...tool, source };
  return source === 'core' ? applyCoreToolDefinition(normalized) : normalized;
}

export async function listPersistedAgentTools(agentId: string): Promise<AgentTool[]> {
  const result = await pool.query<AgentTool>(
    'SELECT * FROM tools WHERE agent_id = $1 ORDER BY created_at ASC',
    [agentId]
  );
  return result.rows.map(normalizeToolSource);
}

export async function listEffectiveAgentTools(agentId: string): Promise<AgentTool[]> {
  const persistedTools = await listPersistedAgentTools(agentId);
  const toolsByImplementation = new Map(persistedTools.map((tool) => [tool.implementation, tool]));

  const effectiveCoreTools = buildDefaultCoreTools(agentId).map((tool) => {
    const persisted = toolsByImplementation.get(tool.implementation);
    if (persisted) {
      return normalizeToolSource({
        ...persisted,
        source: 'core',
      });
    }

    return normalizeToolSource({
      id: `core:${agentId}:${tool.implementation}`,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
      ...tool,
    } as AgentTool);
  });

  const customTools = persistedTools.filter((tool) => tool.source !== 'core');
  return [...effectiveCoreTools, ...customTools];
}

export function canMutateCoreToolFields(update: Partial<Pick<AgentTool, 'name' | 'description' | 'parameters' | 'implementation'>>): boolean {
  return Object.values(update).every((value) => value === undefined);
}

export async function resolveToolSource(agentId: string, toolId: string): Promise<'core' | 'custom' | null> {
  const result = await pool.query<{ source: 'core' | 'custom' | null; implementation: string; name: string }>(
    'SELECT source, implementation, name FROM tools WHERE id = $1 AND agent_id = $2 LIMIT 1',
    [toolId, agentId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return row.source ?? (isCoreToolImplementation(row.implementation) || isCoreToolName(row.name) ? 'core' : 'custom');
}
