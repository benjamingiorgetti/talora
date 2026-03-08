/**
 * In-memory agent config cache.
 *
 * LIMITATION: Single-instance only. This cache lives in process memory,
 * so it only works correctly when the backend runs as a single process.
 * If you scale to multiple instances (e.g., behind a load balancer), each
 * instance will maintain its own cache and `invalidateAgentCache()` will
 * only clear the local copy. For multi-instance deployments, switch to a
 * shared cache (e.g., Redis) or use a pub/sub invalidation mechanism.
 */
import { pool } from '../db/pool';
import type { Agent, PromptSection, AgentTool, Variable } from '@talora/shared';

export interface AgentConfig {
  agent: Agent;
  sections: PromptSection[];
  tools: AgentTool[];
  variables: Variable[];
}

let cachedConfig: AgentConfig | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

// Guard against thundering-herd: if multiple callers find the cache expired
// at the same time, only one should fetch from DB. The rest reuse the same
// in-flight promise. This works because Node/Bun is single-threaded — the
// variable is read/written atomically within the same microtask.
let pendingFetch: Promise<AgentConfig | null> | null = null;

export async function getAgentConfig(): Promise<AgentConfig | null> {
  const now = Date.now();
  if (cachedConfig && now < cacheExpiry) {
    return cachedConfig;
  }

  // Reuse an in-flight fetch if one exists
  if (pendingFetch) {
    return pendingFetch;
  }

  pendingFetch = fetchAgentConfig()
    .finally(() => {
      pendingFetch = null;
    });

  return pendingFetch;
}

async function fetchAgentConfig(): Promise<AgentConfig | null> {
  const agentResult = await pool.query<Agent>('SELECT * FROM agents LIMIT 1');
  if (agentResult.rows.length === 0) return null;

  const agent = agentResult.rows[0];

  const [sectionsResult, toolsResult, variablesResult] = await Promise.all([
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
    pool.query<Variable>(
      'SELECT * FROM variables WHERE agent_id = $1 ORDER BY category, key',
      [agent.id]
    ),
  ]);

  cachedConfig = {
    agent,
    sections: sectionsResult.rows,
    tools: toolsResult.rows,
    variables: variablesResult.rows,
  };
  cacheExpiry = Date.now() + CACHE_TTL_MS;

  return cachedConfig;
}

export function invalidateAgentCache(): void {
  cachedConfig = null;
  cacheExpiry = 0;
  // Note: pendingFetch is intentionally NOT cleared here. If a fetch is
  // in-flight, it will complete and populate the cache with fresh data.
  // Clearing it would just cause a redundant second fetch.
}
