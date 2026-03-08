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
import { requestIdMiddleware } from './api/request-id';
import { createRateLimiter } from './api/rate-limit';
import { pool } from './db/pool';
import { EvolutionClient } from './evolution/client';
import { logger } from './utils/logger';

const app = express();
const server = http.createServer(app);

const healthEvolution = new EvolutionClient();
const corsOrigins = config.corsOrigin.split(',').map((o) => o.trim());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());
app.use(requestIdMiddleware);

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
    const result = await pool.query("SELECT value FROM bot_config WHERE key = 'google_refresh_token'");
    if (result.rows.length > 0 && result.rows[0].value) {
      checks.google_calendar = 'ok';
    } else {
      checks.google_calendar = 'not_connected';
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

// Full agents CRUD (kept for direct API access)
app.use('/api/agents', authMiddleware, apiRateLimiter, agentsRouter);

// WebSocket
setupWebSocket(server);

server.listen(config.port, () => {
  logger.info(`Backend running on port ${config.port}`);
});

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
