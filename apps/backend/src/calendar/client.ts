import { google, calendar_v3 } from 'googleapis';
import { pool } from '../db/pool';
import { config } from '../config';
import { logger } from '../utils/logger';
import { getGoogleConnectionSchema } from './connection-schema';

type ProfessionalCalendarConnection = {
  professional_id: string;
  refresh_token: string | null;
  calendar_id: string;
  google_account_email: string | null;
};

function createOAuthClient() {
  return new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri
  );
}

const cachedRefreshTokens = new Map<string, string>();

async function loadLegacyRefreshToken(): Promise<string | null> {
  try {
    const result = await pool.query<{ value: string }>(
      "SELECT value FROM bot_config WHERE key = 'google_refresh_token'"
    );
    return result.rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

async function loadProfessionalConnection(professionalId: string): Promise<ProfessionalCalendarConnection | null> {
  const schema = await getGoogleConnectionSchema();
  const result = await pool.query<ProfessionalCalendarConnection>(
    `SELECT professional_id,
            ${schema.hasRefreshToken ? 'refresh_token' : 'NULL::text AS refresh_token'},
            calendar_id,
            ${schema.hasGoogleAccountEmail ? 'google_account_email' : 'NULL::text AS google_account_email'}
     FROM google_calendar_connections
     WHERE professional_id = $1
     LIMIT 1`,
    [professionalId]
  );
  return result.rows[0] ?? null;
}

async function loadRefreshToken(professionalId?: string | null): Promise<string | null> {
  if (professionalId && cachedRefreshTokens.has(professionalId)) {
    return cachedRefreshTokens.get(professionalId) ?? null;
  }

  if (professionalId) {
    const connection = await loadProfessionalConnection(professionalId);
    if (connection?.refresh_token) {
      cachedRefreshTokens.set(professionalId, connection.refresh_token);
      return connection.refresh_token;
    }
    return null;
  }

  return loadLegacyRefreshToken();
}

export async function saveRefreshToken(
  professionalId: string | null,
  token: string,
  options?: { googleAccountEmail?: string | null }
): Promise<void> {
  if (professionalId) {
    const schema = await getGoogleConnectionSchema();
    if (!schema.hasRefreshToken) {
      throw new Error('La base actual no soporta guardar refresh_token de Google Calendar.');
    }

    await pool.query(
      `INSERT INTO google_calendar_connections (
         company_id,
         professional_id,
         calendar_id,
         refresh_token${schema.hasGoogleAccountEmail ? ', google_account_email' : ''}${schema.hasTokenUpdatedAt ? ', token_updated_at' : ''},
         is_active
       )
       SELECT company_id, $1, COALESCE(calendar_id, 'primary'), $2${schema.hasGoogleAccountEmail ? ', $3' : ''}${schema.hasTokenUpdatedAt ? ', NOW()' : ''}, true
       FROM professionals
       WHERE id = $1
       ON CONFLICT (professional_id)
       DO UPDATE SET refresh_token = $2,
                     ${schema.hasGoogleAccountEmail ? 'google_account_email = COALESCE($3, google_calendar_connections.google_account_email),' : ''}
                     ${schema.hasTokenUpdatedAt ? 'token_updated_at = NOW(),' : ''}
                     is_active = true,
                     updated_at = NOW()`,
      [professionalId, token, options?.googleAccountEmail ?? null]
    );
    cachedRefreshTokens.set(professionalId, token);
    return;
  }

  await pool.query(
    `INSERT INTO bot_config (key, value, updated_at)
     VALUES ('google_refresh_token', $1, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = $1, updated_at = NOW()`,
    [token]
  );
}

async function buildAuthorizedClient(professionalId?: string | null) {
  const refreshToken = await loadRefreshToken(professionalId);
  if (!refreshToken) {
    throw new Error(
      professionalId
        ? 'Google Calendar refresh token not configured for this professional.'
        : 'Google Calendar refresh token not configured.'
    );
  }

  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      saveRefreshToken(professionalId ?? null, tokens.refresh_token).catch((err) =>
        logger.error('Failed to persist refreshed Google token:', err)
      );
    }
  });

  return oauth2Client;
}

export async function getCalendarClient(professionalId?: string | null): Promise<calendar_v3.Calendar> {
  const auth = await buildAuthorizedClient(professionalId);
  return google.calendar({ version: 'v3', auth });
}

export async function listAccessibleCalendars(professionalId?: string | null): Promise<calendar_v3.Schema$CalendarListEntry[]> {
  const calendar = await getCalendarClient(professionalId);
  const response = await calendar.calendarList.list({ maxResults: 250 });
  return (response.data.items ?? []).filter((item) => !!item.id);
}

export async function hasCalendarAccess(calendarId: string, professionalId?: string | null): Promise<boolean> {
  if (!calendarId) return false;
  const calendars = await listAccessibleCalendars(professionalId);
  return calendars.some((calendar) => calendar.id === calendarId);
}

export async function getGoogleAccountEmail(professionalId?: string | null): Promise<string | null> {
  const auth = await buildAuthorizedClient(professionalId);
  try {
    const oauth = google.oauth2({ version: 'v2', auth });
    const response = await oauth.userinfo.get();
    return response.data.email ?? null;
  } catch (err) {
    logger.warn('Failed to resolve Google account email:', err);
    return null;
  }
}

export { createOAuthClient };
