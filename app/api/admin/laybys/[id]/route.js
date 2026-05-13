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

// Delete a layby completely.
// - 'open': return stock back to products/variants, then delete
// - 'cancelled': stock was already returned, just delete
// - 'completed': blocked — delete the linked order first (which will revert layby)
export const DELETE = handle(async (_request, { params }) => {
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

    if (layby.status === 'completed') {
      await client.query('ROLLBACK');
      return fail(409, 'Layby ປິດເປັນບີນຂາຍແລ້ວ — ກະຣຸນາລົບບີນຂາຍກ່ອນ');
    }

    if (layby.status === 'open') {
      const itemsRes = await client.query(`SELECT * FROM layby_items WHERE layby_id = $1`, [lid]);
      for (const it of itemsRes.rows) {
        if (it.variant_id) {
          await client.query(`UPDATE product_variants SET qty_on_hand = qty_on_hand + $1 WHERE id = $2`, [it.quantity, it.variant_id]);
        } else {
          await client.query(`UPDATE products SET qty_on_hand = qty_on_hand + $1 WHERE id = $2`, [it.quantity, it.product_id]);
        }
      }
    }

    // layby_items / layby_payments have ON DELETE CASCADE
    await client.query(`DELETE FROM laybys WHERE id = $1`, [lid]);
    await client.query('COMMIT');
    return ok({ deleted: lid, deposit_to_refund: Number(layby.paid) || 0 });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
