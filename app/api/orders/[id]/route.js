export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api';
import { ensureOrdersSchema } from '@/lib/migrations';

export const DELETE = handle(async (request, { params }) => {
  await ensureOrdersSchema();
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return fail(400, 'Invalid order id');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const items = await client.query('SELECT * FROM order_items WHERE order_id = $1', [numericId]);
    if (items.rowCount === 0) {
      const orderCheck = await client.query('SELECT id FROM orders WHERE id = $1', [numericId]);
      if (orderCheck.rowCount === 0) {
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
