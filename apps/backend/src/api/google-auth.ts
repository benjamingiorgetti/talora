import crypto from 'crypto';
import { google } from 'googleapis';
import { Router } from 'express';
import { createOAuthClient, getCalendarClient, saveRefreshToken } from '../calendar/client';
import { config } from '../config';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { authMiddleware, getRequestCompanyId, getRequestProfessionalId } from './middleware';
import { getGoogleConnectionSchema } from '../calendar/connection-schema';

export const googleAuthRouter = Router();

const pendingStates = new Map<string, { createdAt: number; returnTo: string; professionalId: string | null }>();
const STATE_TTL_MS = 10 * 60 * 1000;

function normalizeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/dashboard';
  }
  return value;
}

function resolveTargetProfessionalId(req: Parameters<typeof authMiddleware>[0]): string | null {
  if (req.user?.role === 'professional') {
    return req.user.professionalId ?? null;
  }

  return typeof req.query.professional_id === 'string'
    ? req.query.professional_id
    : getRequestProfessionalId(req);
}

setInterval(() => {
  const now = Date.now();
  for (const [state, entry] of pendingStates) {
    if (now - entry.createdAt > STATE_TTL_MS) {
      pendingStates.delete(state);
    }
  }
}, 5 * 60 * 1000);

googleAuthRouter.get('/google', authMiddleware, async (req, res) => {
  const professionalId = resolveTargetProfessionalId(req);
  if (!professionalId) {
    res.status(400).json({ error: 'professional_id is required to connect Google Calendar' });
    return;
  }

  const state = crypto.randomUUID();
  pendingStates.set(state, {
    createdAt: Date.now(),
    returnTo: normalizeReturnTo(req.query.return_to),
    professionalId,
  });

  const oauth2Client = createOAuthClient();
  const scopes = ['https://www.googleapis.com/auth/calendar'];
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state,
  });
  res.redirect(url);
});

googleAuthRouter.get('/google/callback', async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;

  if (!code) {
    res.status(400).json({ error: 'Missing authorization code' });
    return;
  }

  if (!state || !pendingStates.has(state)) {
    res.status(403).json({ error: 'Invalid or expired OAuth state' });
    return;
  }

  const pending = pendingStates.get(state)!;
  pendingStates.delete(state);

  if (Date.now() - pending.createdAt > STATE_TTL_MS) {
    res.status(403).json({ error: 'OAuth state expired' });
    return;
  }

  try {
    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    if (pending.professionalId && tokens.refresh_token) {
      const googleAccountEmail = await (async () => {
        try {
          const oauth = google.oauth2({ version: 'v2', auth: oauth2Client });
          const response = await oauth.userinfo.get();
          return response.data.email ?? null;
        } catch {
          return null;
        }
      })();

      await saveRefreshToken(pending.professionalId, tokens.refresh_token, { googleAccountEmail });
      logger.info(`Google Calendar refresh token saved for professional ${pending.professionalId}`);
    }

    const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
    const separator = pending.returnTo.includes('?') ? '&' : '?';
    res.redirect(`${frontendUrl}${pending.returnTo}${separator}calendar=connected`);
  } catch (err) {
    logger.error('Google OAuth error:', err);
    const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
    const separator = pending.returnTo.includes('?') ? '&' : '?';
    res.redirect(`${frontendUrl}${pending.returnTo}${separator}calendar=error`);
  }
});

