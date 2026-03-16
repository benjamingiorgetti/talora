import { pool } from '../db/pool';

export async function getConnectedInstance(
  companyId: string
): Promise<{ evolution_instance_name: string; phone_number: string | null } | null> {
  const result = await pool.query<{ evolution_instance_name: string; phone_number: string | null }>(
    `SELECT evolution_instance_name, phone_number FROM whatsapp_instances WHERE company_id = $1 AND status = 'connected' LIMIT 1`,
    [companyId]
  );
  return result.rows[0] ?? null;
}
