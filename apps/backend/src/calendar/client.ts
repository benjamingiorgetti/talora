import { google, calendar_v3 } from 'googleapis';
import { pool } from '../db/pool';
import { config } from '../config';

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

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export { oauth2Client };
