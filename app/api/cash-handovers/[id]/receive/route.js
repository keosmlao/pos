export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureCashHandoversSchema } from '@/lib/migrations';

export const POST = handle(async (request, { params }) => {
  await ensureCashHandoversSchema();
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return fail(400, 'invalid id');

  const { received_by } = await readJson(request);
  const result = await pool.query(
    `UPDATE cash_handovers
     SET received_at = NOW(), received_by = COALESCE($1, received_by)
     WHERE id = $2 RETURNING *`,
    [received_by || null, numericId]
  );
  if (result.rowCount === 0) return fail(404, 'not found');
  return ok(result.rows[0]);
});
