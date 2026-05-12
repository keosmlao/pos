export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api';
import { ensureMembersSchema, ensureOrdersSchema } from '@/lib/migrations';

export const DELETE = handle(async (request, { params }) => {
  await ensureOrdersSchema();
  await ensureMembersSchema();
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return fail(400, 'Invalid order id');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query('SELECT member_id, total, member_points_earned, member_points_used FROM orders WHERE id = $1', [numericId]);
    const items = await client.query('SELECT * FROM order_items WHERE order_id = $1', [numericId]);
    if (items.rowCount === 0) {
      if (orderRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return fail(404, 'Order not found');
      }
    }
    for (const it of items.rows) {
      await client.query(
        'UPDATE products SET qty_on_hand = qty_on_hand + $1 WHERE id = $2',
        [it.quantity, it.product_id]
      );
    }
    const order = orderRes.rows[0];
    if (order?.member_id) {
      const earned = Number(order.member_points_earned) || 0;
      const used = Number(order.member_points_used) || 0;
      const pointsRevert = used - earned;
      await client.query(
        `UPDATE members
         SET points = GREATEST(0, points + $1),
             total_spent = GREATEST(0, total_spent - $2),
             updated_at = NOW()
         WHERE id = $3`,
        [pointsRevert, Number(order.total) || 0, order.member_id]
      );
    }
    await client.query('DELETE FROM order_items WHERE order_id = $1', [numericId]);
    await client.query('DELETE FROM orders WHERE id = $1', [numericId]);
    await client.query('COMMIT');
    return ok({ message: 'Order cancelled', id: numericId, restored_items: items.rowCount });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
