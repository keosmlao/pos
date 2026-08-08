export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { fail, handle, ok } from '@/lib/api';
import { ensureReturnsSchema } from '@/lib/migrations';

export const DELETE = handle(async (_request, { params }) => {
  await ensureReturnsSchema();
  const { id } = await params;
  const returnId = Number(id);
  if (!Number.isInteger(returnId) || returnId <= 0) return fail(400, 'Invalid return id');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const retRes = await client.query(
      `SELECT id, return_number, member_id, refund_amount,
              COALESCE(member_points_reverted, 0)::int AS member_points_reverted,
              COALESCE(member_points_restored, 0)::int AS member_points_restored
       FROM returns WHERE id = $1 FOR UPDATE`,
      [returnId]
    );
    if (retRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'Return not found');
    }
    const itemsRes = await client.query(
      'SELECT product_id, quantity FROM return_items WHERE return_id = $1',
      [returnId]
    );
    for (const it of itemsRes.rows) {
      if (!it.product_id) continue;
      await client.query(
        'UPDATE products SET qty_on_hand = qty_on_hand - $1 WHERE id = $2',
        [Number(it.quantity) || 0, it.product_id]
      );
    }
    // ຍົກເລີກໃບຄືນ → ຄືນແຕ້ມກັບໄປສະພາບກ່ອນຄືນສິນຄ້າ
    const ret = retRes.rows[0];
    const memberId = Number(ret.member_id) || null;
    if (memberId) {
      const reverted = Number(ret.member_points_reverted) || 0;
      const restored = Number(ret.member_points_restored) || 0;
      await client.query(
        `UPDATE members
         SET points = GREATEST(0, points + $1),
             total_spent = total_spent + $2,
             updated_at = NOW()
         WHERE id = $3`,
        [reverted - restored, Number(ret.refund_amount) || 0, memberId]
      );
    }

    await client.query('DELETE FROM returns WHERE id = $1', [returnId]);
    await client.query('COMMIT');
    return ok({ id: returnId, return_number: retRes.rows[0].return_number });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
