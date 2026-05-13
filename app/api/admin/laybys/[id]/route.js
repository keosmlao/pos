export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api';
import { ensureLaybysSchema } from '@/lib/migrations';

export const GET = handle(async (_request, { params }) => {
  await ensureLaybysSchema();
  const { id } = await params;
  const lid = Number(id);
  if (!Number.isInteger(lid) || lid <= 0) return fail(400, 'Invalid id');

  const lRes = await pool.query(`SELECT * FROM laybys WHERE id = $1`, [lid]);
  if (lRes.rowCount === 0) return fail(404, 'Not found');
  const itemsRes = await pool.query(
    `SELECT li.*, p.product_name, p.product_code, p.unit, v.variant_name
     FROM layby_items li
     LEFT JOIN products p ON p.id = li.product_id
     LEFT JOIN product_variants v ON v.id = li.variant_id
     WHERE li.layby_id = $1 ORDER BY li.id`,
    [lid]
  );
  const payRes = await pool.query(
    `SELECT * FROM layby_payments WHERE layby_id = $1 ORDER BY id`,
    [lid]
  );
  return ok({ ...lRes.rows[0], items: itemsRes.rows, payments: payRes.rows });
});
