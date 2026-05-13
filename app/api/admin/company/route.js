export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson } from '@/lib/api';
import { ensureCompanyProfileSchema } from '@/lib/migrations';

export const GET = handle(async () => {
  await ensureCompanyProfileSchema();
  const result = await pool.query('SELECT * FROM company_profile WHERE id = 1');
  return ok(result.rows[0] || null);
});

const VALID_COSTING = new Set(['FIFO', 'LIFO', 'AVG', 'LAST']);
const VALID_VAT_MODES = new Set(['exclusive', 'inclusive']);
const VALID_ROUNDING_MODES = new Set(['none', 'nearest', 'up', 'down']);

export const PUT = handle(async (request) => {
  await ensureCompanyProfileSchema();
  const body = await readJson(request);
  const {
    name, slogan, tax_id, business_reg_no, address, phone, email, logo_url, bank_accounts, default_costing_method,
    vat_enabled, vat_rate, vat_mode, vat_label,
    rounding_mode, rounding_step,
  } = body;
  const accounts = Array.isArray(bank_accounts)
    ? bank_accounts
        .map((a) => ({
          bank_name: String(a?.bank_name || '').trim(),
          account_name: String(a?.account_name || '').trim(),
          account_number: String(a?.account_number || '').trim(),
        }))
        .filter((a) => a.bank_name || a.account_name || a.account_number)
    : [];

  const cm = default_costing_method && VALID_COSTING.has(String(default_costing_method).toUpperCase())
    ? String(default_costing_method).toUpperCase()
    : 'AVG';

  const vatEnabled = !!vat_enabled;
  const vatMode = VALID_VAT_MODES.has(String(vat_mode)) ? String(vat_mode) : 'exclusive';
  const vatRate = Math.max(0, Math.min(100, Number(vat_rate) || 0));
  const vatLabel = String(vat_label || 'VAT').trim().slice(0, 30) || 'VAT';

  const roundingMode = VALID_ROUNDING_MODES.has(String(rounding_mode)) ? String(rounding_mode) : 'none';
  const roundingStep = Math.max(0, Number(rounding_step) || 0);

  const result = await pool.query(
    `INSERT INTO company_profile
       (id, name, slogan, tax_id, business_reg_no, address, phone, email, logo_url, bank_accounts,
        default_costing_method, vat_enabled, vat_rate, vat_mode, vat_label, rounding_mode, rounding_step, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       slogan = EXCLUDED.slogan,
       tax_id = EXCLUDED.tax_id,
       business_reg_no = EXCLUDED.business_reg_no,
       address = EXCLUDED.address,
       phone = EXCLUDED.phone,
       email = EXCLUDED.email,
       logo_url = EXCLUDED.logo_url,
       bank_accounts = EXCLUDED.bank_accounts,
       default_costing_method = EXCLUDED.default_costing_method,
       vat_enabled = EXCLUDED.vat_enabled,
       vat_rate = EXCLUDED.vat_rate,
       vat_mode = EXCLUDED.vat_mode,
       vat_label = EXCLUDED.vat_label,
       rounding_mode = EXCLUDED.rounding_mode,
       rounding_step = EXCLUDED.rounding_step,
       updated_at = NOW()
     RETURNING *`,
    [
      name || null,
      slogan || null,
      tax_id || null,
      business_reg_no || null,
      address || null,
      phone || null,
      email || null,
      logo_url || null,
      JSON.stringify(accounts),
      cm,
      vatEnabled,
      vatRate,
      vatMode,
      vatLabel,
      roundingMode,
      roundingStep,
    ]
  );
  return ok(result.rows[0]);
});
