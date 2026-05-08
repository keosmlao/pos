export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureCurrenciesSchema } from '@/lib/migrations';

export const GET = handle(async () => {
  await ensureCurrenciesSchema();
  const result = await pool.query('SELECT * FROM currencies ORDER BY sort_order, code');
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureCurrenciesSchema();
  const { code, symbol, name, rate, enabled, sort_order } = await readJson(request);
  if (!code) return fail(400, 'code is required');
  try {
    const result = await pool.query(
      `INSERT INTO currencies (code, symbol, name, rate, enabled, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [String(code).toUpperCase(), symbol || '', name || code, Number(rate) || 1, enabled !== false, Number(sort_order) || 99]
    );
    return ok(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') return fail(400, 'ລະຫັດສະກຸນນີ້ມີແລ້ວ');
    throw e;
  }
});