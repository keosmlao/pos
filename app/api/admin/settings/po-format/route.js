export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson } from '@/lib/api';
import { ensureCompanyProfileSchema } from '@/lib/migrations';

function normalizeTemplate(format) {
  return String(format || '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}')
    .replaceAll('{YYYY}', '{{YYYY}}')
    .replaceAll('{YY}', '{{YY}}')
    .replaceAll('{MM}', '{{MM}}')
    .replaceAll('{DD}', '{{DD}}')
    .replaceAll('{NNNN}', '{{seq}}')
    .replaceAll('{NNN}', '{{seq}}')
    .replaceAll('{NN}', '{{seq}}');
}

export const GET = handle(async () => {
  await ensureCompanyProfileSchema();
  const result = await pool.query("SELECT purchase_number_template FROM company_profile WHERE id = 1");
  const format = result.rows[0]?.purchase_number_template || '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}';
  return ok({ format });
});

export const PUT = handle(async (request) => {
  await ensureCompanyProfileSchema();
  const { format } = await readJson(request);
  const template = normalizeTemplate(format);
  await pool.query(
    "UPDATE company_profile SET purchase_number_template = $1, updated_at = NOW() WHERE id = 1",
    [template]
  );
  return ok({ format: template });
});
