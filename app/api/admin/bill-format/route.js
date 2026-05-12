export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson, fail } from '@/lib/api';
import { ensureCompanyProfileSchema } from '@/lib/migrations';

const FIELDS = [
  'bill_number_template',
  'bill_number_prefix',
  'bill_number_seq_digits',
  'bill_number_seq_reset',
  'bill_number_start',
];

const RESET_OPTIONS = new Set(['never', 'daily', 'monthly', 'yearly']);

export const GET = handle(async () => {
  await ensureCompanyProfileSchema();
  const result = await pool.query(`SELECT ${FIELDS.join(', ')} FROM company_profile WHERE id = 1`);
  return ok(result.rows[0] || {});
});

export const PUT = handle(async (request) => {
  await ensureCompanyProfileSchema();
  const body = await readJson(request);

  const template = String(body.bill_number_template || '').trim() || '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}';
  const prefix = String(body.bill_number_prefix ?? '').trim();
  const digits = Math.max(1, Math.min(12, parseInt(body.bill_number_seq_digits, 10) || 5));
  const reset = RESET_OPTIONS.has(body.bill_number_seq_reset) ? body.bill_number_seq_reset : 'monthly';
  const start = Math.max(1, parseInt(body.bill_number_start, 10) || 1);

  if (!template.includes('{{seq}}')) {
    return fail(400, 'Template must include {{seq}}');
  }

  const result = await pool.query(
    `UPDATE company_profile SET
       bill_number_template = $1,
       bill_number_prefix = $2,
       bill_number_seq_digits = $3,
       bill_number_seq_reset = $4,
       bill_number_start = $5,
       updated_at = NOW()
     WHERE id = 1
     RETURNING ${FIELDS.join(', ')}`,
    [template, prefix, digits, reset, start]
  );
  return ok(result.rows[0]);
});
