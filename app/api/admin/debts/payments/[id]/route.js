export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api';

export const DELETE = handle(async (_request, { params }) => {
  const { id } = await params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const payment = await client.query('SELECT * FROM debt_payments WHERE id = $1', [id]);
    if (payment.rows.length === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'Payment not found');
    }

    const { purchase_id, amount } = payment.rows[0];

    await client.query(
      'UPDATE purchases SET paid = paid - $1 WHERE id = $2',
      [amount, purchase_id]
    );

    await client.query("UPDATE purchases SET status = 'pending' WHERE id = $1 AND paid < total", [purchase_id]);

    await client.query('DELETE FROM debt_payments WHERE id = $1', [id]);

    await client.query('COMMIT');
    return ok({ message: 'Payment deleted' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});