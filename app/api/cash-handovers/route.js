export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson } from '@/lib/api';
import { ensureCashHandoversSchema } from '@/lib/migrations';

export const GET = handle(async (request) => {
  await ensureCashHandoversSchema();
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 30, 200);
  const result = await pool.query(
    `SELECT * FROM cash_handovers ORDER BY handover_date DESC, created_at DESC LIMIT $1`,
    [limit]
  );
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureCashHandoversSchema();
  const { handover_date, cashier_name, expected_cash, actual_cash, note, received_by } = await readJson(request);
  const exp = Number(expected_cash) || 0;
  const act = Number(actual_cash) || 0;
  const diff = act - exp;
  const result = await pool.query(
    `INSERT INTO cash_handovers (handover_date, cashier_name, expected_cash, actual_cash, diff, note, received_by)
     VALUES (COALESCE($1::date, CURRENT_DATE), $2, $3, $4, $5, $6, $7) RETURNING *`,
    [handover_date || null, cashier_name || null, exp, act, diff, note || null, received_by || null]
  );
  return ok(result.rows[0]);
});