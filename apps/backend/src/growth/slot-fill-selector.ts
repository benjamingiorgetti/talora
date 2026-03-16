import { pool } from '../db/pool';

export interface SelectorInput {
  companyId: string;
  serviceId: string;
  professionalId: string | null;
  startsAt: string;
  cancelledClientId: string | null;
  maxCandidates?: number;
}

export interface ScoredCandidate {
  client_id: string;
  client_name: string;
  client_phone: string;
  score: number;
  match_reasons: string[];
  days_overdue: number;
}

interface CandidateRow {
  client_id: string;
  client_name: string;
  client_phone: string;
  has_same_service: boolean;
  has_same_professional: boolean;
  preferred_weekday: number | null;
  preferred_hour: number | null;
  days_overdue: number;
}

function isWithinTimeWindow(slotHour: number, preferredHour: number, windowHours: number): boolean {
  return Math.abs(slotHour - preferredHour) <= windowHours;
}

function scoreCandidate(row: CandidateRow, slotWeekday: number, slotHour: number): ScoredCandidate {
  let score = 0;
  const match_reasons: string[] = [];

  if (row.has_same_service) {
    score += 50;
    match_reasons.push('same_service');
  }
  if (row.has_same_professional) {
    score += 20;
    match_reasons.push('same_professional');
  }
  if (row.preferred_weekday !== null && row.preferred_weekday === slotWeekday) {
    score += 25;
    match_reasons.push('same_weekday');
  }
  if (row.preferred_hour !== null && isWithinTimeWindow(slotHour, row.preferred_hour, 2)) {
    score += 15;
    match_reasons.push('same_time_window');
  }

  const overdueBonus = Math.min(Math.max(Math.floor((row.days_overdue ?? 0) / 3), 0), 10);
  if (overdueBonus > 0) {
    score += overdueBonus;
    match_reasons.push('overdue');
  }

  return {
    client_id: row.client_id,
    client_name: row.client_name,
    client_phone: row.client_phone,
    score,
    match_reasons,
    days_overdue: row.days_overdue,
  };
}

export async function selectSlotFillCandidates(input: SelectorInput): Promise<ScoredCandidate[]> {
  const { companyId, serviceId, professionalId, startsAt, cancelledClientId, maxCandidates = 3 } = input;

  const slotDate = new Date(startsAt);
  const slotWeekday = slotDate.getUTCDay();
  const slotHour = slotDate.getUTCHours();

  const rows = await pool.query<CandidateRow>(
    `WITH candidate_pool AS (
      SELECT DISTINCT c.id AS client_id,
        c.name AS client_name,
        c.phone_number AS client_phone,
        EXISTS (
          SELECT 1 FROM appointments a2
          WHERE a2.client_id = c.id AND a2.service_id = $2 AND a2.status = 'confirmed'
        ) AS has_same_service,
        EXISTS (
          SELECT 1 FROM appointments a3
          WHERE a3.client_id = c.id AND a3.professional_id = $3 AND a3.status = 'confirmed'
        ) AS has_same_professional,
        (
          SELECT EXTRACT(DOW FROM a4.starts_at)::int
          FROM appointments a4
          WHERE a4.client_id = c.id AND a4.company_id = $1 AND a4.status = 'confirmed'
          GROUP BY EXTRACT(DOW FROM a4.starts_at)
          ORDER BY COUNT(*) DESC LIMIT 1
        ) AS preferred_weekday,
        (
          SELECT EXTRACT(HOUR FROM a5.starts_at)::int
          FROM appointments a5
          WHERE a5.client_id = c.id AND a5.company_id = $1 AND a5.status = 'confirmed'
          GROUP BY EXTRACT(HOUR FROM a5.starts_at)
          ORDER BY COUNT(*) DESC LIMIT 1
        ) AS preferred_hour,
        COALESCE(ca.days_overdue, 0)::int AS days_overdue
      FROM clients c
      JOIN appointments a ON a.client_id = c.id AND a.company_id = $1 AND a.status = 'confirmed'
      LEFT JOIN client_analytics ca ON ca.client_id = c.id
      WHERE c.company_id = $1
        AND c.is_active = true
        AND ($4::uuid IS NULL OR c.id != $4)
        AND NOT EXISTS (
          SELECT 1 FROM reactivation_messages rm
          WHERE rm.client_id = c.id
            AND rm.sent_at >= NOW() - INTERVAL '7 days'
            AND rm.status IN ('sent', 'converted')
        )
    )
    SELECT * FROM candidate_pool
    WHERE days_overdue >= 3`,
    [companyId, serviceId, professionalId, cancelledClientId]
  );

  if (rows.rows.length === 0) return [];

  // Score all candidates
  const scored = rows.rows.map(row => scoreCandidate(row, slotWeekday, slotHour));

  // Fallback logic: if any candidate has same_service, filter to only those
  const hasSameService = scored.some(c => c.match_reasons.includes('same_service'));
  const filtered = hasSameService
    ? scored.filter(c => c.match_reasons.includes('same_service'))
    : scored;

  // Sort by score DESC, take top N
  filtered.sort((a, b) => b.score - a.score);
  return filtered.slice(0, maxCandidates);
}

// Exported for testing
export { isWithinTimeWindow, scoreCandidate };
