import express from 'express';
import cors from 'cors';
import http from 'http';
import { config } from './config';
import { setupWebSocket, wss } from './ws/server';
import { instancesRouter } from './api/instances';
import { agentsRouter } from './api/agents';
import { conversationsRouter } from './api/conversations';
import { alertsRouter } from './api/alerts';
import { authRouter } from './api/auth';
import { googleAuthRouter } from './api/google-auth';
import { webhookRouter } from './evolution/webhook';
import { authMiddleware } from './api/middleware';
import { agentShortcutRouter } from './api/agent-shortcut';
import { clientsRouter } from './api/clients';
import { companiesRouter } from './api/companies';
import { professionalsRouter } from './api/professionals';
import { servicesRouter } from './api/services';
import { appointmentsRouter } from './api/appointments';
import { dashboardRouter } from './api/dashboard';
import { companySettingsRouter } from './api/company-settings';
import { requestIdMiddleware } from './api/request-id';
import { createRateLimiter } from './api/rate-limit';
import { pool } from './db/pool';
import { EvolutionClient } from './evolution/client';
import { logger } from './utils/logger';
import { getGoogleConnectionSchema } from './calendar/connection-schema';

const app = express();
const server = http.createServer(app);

const healthEvolution = new EvolutionClient();
const corsOrigins = config.corsOrigin.split(',').map((o) => o.trim());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());
app.use(requestIdMiddleware);

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'strict-origin');
  next();
});

// Enforce Content-Type: application/json on mutation requests (Rule 19)
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      res.status(415).json({ error: 'Content-Type must be application/json' });
      return;
    }
  }
  next();
});

// Public routes
app.get('/api/health', async (_req, res) => {
  const checks: Record<string, string> = {};

  // DB check
  try {
    await pool.query('SELECT 1');
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  // Evolution API check
  try {
    await healthEvolution.ping();
    checks.evolution = 'ok';
  } catch {
    checks.evolution = 'error';
  }

  // Google Calendar check
  try {
    const schema = await getGoogleConnectionSchema();
    if (!schema.hasRefreshToken) {
      checks.google_calendar = 'not_connected';
    } else {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS connected_count
         FROM google_calendar_connections
         WHERE NULLIF(refresh_token, '') IS NOT NULL`
      );
      if ((result.rows[0] as { connected_count?: number }).connected_count) {
        checks.google_calendar = 'ok';
      } else {
        checks.google_calendar = 'not_connected';
      }
    }
  } catch {
    checks.google_calendar = 'error';
  }

  const allOk = Object.values(checks).every((v) => v === 'ok' || v === 'not_connected');
  const status = allOk ? 'ok' : 'degraded';

  res.status(allOk ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    checks,
  });
});
app.use('/auth', authRouter);
app.use('/auth', googleAuthRouter);
app.use('/webhook', webhookRouter);

// Rate limiter for protected routes: 100 requests per minute per IP
const apiRateLimiter = createRateLimiter(100, 60_000);

// Protected routes (frontend uses paths without /api prefix)
app.use('/instances', authMiddleware, apiRateLimiter, instancesRouter);
app.use('/conversations', authMiddleware, apiRateLimiter, conversationsRouter);
app.use('/alerts', authMiddleware, apiRateLimiter, alertsRouter);

// Agent routes: frontend uses /agent/sections and /agent/tools (single-tenant)
// Backend agents router expects /:id/prompt-sections and /:id/tools
// Bridge: resolve the single agent and rewrite the path
app.use('/agent', authMiddleware, apiRateLimiter, agentShortcutRouter);
app.use('/clients', authMiddleware, apiRateLimiter, clientsRouter);
app.use('/companies', authMiddleware, apiRateLimiter, companiesRouter);
app.use('/professionals', authMiddleware, apiRateLimiter, professionalsRouter);
app.use('/services', authMiddleware, apiRateLimiter, servicesRouter);
app.use('/appointments', authMiddleware, apiRateLimiter, appointmentsRouter);
app.use('/dashboard', authMiddleware, apiRateLimiter, dashboardRouter);
app.use('/company-settings', authMiddleware, apiRateLimiter, companySettingsRouter);

// Full agents CRUD (kept for direct API access)
app.use('/api/agents', authMiddleware, apiRateLimiter, agentsRouter);

// WebSocket
setupWebSocket(server);

server.listen(config.port, () => {
  logger.info(`Backend running on port ${config.port}`);
});

// Non-blocking startup checks
(async () => {
  try {
    await healthEvolution.ping();
    logger.info('[startup] Evolution API: OK');
  } catch (err) {
    logger.error('[startup] Evolution API: UNREACHABLE — QR codes will NOT work', err);
  }

  if (config.webhookBaseUrl.includes('localhost')) {
    logger.warn('[startup] WEBHOOK_BASE_URL contains "localhost" — webhooks from Docker containers may fail. Use host.docker.internal instead.');
  }

  logger.info(`[startup] Webhook URL: ${config.webhookBaseUrl}/webhook/evolution`);
})();

// --- Graceful shutdown ---
const SHUTDOWN_TIMEOUT_MS = 30_000;

function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  // Force exit after timeout
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  // Unref so it doesn't keep the process alive if everything closes cleanly
  forceExit.unref();

  // Close HTTP server (stops accepting new connections)
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Close WebSocket server
  if (wss) {
    wss.close(() => {
      logger.info('WebSocket server closed');
    });
  }

  // Close DB pool
  pool.end()
    .then(() => {
      logger.info('Database pool closed');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Error closing database pool:', err);
      process.exit(1);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
