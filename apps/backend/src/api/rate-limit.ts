import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Create an in-memory rate limiter middleware.
 * @param maxRequests - Max requests allowed per window per IP
 * @param windowMs - Time window in milliseconds
 */
export function createRateLimiter(maxRequests: number, windowMs: number) {
  const requests = new Map<string, RateLimitEntry>();

  // Periodic cleanup every 60 seconds
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of requests) {
      if (entry.resetAt < now) {
        requests.delete(ip);
      }
    }
  }, 60_000);

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = requests.get(ip);

    // Reset expired window
    if (entry && entry.resetAt < now) {
      requests.delete(ip);
    }

    const current = requests.get(ip);

    if (!current) {
      requests.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= maxRequests) {
      logger.warn(`Rate limited API request from ${ip} (${current.count}/${maxRequests})`);
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'Too many requests. Try again later.' });
      return;
    }

    current.count++;
    next();
  };
}
