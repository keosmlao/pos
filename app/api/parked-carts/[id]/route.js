export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api';
import { ensureParkedCartsSchema } from '@/lib/migrations';

export const DELETE = handle(async (_request, { params }) => {
  await ensureParkedCartsSchema();
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) return fail(400, 'Invalid id');
  const result = await pool.query(`DELETE FROM parked_carts WHERE id = $1 RETURNING id`, [pid]);
  if (result.rowCount === 0) return fail(404, 'Not found');
  return ok({ deleted: pid });
});
