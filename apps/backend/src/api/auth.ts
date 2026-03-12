import { Router } from 'express';
import { pool } from '../db/pool';
import { config } from '../config';
import { logger } from '../utils/logger';
import { authMiddleware, requireSuperadmin } from './middleware';
import { signSession } from '../auth/session';
import type { AuthSession, AuthUser, Company } from '@talora/shared';

export const authRouter = Router();

interface DbUserRow {
  id: string;
  company_id: string | null;
  professional_id: string | null;
  email: string;
  full_name: string;
  password_hash: string;
  role: 'superadmin' | 'admin_empresa' | 'professional';
  is_active: boolean;
  company_name: string | null;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry && entry.resetAt < now) {
    loginAttempts.delete(ip);
    return false;
  }
  return !!entry && entry.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count++;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (entry.resetAt < now) loginAttempts.delete(ip);
  }
}, 60_000);

async function ensureBootstrapSuperadmin(): Promise<DbUserRow> {
  const existing = await pool.query<DbUserRow>(
    `SELECT u.*, c.name AS company_name
     FROM users u
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.email = $1
     LIMIT 1`,
    [config.adminEmail]
  );
  const passwordHash = await Bun.password.hash(config.adminPassword, {
    algorithm: 'bcrypt',
    cost: 12,
  });

  if (existing.rows.length > 0) {
    const updated = await pool.query<DbUserRow>(
      `UPDATE users
       SET password_hash = $1,
           role = 'superadmin',
           full_name = COALESCE(NULLIF(full_name, ''), 'Talora Superadmin'),
           is_active = true,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, company_id, professional_id, email, full_name, password_hash, role, is_active, NULL::text AS company_name`,
      [passwordHash, existing.rows[0].id]
    );
    return updated.rows[0];
  }

  const legacySuperadmin = await pool.query<DbUserRow>(
    `SELECT u.*, c.name AS company_name
     FROM users u
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.role = 'superadmin'
     ORDER BY u.created_at ASC
     LIMIT 1`
  );

  if (legacySuperadmin.rows.length > 0) {
    const migrated = await pool.query<DbUserRow>(
      `UPDATE users
       SET email = $1,
           password_hash = $2,
           role = 'superadmin',
           company_id = NULL,
           professional_id = NULL,
           full_name = COALESCE(NULLIF(full_name, ''), 'Talora Superadmin'),
           is_active = true,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, company_id, professional_id, email, full_name, password_hash, role, is_active, NULL::text AS company_name`,
      [config.adminEmail, passwordHash, legacySuperadmin.rows[0].id]
    );
    return migrated.rows[0];
  }

  const inserted = await pool.query<DbUserRow>(
    `INSERT INTO users (company_id, email, full_name, password_hash, role, is_active)
     VALUES (NULL, $1, 'Talora Superadmin', $2, 'superadmin', true)
     RETURNING id, company_id, professional_id, email, full_name, password_hash, role, is_active, NULL::text AS company_name`,
    [config.adminEmail, passwordHash]
  );
  return inserted.rows[0];
}

async function findUserByEmail(email: string): Promise<DbUserRow | null> {
  const result = await pool.query<DbUserRow>(
    `SELECT u.id, u.company_id, u.professional_id, u.email, u.full_name, u.password_hash, u.role, u.is_active, c.name AS company_name
     FROM users u
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE LOWER(u.email) = LOWER($1)
     LIMIT 1`,
    [email]
  );
  return result.rows[0] ?? null;
}

function toAuthUser(row: DbUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    company_id: row.company_id,
    professional_id: row.professional_id,
    company_name: row.company_name,
  };
}

async function loadCompany(companyId: string | null): Promise<Company | null> {
  if (!companyId) return null;
  const result = await pool.query<Company>(
    'SELECT * FROM companies WHERE id = $1 LIMIT 1',
    [companyId]
  );
  return result.rows[0] ?? null;
}

authRouter.post('/login', async (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    logger.warn(`Rate limited login attempt from ${ip}`);
    res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    return;
  }

  recordAttempt(ip);

  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  await ensureBootstrapSuperadmin();

  const user = await findUserByEmail(email);
  if (!user || !user.is_active) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const isValid = await Bun.password.verify(password, user.password_hash);
  if (!isValid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const authUser = toAuthUser(user);
  const company = await loadCompany(authUser.company_id);
  const token = signSession(authUser);
  const session: AuthSession = { token, user: authUser, company };
  res.json({ data: session });
});

authRouter.get('/me', authMiddleware, async (req, res) => {
  const result = await pool.query<DbUserRow>(
    `SELECT u.id, u.company_id, u.professional_id, u.email, u.full_name, u.password_hash, u.role, u.is_active, c.name AS company_name
     FROM users u
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.id = $1
     LIMIT 1`,
    [req.user!.userId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const user = toAuthUser(result.rows[0]);
  const company = await loadCompany(user.company_id);
  res.json({ data: { user, company } });
});

authRouter.post('/impersonate/:companyId', authMiddleware, requireSuperadmin, async (req, res) => {
  const { companyId } = req.params;
  const result = await pool.query<DbUserRow>(
    `SELECT u.id, u.company_id, u.professional_id, u.email, u.full_name, u.password_hash, u.role, u.is_active, c.name AS company_name
     FROM users u
     JOIN companies c ON c.id = u.company_id
     WHERE u.company_id = $1
       AND u.role = 'admin_empresa'
       AND u.is_active = true
     ORDER BY u.created_at ASC
     LIMIT 1`,
    [companyId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'No company admin available to impersonate' });
    return;
  }

  const authUser: AuthUser = {
    ...toAuthUser(result.rows[0]),
    impersonated_by: req.user!.userId,
  };
  const company = await loadCompany(authUser.company_id);
  const token = signSession(authUser);
  const session: AuthSession = { token, user: authUser, company };
  res.json({ data: session });
});

authRouter.post('/restore', authMiddleware, async (req, res) => {
  const impersonatedBy = req.user?.impersonatedBy;
  if (!impersonatedBy) {
    res.status(400).json({ error: 'Current session is not impersonating another user' });
    return;
  }

  const result = await pool.query<DbUserRow>(
    `SELECT u.id, u.company_id, u.professional_id, u.email, u.full_name, u.password_hash, u.role, u.is_active, c.name AS company_name
     FROM users u
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.id = $1
       AND u.role = 'superadmin'
       AND u.is_active = true
     LIMIT 1`,
    [impersonatedBy]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Original superadmin session could not be restored' });
    return;
  }

  const authUser = toAuthUser(result.rows[0]);
  const company = await loadCompany(authUser.company_id);
  const token = signSession(authUser);
  const session: AuthSession = { token, user: authUser, company };
  res.json({ data: session });
});
