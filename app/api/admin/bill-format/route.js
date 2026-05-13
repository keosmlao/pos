export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson, fail } from '@/lib/api';
import { ensureCompanyProfileSchema } from '@/lib/migrations';
import { DOCUMENT_NUMBER_TYPES, DOCUMENT_NUMBER_DEFAULTS } from '@/lib/billNumber';

const FIELDS = DOCUMENT_NUMBER_TYPES.flatMap((type) => {
  const base = `${type.key}_number`;
  return [
    `${base}_template`,
    `${base}_prefix`,
    `${base}_seq_digits`,
    `${base}_seq_reset`,
    `${base}_start`,
  ];
});

const RESET_OPTIONS = new Set(['never', 'daily', 'monthly', 'yearly']);

export const GET = handle(async () => {
  await ensureCompanyProfileSchema();
  const result = await pool.query(`SELECT ${FIELDS.join(', ')} FROM company_profile WHERE id = 1`);
  return ok(result.rows[0] || {});
});

export const PUT = handle(async (request) => {
  await ensureCompanyProfileSchema();
  const body = await readJson(request);

  const values = [];
  for (const type of DOCUMENT_NUMBER_TYPES) {
    const base = `${type.key}_number`;
    const defaults = type.defaults;
    const templateKey = `${base}_template`;
    const prefixKey = `${base}_prefix`;
    const digitsKey = `${base}_seq_digits`;
    const resetKey = `${base}_seq_reset`;
    const startKey = `${base}_start`;
    const template = String(body[templateKey] || '').trim() || DOCUMENT_NUMBER_DEFAULTS[templateKey] || '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}';
    if (!template.includes('{{seq}}')) {
      return fail(400, `${type.label} template must include {{seq}}`);
    }
    values.push(
      template,
      String(body[prefixKey] ?? defaults[prefixKey] ?? '').trim(),
      Math.max(1, Math.min(12, parseInt(body[digitsKey], 10) || defaults[digitsKey] || 4)),
      RESET_OPTIONS.has(body[resetKey]) ? body[resetKey] : (defaults[resetKey] || 'monthly'),
      Math.max(1, parseInt(body[startKey], 10) || defaults[startKey] || 1)
    );
  }

  const setters = FIELDS.map((field, i) => `${field} = $${i + 1}`).join(',\n       ');

  const result = await pool.query(
    `UPDATE company_profile SET
       ${setters},
       updated_at = NOW()
     WHERE id = 1
     RETURNING ${FIELDS.join(', ')}`,
    values
  );
  return ok(result.rows[0]);
});
