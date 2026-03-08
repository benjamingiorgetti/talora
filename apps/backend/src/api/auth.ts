import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

export const authRouter = Router();

// --- Hashed admin password cache ---
let adminPasswordHash: string | null = null;

/**
 * Get or compute the bcrypt hash of the admin password from env.
 * Hashed once at first login attempt and cached in memory.
 */
async function getAdminPasswordHash(): Promise<string> {
  if (!adminPasswordHash) {
    adminPasswordHash = await Bun.password.hash(config.adminPassword, {
      algorithm: 'bcrypt',
      cost: 10,
    });
  }
  return adminPasswordHash;
}

// --- In-memory rate limiter ---
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 60 seconds

/**
 * Check and enforce rate limit for login attempts.
 * Returns true if the request should be blocked.
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  // Clean up expired entry
  if (entry && entry.resetAt < now) {
    loginAttempts.delete(ip);
    return false;
  }

  if (entry && entry.count >= MAX_ATTEMPTS) {
    return true;
  }

  return false;
}

/**
 * Record a login attempt for the given IP.
 */
function recordAttempt(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  entry.count++;
}

/**
 * Clean up stale entries from the rate limit map.
 */
function cleanupStaleEntries(): void {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (entry.resetAt < now) {
      loginAttempts.delete(ip);
    }
  }
}

// Run cleanup on a fixed interval instead of on every login request
setInterval(cleanupStaleEntries, 60_000);

authRouter.post('/login', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  // Rate limit check
  if (isRateLimited(ip)) {
    logger.warn(`Rate limited login attempt from ${ip}`);
    res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    return;
  }

  // Record the attempt before processing
  recordAttempt(ip);

  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  if (email !== config.adminEmail) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Compare password using bcrypt via Bun.password.verify
  const hash = await getAdminPasswordHash();
  const isValid = await Bun.password.verify(password, hash);

  if (!isValid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign({ email }, config.jwtSecret, { expiresIn: '7d' });
  res.json({ data: { token } });
});
