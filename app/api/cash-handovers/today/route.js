export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { ensureCashHandoversSchema } from '@/lib/migrations';

export const GET = handle(async () => {
  await ensureCashHandoversSchema();
  const result = await pool.query(
    `SELECT * FROM cash_handovers WHERE handover_date = CURRENT_DATE ORDER BY created_at DESC`
  );
  return ok(result.rows);
});