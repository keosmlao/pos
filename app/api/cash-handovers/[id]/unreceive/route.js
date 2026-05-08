export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api';
import { ensureCashHandoversSchema } from '@/lib/migrations';

export const POST = handle(async (_request, { params }) => {
  await ensureCashHandoversSchema();
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return fail(400, 'invalid id');

  const result = await pool.query(
    `UPDATE cash_handovers SET received_at = NULL WHERE id = $1 RETURNING *`,
    [numericId]
  );
  if (result.rowCount === 0) return fail(404, 'not found');
  return ok(result.rows[0]);
});
