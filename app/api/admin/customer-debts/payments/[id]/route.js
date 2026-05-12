export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api';
import { ensureCustomerDebtPaymentsSchema } from '@/lib/migrations';

export const DELETE = handle(async (request, { params }) => {
  await ensureCustomerDebtPaymentsSchema();
  const { id } = await params;
  const paymentId = Number(id);
  if (!Number.isInteger(paymentId) || paymentId <= 0) return fail(400, 'Invalid payment id');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const payRes = await client.query(
      `DELETE FROM customer_debt_payments WHERE id = $1 RETURNING *`,
      [paymentId]
    );
    if (payRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'Payment not found');
    }
    const payment = payRes.rows[0];
    const orderRes = await client.query(
      `SELECT total, COALESCE(credit_paid, amount_paid, 0) AS paid FROM orders WHERE id = $1 FOR UPDATE`,
      [payment.order_id]
    );
    if (orderRes.rowCount > 0) {
      const order = orderRes.rows[0];
      const newPaid = Math.max(0, Number(order.paid) - Number(payment.amount));
      const newStatus = newPaid <= 0 ? 'outstanding' : newPaid >= Number(order.total) ? 'paid' : 'partial';
      await client.query(
        `UPDATE orders SET credit_paid = $1, amount_paid = $1, credit_status = $2 WHERE id = $3`,
        [newPaid, newStatus, payment.order_id]
      );
    }
    await client.query('COMMIT');
    return ok(payment);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
