import { pool } from '../db/pool';

export type GoogleConnectionSchema = {
  hasRefreshToken: boolean;
  hasGoogleAccountEmail: boolean;
  hasTokenUpdatedAt: boolean;
};

let cachedSchema: GoogleConnectionSchema | null = null;

export async function getGoogleConnectionSchema(): Promise<GoogleConnectionSchema> {
  if (cachedSchema) {
    return cachedSchema;
  }

  const result = await pool.query<{ column_name: string }>(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'google_calendar_connections'`
  );

  const columns = new Set(result.rows.map((row) => row.column_name));
  cachedSchema = {
    hasRefreshToken: columns.has('refresh_token'),
    hasGoogleAccountEmail: columns.has('google_account_email'),
    hasTokenUpdatedAt: columns.has('token_updated_at'),
  };

  return cachedSchema;
}