googleAuthRouter.get('/google/status', authMiddleware, async (req, res) => {
  const configured = !!(config.googleClientId && config.googleClientSecret);
  const companyId = getRequestCompanyId(req);
  const professionalId = resolveTargetProfessionalId(req);

  try {
    const schema = await getGoogleConnectionSchema();
    if (professionalId) {
      const result = await pool.query<{
        refresh_token: string | null;
        calendar_id: string | null;
        google_account_email: string | null;
      }>(
        `SELECT ${schema.hasRefreshToken ? 'refresh_token' : 'NULL::text AS refresh_token'},
                calendar_id,
                ${schema.hasGoogleAccountEmail ? 'google_account_email' : 'NULL::text AS google_account_email'}
         FROM google_calendar_connections
         WHERE professional_id = $1
         LIMIT 1`,
        [professionalId]
      );

      const connection = result.rows[0];
      res.json({
        configured,
        connected: Boolean(connection?.refresh_token),
        professional_id: professionalId,
        calendar_id: connection?.calendar_id ?? null,
        google_account_email: connection?.google_account_email ?? null,
      });
      return;
    }

    const result = companyId
      ? await pool.query<{
          professional_count: string;
          connected_professional_count: string;
        }>(
          `SELECT
              (SELECT COUNT(*)::text FROM professionals WHERE company_id = $1 AND is_active = true) AS professional_count,
              (SELECT COUNT(*)::text
               FROM google_calendar_connections gcc
               JOIN professionals p ON p.id = gcc.professional_id
               WHERE gcc.company_id = $1
                 AND gcc.is_active = true
                 AND ${schema.hasRefreshToken ? 'gcc.refresh_token IS NOT NULL' : 'false'}
                 AND p.is_active = true) AS connected_professional_count`,
          [companyId]
        )
      : null;

    res.json({
      configured,
      connected: Number(result?.rows[0]?.connected_professional_count ?? 0) > 0,
      company_id: companyId ?? null,
      professional_count: Number(result?.rows[0]?.professional_count ?? 0),
      connected_professional_count: Number(result?.rows[0]?.connected_professional_count ?? 0),
    });
  } catch (err) {
    logger.error('Error checking Google Calendar status:', err);
    res.status(500).json({ error: 'Failed to check Google Calendar status' });
  }
});

googleAuthRouter.get('/google/calendars', authMiddleware, async (req, res) => {
  const configured = !!(config.googleClientId && config.googleClientSecret);
  const companyId = getRequestCompanyId(req);
  const professionalId = resolveTargetProfessionalId(req);

  try {
    const schema = await getGoogleConnectionSchema();
    let calendars: Array<{
      id: string;
      summary: string;
      primary: boolean;
      access_role: string;
      background_color: string | null;
    }> = [];

    let connected = false;
    if (professionalId) {
      const calendar = await getCalendarClient(professionalId);
      const calendarsResponse = await calendar.calendarList.list({ maxResults: 250 });
      calendars = (calendarsResponse.data.items ?? []).map((item) => ({
        id: item.id ?? '',
        summary: item.summary ?? item.id ?? 'Sin nombre',
        primary: Boolean(item.primary),
        access_role: item.accessRole ?? 'reader',
        background_color: item.backgroundColor ?? null,
      })).filter((item) => item.id);
      connected = calendars.length > 0;
    }

    const professionals = companyId
      ? await pool.query<{
          id: string;
          name: string;
          specialty: string | null;
          calendar_id: string;
          google_account_email: string | null;
          is_connected: boolean;
        }>(
          `SELECT p.id,
                  p.name,
                  p.specialty,
                  p.calendar_id,
                  ${schema.hasGoogleAccountEmail ? 'gcc.google_account_email' : 'NULL::text AS google_account_email'},
                  (${schema.hasRefreshToken ? 'gcc.refresh_token IS NOT NULL' : 'false'}) AS is_connected
           FROM professionals p
           LEFT JOIN google_calendar_connections gcc ON gcc.professional_id = p.id
           WHERE p.company_id = $1 AND p.is_active = true
           ORDER BY p.name ASC`,
          [companyId]
        )
      : null;

    res.json({
      data: {
        configured,
        connected,
        professional_id: professionalId ?? null,
        calendars,
        professionals: professionals?.rows ?? [],
      },
    });
  } catch (err) {
    logger.error('Error listing Google calendars:', err);
    res.status(500).json({ error: 'Failed to list Google calendars' });
  }
});

googleAuthRouter.post('/google/disconnect', authMiddleware, async (req, res) => {
  const professionalId = resolveTargetProfessionalId(req);
  if (!professionalId) {
    res.status(400).json({ error: 'professional_id is required' });
    return;
  }

  try {
    const schema = await getGoogleConnectionSchema();
    const updates = ['is_active = false', 'updated_at = NOW()'];
    if (schema.hasRefreshToken) updates.push('refresh_token = NULL');
    if (schema.hasGoogleAccountEmail) updates.push('google_account_email = NULL');
    if (schema.hasTokenUpdatedAt) updates.push('token_updated_at = NULL');

    await pool.query(
      `UPDATE google_calendar_connections
       SET ${updates.join(', ')}
       WHERE professional_id = $1`,
      [professionalId]
    );
    res.json({ data: { success: true } });
  } catch (err) {
    logger.error('Error disconnecting Google calendar:', err);
    res.status(500).json({ error: 'Failed to disconnect Google calendar' });
  }
});
