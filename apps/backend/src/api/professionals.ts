import { Request, Router } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { authMiddleware, getRequestCompanyId, getRequestProfessionalId, requireCompanyScope } from './middleware';
import { validateBody, createProfessionalSchema, updateProfessionalSchema } from './validation';
import type { Professional, User } from '@talora/shared';
import { config } from '../config';
import { hasCalendarAccess } from '../calendar/client';

export const professionalsRouter = Router();

type ProfessionalRow = Professional & {
  user_id?: string | null;
  user_email?: string | null;
  user_full_name?: string | null;
  user_is_active?: boolean | null;
  has_login?: boolean;
};

function getSessionProfessionalId(req: Request): string | null {
  return req.user?.role === 'professional' ? req.user.professionalId ?? null : getRequestProfessionalId(req);
}

async function validateCalendarId(calendarId: string, professionalId?: string | null): Promise<string | null> {
  if (!calendarId) {
    return 'calendar_id is required';
  }

  const googleConfigured = Boolean(config.googleClientId && config.googleClientSecret);
  if (!googleConfigured || !professionalId) {
    return null;
  }

  try {
    const calendarAccessible = await hasCalendarAccess(calendarId, professionalId);
    if (!calendarAccessible) {
      return 'Selected calendar is not accessible with the current Google connection for this professional';
    }
    return null;
  } catch (err) {
    logger.error('Error validating professional calendar access:', err);
    return 'Failed to validate selected Google Calendar';
  }
}

async function createProfessionalUser(
  companyId: string,
  professionalId: string,
  payload: {
    email: string;
    password: string;
    fullName?: string | null;
    isActive?: boolean;
  }
): Promise<User> {
  const passwordHash = await Bun.password.hash(payload.password, { algorithm: 'bcrypt', cost: 12 });
  const result = await pool.query<User>(
    `INSERT INTO users (company_id, professional_id, email, full_name, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, $5, 'professional', $6)
     RETURNING id, company_id, professional_id, email, full_name, role, is_active, created_at, updated_at`,
    [
      companyId,
      professionalId,
      payload.email,
      payload.fullName || '',
      passwordHash,
      payload.isActive ?? true,
    ]
  );
  return result.rows[0];
}

professionalsRouter.use(authMiddleware, requireCompanyScope);

professionalsRouter.get('/', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req)!;
    const scopedProfessionalId = getSessionProfessionalId(req);
    const params: unknown[] = [companyId];
    let query = `
      SELECT p.*,
             u.id AS user_id,
             u.email AS user_email,
             u.full_name AS user_full_name,
             (u.id IS NOT NULL) AS has_login,
             u.is_active AS user_is_active
      FROM professionals p
      LEFT JOIN users u ON u.professional_id = p.id
      WHERE p.company_id = $1
    `;

    if (scopedProfessionalId) {
      params.push(scopedProfessionalId);
      query += ` AND p.id = $${params.length}`;
    }

    query += ' ORDER BY p.name ASC';
    const result = await pool.query<ProfessionalRow>(query, params);
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('Error listing professionals:', err);
    res.status(500).json({ error: 'Failed to list professionals' });
  }
});

