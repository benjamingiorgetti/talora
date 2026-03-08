import { google, calendar_v3 } from 'googleapis';
import { pool } from '../db/pool';
import { config } from '../config';
import { logger } from '../utils/logger';

const oauth2Client = new google.auth.OAuth2(
  config.googleClientId,
  config.googleClientSecret,
  config.googleRedirectUri
);

// Cache refresh token in memory to avoid DB query on every calendar call
let cachedRefreshToken: string | null = null;

async function loadRefreshToken(): Promise<string | null> {
  if (cachedRefreshToken) return cachedRefreshToken;
  try {
    const result = await pool.query<{ value: string }>(
      "SELECT value FROM bot_config WHERE key = 'google_refresh_token'"
    );
    if (result.rows.length > 0) {
      cachedRefreshToken = result.rows[0].value;
      return cachedRefreshToken;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveRefreshToken(token: string): Promise<void> {
  await pool.query(
    `INSERT INTO bot_config (key, value, updated_at)
     VALUES ('google_refresh_token', $1, NOW())
     ON CONFLICT (key)
     DO UPDATE SET value = $1, updated_at = NOW()`,
    [token]
  );
  cachedRefreshToken = token;
}

export async function getCalendarClient(): Promise<calendar_v3.Calendar> {
  const refreshToken = await loadRefreshToken();
  if (!refreshToken) {
    throw new Error('Google Calendar refresh token not configured. Set it in bot_config table.');
  }

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // Listen for token refresh failures (e.g., revoked or expired refresh token)
  oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      // Google issued a new refresh token — persist it
      saveRefreshToken(tokens.refresh_token).catch((err) =>
        logger.error('Failed to persist new refresh token:', err)
      );
    }
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Wrap the calendar in a proxy that catches 401 auth errors
  return new Proxy(calendar, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'object' && value !== null) {
        return new Proxy(value, {
          get(innerTarget, innerProp, innerReceiver) {
            const method = Reflect.get(innerTarget, innerProp, innerReceiver);
            if (typeof method === 'function') {
              return async (...args: unknown[]) => {
                try {
                  return await method.apply(innerTarget, args);
                } catch (err: unknown) {
                  const status = (err as { code?: number }).code;
                  if (status === 401) {
                    // Clear cached token so next attempt reloads from DB
                    cachedRefreshToken = null;
                    logger.error(
                      'Google Calendar API returned 401 Unauthorized. ' +
                      'The refresh token may be expired or revoked. ' +
                      'Re-authorize via /auth/google/connect to restore calendar access.'
                    );
                  }
                  throw err;
                }
              };
            }
            return method;
          },
        });
      }
      return value;
    },
  });
}

export { oauth2Client };
