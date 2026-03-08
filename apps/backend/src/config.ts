function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

/**
 * Parse and validate PORT as a number in range 1-65535.
 * Falls back to 3001 if not set or invalid.
 */
function parsePort(raw: string): number {
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
    console.warn(`[config] Invalid PORT "${raw}", falling back to 3001`);
    return 3001;
  }
  return parsed;
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const config = {
  nodeEnv,
  port: parsePort(optionalEnv('PORT', '3001')),
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireEnv('JWT_SECRET'),
  adminEmail: requireEnv('ADMIN_EMAIL'),
  adminPassword: requireEnv('ADMIN_PASSWORD'),
  evolutionApiUrl: requireEnv('EVOLUTION_API_URL'),
  evolutionApiKey: requireEnv('EVOLUTION_API_KEY'),
  webhookBaseUrl: optionalEnv('WEBHOOK_BASE_URL', 'http://localhost:3001'),
  corsOrigin: optionalEnv('CORS_ORIGIN', 'http://localhost:3000'),
  timezone: optionalEnv('TIMEZONE', 'America/Argentina/Buenos_Aires'),
  googleClientId: optionalEnv('GOOGLE_CLIENT_ID', ''),
  googleClientSecret: optionalEnv('GOOGLE_CLIENT_SECRET', ''),
  googleRedirectUri: optionalEnv('GOOGLE_REDIRECT_URI', 'http://localhost:3001/auth/google/callback'),
  googleCalendarId: optionalEnv('GOOGLE_CALENDAR_ID', 'primary'),
  webhookAllowedHosts: optionalEnv('WEBHOOK_ALLOWED_HOSTS', ''),
  webhookSecret: optionalEnv('WEBHOOK_SECRET', ''),
  openaiApiKey: requireEnv('OPENAI_API_KEY'),

  // Operational limits
  maxToolIterations: parseInt(optionalEnv('MAX_TOOL_ITERATIONS', '10')),
  idempotencyTtlMs: parseInt(optionalEnv('IDEMPOTENCY_TTL_MS', '300000')),   // 5 min
  agentTimeoutMs: parseInt(optionalEnv('AGENT_TIMEOUT_MS', '120000')),        // 2 min
  toolTimeoutMs: parseInt(optionalEnv('TOOL_TIMEOUT_MS', '60000')),           // 1 min
  wsHeartbeatIntervalMs: parseInt(optionalEnv('WS_HEARTBEAT_INTERVAL_MS', '30000')),
};

// --- Startup validation warnings ---
if (config.nodeEnv === 'production' && !config.webhookSecret) {
  console.warn(
    '[config] WARNING: WEBHOOK_SECRET is not set in production. ' +
    'Webhooks will be rejected unless an IP allowlist is configured via WEBHOOK_ALLOWED_HOSTS.'
  );
}

if (config.nodeEnv === 'production' && !config.webhookAllowedHosts && !config.webhookSecret) {
  console.warn(
    '[config] WARNING: Neither WEBHOOK_SECRET nor WEBHOOK_ALLOWED_HOSTS is set in production. ' +
    'All incoming webhooks will be rejected.'
  );
}
