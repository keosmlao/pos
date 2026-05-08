export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureCurrenciesSchema } from '@/lib/migrations';

export const PUT = handle(async (request, { params }) => {
  await ensureCurrenciesSchema();
  const { code } = await params;
  const { symbol, name, rate, enabled, sort_order } = await readJson(request);
  const fields = [];
  const values = [];
  let i = 1;
  if (symbol !== undefined) { fields.push(`symbol = $${i++}`); values.push(symbol); }
  if (name !== undefined) { fields.push(`name = $${i++}`); values.push(name); }
  if (rate !== undefined) { fields.push(`rate = $${i++}`); values.push(Number(rate) || 0); }
  if (enabled !== undefined) { fields.push(`enabled = $${i++}`); values.push(!!enabled); }
  if (sort_order !== undefined) { fields.push(`sort_order = $${i++}`); values.push(Number(sort_order) || 0); }
  if (fields.length === 0) return ok({ message: 'no change' });
  fields.push(`updated_at = NOW()`);
  values.push(code);
  const result = await pool.query(
    `UPDATE currencies SET ${fields.join(', ')} WHERE code = $${i} RETURNING *`,
    values
  );
  if (result.rowCount === 0) return fail(404, 'Currency not found');
  return ok(result.rows[0]);
});

export const DELETE = handle(async (_request, { params }) => {
  await ensureCurrenciesSchema();
  const { code } = await params;
  if (String(code).toUpperCase() === 'LAK') return fail(400, 'ບໍ່ສາມາດລຶບ LAK (ສະກຸນຫຼັກ)');
  await pool.query('DELETE FROM currencies WHERE code = $1', [code]);
  return ok({ message: 'deleted' });
});