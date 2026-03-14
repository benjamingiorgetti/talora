import { Router } from 'express';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { authMiddleware, getRequestCompanyId, requireCompanyScope, requireSuperadmin } from './middleware';
import type { CompanySettings } from '@talora/shared';

export const companySettingsRouter = Router();

companySettingsRouter.use(authMiddleware, requireSuperadmin, requireCompanyScope);

const DEFAULTS: Omit<CompanySettings, 'id' | 'company_id' | 'created_at' | 'updated_at'> = {
  opening_hour: '09:00',
  closing_hour: '18:00',
  working_days: [1, 2, 3, 4, 5],
  show_prices: false,
  timezone: 'America/Argentina/Buenos_Aires',
};

// GET / — returns settings for the company, or defaults if none exist
companySettingsRouter.get('/', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req)!;
    const result = await pool.query<CompanySettings>(
      'SELECT * FROM company_settings WHERE company_id = $1',
      [companyId]
    );
    if (result.rows.length === 0) {
      res.json({
        data: {
          id: null,
          company_id: companyId,
          ...DEFAULTS,
          created_at: null,
          updated_at: null,
        },
      });
      return;
    }
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error loading company settings:', err);
    res.status(500).json({ error: 'Failed to load company settings' });
  }
});

// PUT / — upsert settings
companySettingsRouter.put('/', async (req, res) => {
  try {
    const companyId = getRequestCompanyId(req)!;
    const { opening_hour, closing_hour, working_days, show_prices, timezone } = req.body;

    const result = await pool.query<CompanySettings>(
      `INSERT INTO company_settings (company_id, opening_hour, closing_hour, working_days, show_prices, timezone)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (company_id) DO UPDATE SET
         opening_hour = EXCLUDED.opening_hour,
         closing_hour = EXCLUDED.closing_hour,
         working_days = EXCLUDED.working_days,
         show_prices = EXCLUDED.show_prices,
         timezone = EXCLUDED.timezone,
         updated_at = NOW()
       RETURNING *`,
      [
        companyId,
        opening_hour ?? DEFAULTS.opening_hour,
        closing_hour ?? DEFAULTS.closing_hour,
        working_days ?? DEFAULTS.working_days,
        show_prices ?? DEFAULTS.show_prices,
        timezone ?? DEFAULTS.timezone,
      ]
    );
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Error saving company settings:', err);
    res.status(500).json({ error: 'Failed to save company settings' });
  }
});
