export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson } from '@/lib/api';

export const GET = handle(async (_request, { params }) => {
  const { purchase_id } = await params;
  const result = await pool.query(
    'SELECT * FROM debt_payments WHERE purchase_id = $1 ORDER BY created_at DESC',
    [purchase_id]
  );
  return ok(result.rows);
});

export const POST = handle(async (request, { params }) => {
  const { purchase_id } = await params;
  const { amount, note, payment_number, payment_date, bill_number, currency, exchange_rate, payment_method, attachment } = await readJson(request);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const amountInLAK = currency && currency !== 'LAK' && exchange_rate
      ? amount * exchange_rate
      : amount;

    const paymentResult = await client.query(
      `INSERT INTO debt_payments (purchase_id, amount, note, payment_number, payment_date, bill_number, currency, exchange_rate, payment_method, attachment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [purchase_id, amountInLAK, note, payment_number, payment_date || null, bill_number, currency || 'LAK', exchange_rate || 1, payment_method || 'cash', attachment]
    );

    await client.query(
      'UPDATE purchases SET paid = paid + $1 WHERE id = $2',
      [amountInLAK, purchase_id]
    );

    const purchase = await client.query('SELECT total, paid FROM purchases WHERE id = $1', [purchase_id]);
    if (purchase.rows.length > 0 && purchase.rows[0].paid >= purchase.rows[0].total) {
      await client.query("UPDATE purchases SET status = 'paid' WHERE id = $1", [purchase_id]);
    }

    await client.query('COMMIT');
    return ok(paymentResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});