professionalsRouter.post('/', validateBody(createProfessionalSchema), async (req, res) => {
  if (req.user?.role === 'professional') {
    res.status(403).json({ error: 'Professional users cannot create other professionals' });
    return;
  }

  const {
    name,
    specialty,
    calendar_id,
    color_hex,
    is_active,
    user_email,
    user_password,
    user_full_name,
    user_is_active,
  } = req.body;

  try {
    const companyId = getRequestCompanyId(req)!;
    const result = await pool.query<Professional>(
      `INSERT INTO professionals (company_id, name, specialty, calendar_id, color_hex, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [companyId, name, specialty, calendar_id, color_hex || null, is_active]
    );
    const professional = result.rows[0];

    await pool.query(
      `INSERT INTO google_calendar_connections (company_id, professional_id, calendar_id, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (professional_id)
       DO UPDATE SET calendar_id = $3, is_active = true, updated_at = NOW()`,
      [companyId, professional.id, calendar_id]
    );

    let professionalUser: User | null = null;
    if (user_email && user_password) {
      professionalUser = await createProfessionalUser(companyId, professional.id, {
        email: user_email,
        password: user_password,
        fullName: user_full_name || name,
        isActive: user_is_active,
      });
    }

    res.status(201).json({
      data: {
        ...professional,
        user_id: professionalUser?.id ?? null,
        user_email: professionalUser?.email ?? null,
        user_full_name: professionalUser?.full_name ?? null,
        user_is_active: professionalUser?.is_active ?? null,
        has_login: Boolean(professionalUser?.id),
      },
    });
  } catch (err) {
    logger.error('Error creating professional:', err);
    if (typeof err === 'object' && err && 'code' in err && err.code === '23505') {
      res.status(409).json({ error: 'The professional login email is already in use' });
      return;
    }
    res.status(500).json({ error: 'Failed to create professional' });
  }
});

professionalsRouter.put('/:id', validateBody(updateProfessionalSchema), async (req, res) => {
  const id = req.params.id as string;
  const sessionProfessionalId = getSessionProfessionalId(req);
  const {
    name,
    specialty,
    calendar_id,
    color_hex,
    is_active,
    user_email,
    user_password,
    user_full_name,
    user_is_active,
  } = req.body;

  if (req.user?.role === 'professional' && sessionProfessionalId !== id) {
    res.status(403).json({ error: 'Professional users can only update their own profile' });
    return;
  }

  if (req.user?.role === 'professional' && (user_email !== undefined || user_password !== undefined || user_is_active !== undefined)) {
    res.status(403).json({ error: 'Professional users cannot manage login credentials' });
    return;
  }

  try {
    if (calendar_id) {
      const calendarValidationError = await validateCalendarId(calendar_id, id);
      if (calendarValidationError) {
        res.status(400).json({ error: calendarValidationError });
        return;
      }
    }

    const result = await pool.query<Professional>(
      `UPDATE professionals
       SET name = COALESCE($1, name),
           specialty = COALESCE($2, specialty),
           calendar_id = COALESCE($3, calendar_id),
           color_hex = COALESCE($4, color_hex),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6 AND company_id = $7
       RETURNING *`,
      [name, specialty, calendar_id, color_hex, is_active, id, getRequestCompanyId(req)]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Professional not found' });
      return;
    }

    if (calendar_id) {
      await pool.query(
        `INSERT INTO google_calendar_connections (company_id, professional_id, calendar_id, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (professional_id)
         DO UPDATE SET calendar_id = $3, is_active = true, updated_at = NOW()`,
        [getRequestCompanyId(req), id, calendar_id]
      );
    }

    if (req.user?.role !== 'professional' && (user_email !== undefined || user_password !== undefined || user_full_name !== undefined || user_is_active !== undefined)) {
      const existingUser = await pool.query<User>(
        `SELECT id, company_id, professional_id, email, full_name, role, is_active, created_at, updated_at
         FROM users
         WHERE company_id = $1 AND professional_id = $2
         LIMIT 1`,
        [getRequestCompanyId(req), id]
      );

      if (existingUser.rows[0]) {
        const nextPasswordHash = user_password
          ? await Bun.password.hash(user_password, { algorithm: 'bcrypt', cost: 12 })
          : null;

        await pool.query(
          `UPDATE users
           SET email = COALESCE($1, email),
               full_name = COALESCE($2, full_name),
               password_hash = COALESCE($3, password_hash),
               is_active = COALESCE($4, is_active),
               updated_at = NOW()
           WHERE id = $5`,
          [user_email, user_full_name, nextPasswordHash, user_is_active, existingUser.rows[0].id]
        );
      } else if (user_email && user_password) {
        await createProfessionalUser(getRequestCompanyId(req)!, id, {
          email: user_email,
          password: user_password,
          fullName: user_full_name || result.rows[0].name,
          isActive: user_is_active ?? true,
        });
      }
    }

    const enriched = await pool.query<ProfessionalRow>(
      `SELECT p.*,
             u.id AS user_id,
             u.email AS user_email,
             u.full_name AS user_full_name,
             (u.id IS NOT NULL) AS has_login,
             u.is_active AS user_is_active
       FROM professionals p
       LEFT JOIN users u ON u.professional_id = p.id
       WHERE p.id = $1 AND p.company_id = $2
       LIMIT 1`,
      [id, getRequestCompanyId(req)]
    );
    res.json({ data: enriched.rows[0] ?? result.rows[0] });
  } catch (err) {
    logger.error('Error updating professional:', err);
    if (typeof err === 'object' && err && 'code' in err && err.code === '23505') {
      res.status(409).json({ error: 'The professional login email is already in use' });
      return;
    }
    res.status(500).json({ error: 'Failed to update professional' });
  }
});

professionalsRouter.delete('/:id', async (req, res) => {
  if (req.user?.role === 'professional') {
    res.status(403).json({ error: 'Professional users cannot delete professionals' });
    return;
  }

  try {
    await pool.query(
      'DELETE FROM users WHERE professional_id = $1 AND company_id = $2',
      [req.params.id, getRequestCompanyId(req)]
    );
    const result = await pool.query(
      'DELETE FROM professionals WHERE id = $1 AND company_id = $2 RETURNING id',
      [req.params.id, getRequestCompanyId(req)]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Professional not found' });
      return;
    }
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error('Error deleting professional:', err);
    res.status(500).json({ error: 'Failed to delete professional' });
  }
});
