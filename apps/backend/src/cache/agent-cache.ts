import { pool } from '../db/pool';
import type { Agent, PromptSection, AgentTool } from '@bottoo/shared';

interface AgentConfig {
  agent: Agent;
  sections: PromptSection[];
  tools: AgentTool[];
}

let cachedConfig: AgentConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

export async function getAgentConfig(): Promise<AgentConfig | null> {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiry) {
    return cachedConfig;
  }

  const agentResult = await pool.query<Agent>('SELECT * FROM agents LIMIT 1');
  if (agentResult.rows.length === 0) return null;

  const agent = agentResult.rows[0];

  const [sectionsResult, toolsResult] = await Promise.all([
    pool.query<PromptSection>(
      `SELECT * FROM prompt_sections
       WHERE agent_id = $1 AND is_active = true
       ORDER BY "order" ASC`,
      [agent.id]
    ),
    pool.query<AgentTool>(
      'SELECT * FROM tools WHERE agent_id = $1 AND is_active = true',
      [agent.id]
    ),
  ]);

  cachedConfig = {
    agent,
    sections: sectionsResult.rows,
    tools: toolsResult.rows,
  };
  cacheExpiry = now + CACHE_TTL_MS;

  return cachedConfig;
}

export function invalidateAgentCache(): void {
  cachedConfig = null;
  cacheExpiry = 0;
}
