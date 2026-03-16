import { pool } from '../db/pool';
import type { Company } from '@talora/shared';
import { getGoogleConnectionSchema } from '../calendar/connection-schema';

export interface CompanyOverview extends Company {
  admin_count: number;
  professional_count: number;
  service_count: number;
  instance_count: number;
  connected_instance_count: number;
  calendar_connection_count: number;
  google_oauth_connected: boolean;
  whatsapp_connected: boolean;
  setup_ready: boolean;
  setup_progress: number;
}

type CompanyOverviewRow = Company & {
  admin_count: string;
  professional_count: string;
  service_count: string;
  instance_count: string;
  connected_instance_count: string;
  calendar_connection_count: string;
  google_oauth_connected: boolean;
};

function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

function computeSetupProgress(row: {
  admin_count: number;
  professional_count: number;
  service_count: number;
  instance_count: number;
  calendar_connection_count: number;
  google_oauth_connected: boolean;
}): number {
  const steps = [
    row.admin_count > 0,
    row.professional_count > 0,
    row.service_count > 0,
    row.instance_count > 0,
    row.google_oauth_connected && row.calendar_connection_count >= Math.max(1, row.professional_count),
  ];
  const completed = steps.filter(Boolean).length;
  return Math.round((completed / steps.length) * 100);
}

function mapOverview(row: CompanyOverviewRow): CompanyOverview {
  const adminCount = toNumber(row.admin_count);
  const professionalCount = toNumber(row.professional_count);
  const serviceCount = toNumber(row.service_count);
  const instanceCount = toNumber(row.instance_count);
  const connectedInstanceCount = toNumber(row.connected_instance_count);
  const calendarConnectionCount = toNumber(row.calendar_connection_count);
  const googleOauthConnected = Boolean(row.google_oauth_connected);
  const calendarConnected = googleOauthConnected && calendarConnectionCount >= Math.max(1, professionalCount);
  const whatsappConnected = connectedInstanceCount > 0;

  return {
    ...row,
    admin_count: adminCount,
    professional_count: professionalCount,
    service_count: serviceCount,
    instance_count: instanceCount,
    connected_instance_count: connectedInstanceCount,
    calendar_connection_count: calendarConnectionCount,
    google_oauth_connected: googleOauthConnected,
    calendar_connected: calendarConnected,
    whatsapp_connected: whatsappConnected,
    setup_ready: professionalCount > 0 && serviceCount > 0 && instanceCount > 0 && calendarConnected,
    setup_progress: computeSetupProgress({
      admin_count: adminCount,
      professional_count: professionalCount,
      service_count: serviceCount,
      instance_count: instanceCount,
      calendar_connection_count: calendarConnectionCount,
      google_oauth_connected: googleOauthConnected,
    }),
  };
}

const COMPANY_OVERVIEW_QUERY = `
  SELECT c.*,
         COALESCE(admin_stats.admin_count, 0)::text AS admin_count,
         COALESCE(professional_stats.professional_count, 0)::text AS professional_count,
         COALESCE(service_stats.service_count, 0)::text AS service_count,
         COALESCE(instance_stats.instance_count, 0)::text AS instance_count,
         COALESCE(instance_stats.connected_instance_count, 0)::text AS connected_instance_count,
         COALESCE(calendar_stats.calendar_connection_count, 0)::text AS calendar_connection_count,
         (COALESCE(calendar_stats.calendar_connection_count, 0) > 0) AS google_oauth_connected
  FROM companies c
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS admin_count
    FROM users u
    WHERE u.company_id = c.id
      AND u.role = 'admin_empresa'
      AND u.is_active = true
  ) AS admin_stats ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS professional_count
    FROM professionals p
    WHERE p.company_id = c.id
      AND p.is_active = true
  ) AS professional_stats ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS service_count
    FROM services s
    WHERE s.company_id = c.id
      AND s.is_active = true
  ) AS service_stats ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS instance_count,
           COUNT(*) FILTER (WHERE wi.status = 'connected') AS connected_instance_count
    FROM whatsapp_instances wi
    WHERE wi.company_id = c.id
  ) AS instance_stats ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS calendar_connection_count
    FROM google_calendar_connections gcc
    JOIN professionals p ON p.id = gcc.professional_id
    WHERE gcc.company_id = c.id
      AND gcc.is_active = true
      AND NULLIF(gcc.refresh_token, '') IS NOT NULL
      AND p.is_active = true
  ) AS calendar_stats ON true
`;

function buildQuery(schema: { hasRefreshToken: boolean }): string {
  const refreshFilter = schema.hasRefreshToken ? "NULLIF(gcc.refresh_token, '') IS NOT NULL" : 'false';
  return COMPANY_OVERVIEW_QUERY.replace(/NULLIF\(gcc\.refresh_token, ''\) IS NOT NULL/g, refreshFilter);
}

export async function listCompanyOverviews(): Promise<CompanyOverview[]> {
  const schema = await getGoogleConnectionSchema();
  const result = await pool.query<CompanyOverviewRow>(
    `${buildQuery(schema)} ORDER BY c.created_at DESC`
  );
  return result.rows.map(mapOverview);
}

export async function getCompanyOverview(companyId: string): Promise<CompanyOverview | null> {
  const schema = await getGoogleConnectionSchema();
  const result = await pool.query<CompanyOverviewRow>(
    `${buildQuery(schema)} WHERE c.id = $1 LIMIT 1`,
    [companyId]
  );
  const row = result.rows[0];
  return row ? mapOverview(row) : null;
}
