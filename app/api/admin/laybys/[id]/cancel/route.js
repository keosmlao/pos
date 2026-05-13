export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api';
import { ensureLaybysSchema } from '@/lib/migrations';

// Cancel layby: return stock; deposit refund tracked but the actual cash refund
// is handled separately (admin records via cash transactions).
export const POST = handle(async (_request, { params }) => {
  await ensureLaybysSchema();
  const { id } = await params;
  const lid = Number(id);
  if (!Number.isInteger(lid) || lid <= 0) return fail(400, 'Invalid id');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lRes = await client.query(`SELECT * FROM laybys WHERE id = $1 FOR UPDATE`, [lid]);
    if (lRes.rowCount === 0) { await client.query('ROLLBACK'); return fail(404, 'Not found'); }
    const layby = lRes.rows[0];
    if (layby.status !== 'open') { await client.query('ROLLBACK'); return fail(400, `Layby ${layby.status}`); }

    const itemsRes = await client.query(`SELECT * FROM layby_items WHERE layby_id = $1`, [lid]);
    for (const it of itemsRes.rows) {
      if (it.variant_id) {
        await client.query(`UPDATE product_variants SET qty_on_hand = qty_on_hand + $1 WHERE id = $2`, [it.quantity, it.variant_id]);
      } else {
        await client.query(`UPDATE products SET qty_on_hand = qty_on_hand + $1 WHERE id = $2`, [it.quantity, it.product_id]);
      }
    }
    await client.query(
      `UPDATE laybys SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [lid]
    );
    await client.query('COMMIT');
    return ok({ cancelled: lid, deposit_to_refund: Number(layby.paid) });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
