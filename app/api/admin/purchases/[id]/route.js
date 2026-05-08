export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const DELETE = handle(async (_request, { params }) => {
  const { id } = await params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const items = await client.query('SELECT * FROM purchase_items WHERE purchase_id = $1', [id]);
    for (const item of items.rows) {
      await client.query(
        'UPDATE products SET qty_on_hand = qty_on_hand - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    await client.query('DELETE FROM debt_payments WHERE purchase_id = $1', [id]);
    await client.query('DELETE FROM purchase_items WHERE purchase_id = $1', [id]);
    await client.query('UPDATE pending_invoices SET purchase_id = NULL WHERE purchase_id = $1', [id]);
    await client.query('DELETE FROM purchases WHERE id = $1', [id]);

    await client.query('COMMIT');
    return ok({ message: 'Purchase deleted' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});