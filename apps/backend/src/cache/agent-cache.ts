import { pool } from '../db/pool';
import type { Agent, PromptSection, AgentTool, Variable } from '@talora/shared';

export interface AgentConfig {
  agent: Agent;
  sections: PromptSection[];
  tools: AgentTool[];
  variables: Variable[];
}

const CACHE_TTL_MS = 60_000;
const cachedConfig = new Map<string, AgentConfig>();
const cacheExpiry = new Map<string, number>();
const pendingFetch = new Map<string, Promise<AgentConfig | null>>();

async function resolveCompanyId(companyId?: string | null): Promise<string | null> {
  if (companyId) return companyId;

  const result = await pool.query<{ company_id: string }>(
    'SELECT company_id FROM agents ORDER BY created_at ASC LIMIT 1'
  );
  return result.rows[0]?.company_id ?? null;
}

export async function getAgentConfig(companyId?: string | null): Promise<AgentConfig | null> {
  const resolvedCompanyId = await resolveCompanyId(companyId);
  if (!resolvedCompanyId) return null;

  const now = Date.now();
  const cached = cachedConfig.get(resolvedCompanyId);
  const expiry = cacheExpiry.get(resolvedCompanyId) ?? 0;

  if (cached && now < expiry) {
    return cached;
  }

  if (pendingFetch.has(resolvedCompanyId)) {
    return pendingFetch.get(resolvedCompanyId)!;
  }

  const fetchPromise = fetchAgentConfig(resolvedCompanyId).finally(() => {
    pendingFetch.delete(resolvedCompanyId);
  });
  pendingFetch.set(resolvedCompanyId, fetchPromise);
  return fetchPromise;
}

async function fetchAgentConfig(companyId: string): Promise<AgentConfig | null> {
  const agentResult = await pool.query<Agent>(
    'SELECT * FROM agents WHERE company_id = $1 ORDER BY created_at ASC LIMIT 1',
    [companyId]
  );
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

  const nextConfig = {
    agent,
    sections: sectionsResult.rows,
    tools: toolsResult.rows,
    variables: variablesResult.rows,
  };
  cachedConfig.set(companyId, nextConfig);
  cacheExpiry.set(companyId, Date.now() + CACHE_TTL_MS);
  return nextConfig;
}

export function invalidateAgentCache(companyId?: string): void {
  if (companyId) {
    cachedConfig.delete(companyId);
    cacheExpiry.delete(companyId);
    return;
  }

  cachedConfig.clear();
  cacheExpiry.clear();
}
