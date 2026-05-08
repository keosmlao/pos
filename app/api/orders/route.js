export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureOrdersSchema } from '@/lib/migrations';

export const GET = handle(async () => {
  await ensureOrdersSchema();
  const result = await pool.query(`
    SELECT o.*,
      json_agg(json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'quantity', oi.quantity,
        'price', oi.price,
        'product_name', p.product_name
      )) as items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT 50
  `);
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureOrdersSchema();
  const client = await pool.connect();
  try {
    let { total, payment_method, amount_paid, change_amount, items, discount, note, payments } = await readJson(request);
    if (!Array.isArray(items) || items.length === 0) {
      return fail(400, 'items is required');
    }
    const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
    const disc = Math.max(0, Number(discount) || 0);
    if (total == null || !isFinite(Number(total))) total = subtotal - disc;
    const totalNum = Math.max(0, Number(total) || 0);

    let paymentsNorm = null;
    let paymentsSumLAK = 0;
    if (Array.isArray(payments) && payments.length > 0) {
      paymentsNorm = payments
        .map((p) => {
          const currency = String(p.currency || 'LAK').toUpperCase();
          const amount = Math.max(0, Number(p.amount) || 0);
          const rate = Math.max(0, Number(p.rate) || 1);
          const amount_lak = Math.max(0, Number(p.amount_lak) || amount * rate);
          return { currency, amount, rate, amount_lak };
        })
        .filter((p) => p.amount > 0);
      paymentsSumLAK = paymentsNorm.reduce((s, p) => s + p.amount_lak, 0);
    }
    const paidNum = paymentsSumLAK > 0 ? paymentsSumLAK : Math.max(0, Number(amount_paid) || totalNum);
    const changeNum = change_amount != null ? Math.max(0, Number(change_amount) || 0) : Math.max(0, paidNum - totalNum);
    const methodFinal =
      payment_method ||
      (paymentsNorm && paymentsNorm.length > 1
        ? 'mixed'
        : paymentsNorm?.[0]?.currency === 'LAK'
        ? 'cash'
        : 'cash');

    await client.query('BEGIN');

    const orderResult = await client.query(
      'INSERT INTO orders (total, payment_method, amount_paid, change_amount, discount, note, payments) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING *',
      [totalNum, methodFinal, paidNum, changeNum, disc, note || null, paymentsNorm ? JSON.stringify(paymentsNorm) : null]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [order.id, item.product_id, item.quantity, item.price]
      );
      await client.query(
        'UPDATE products SET qty_on_hand = qty_on_hand - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    const itemsRes = await client.query(
      `SELECT oi.id, oi.product_id, oi.quantity, oi.price, p.product_name AS name
       FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1 ORDER BY oi.id`,
      [order.id]
    );

    await client.query('COMMIT');
    return ok({ ...order, items: itemsRes.rows });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});