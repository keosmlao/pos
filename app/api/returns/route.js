export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { fail, handle, ok, readJson } from '@/lib/api';
import { ensureReturnsSchema, ensureCompanyProfileSchema } from '@/lib/migrations';
import { allocateReturnNumber } from '@/lib/billNumber';

export const GET = handle(async () => {
  await ensureReturnsSchema();
  const result = await pool.query(`
    SELECT r.*,
      o.bill_number,
      o.created_at AS order_created_at,
      o.customer_name,
      o.customer_phone,
      COALESCE(json_agg(json_build_object(
        'id', ri.id,
        'product_id', ri.product_id,
        'product_name', p.product_name,
        'quantity', ri.quantity,
        'price', ri.price,
        'amount', ri.amount
      ) ORDER BY ri.id) FILTER (WHERE ri.id IS NOT NULL), '[]') AS items
    FROM returns r
    JOIN orders o ON o.id = r.order_id
    LEFT JOIN return_items ri ON ri.return_id = r.id
    LEFT JOIN products p ON p.id = ri.product_id
    GROUP BY r.id, o.id
    ORDER BY r.created_at DESC
    LIMIT 300
  `);
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureReturnsSchema();
  await ensureCompanyProfileSchema();
  const body = await readJson(request);
  const orderId = Number(body.order_id);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!Number.isInteger(orderId) || orderId <= 0) return fail(400, 'order_id is required');
  if (items.length === 0) return fail(400, 'items is required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'Order not found');
    }

    const ids = items.map(it => Number(it.order_item_id)).filter(id => Number.isInteger(id) && id > 0);
    if (ids.length === 0) {
      await client.query('ROLLBACK');
      return fail(400, 'No valid items');
    }

    const orderItemsRes = await client.query(
      `SELECT
         id AS order_item_id,
         product_id,
         quantity::float AS sold_qty,
         price::float AS price
       FROM order_items
       WHERE order_id = $1 AND id = ANY($2::int[])
       FOR UPDATE`,
      [orderId, ids]
    );
    const returnedRes = await client.query(
      `SELECT order_item_id, COALESCE(SUM(quantity), 0)::float AS returned_qty
       FROM return_items
       WHERE order_item_id = ANY($1::int[])
       GROUP BY order_item_id`,
      [ids]
    );
    const returnedById = new Map(returnedRes.rows.map(r => [Number(r.order_item_id), Number(r.returned_qty) || 0]));
    const byId = new Map(orderItemsRes.rows.map(r => [
      Number(r.order_item_id),
      { ...r, returned_qty: returnedById.get(Number(r.order_item_id)) || 0 }
    ]));

    const normalized = [];
    for (const item of items) {
      const orderItemId = Number(item.order_item_id);
      const qty = Math.max(0, Number(item.quantity) || 0);
      if (!orderItemId || qty <= 0) continue;
      const row = byId.get(orderItemId);
      if (!row) {
        await client.query('ROLLBACK');
        return fail(400, 'Invalid order item');
      }
      const returnable = Math.max(0, Number(row.sold_qty) - Number(row.returned_qty));
      if (qty > returnable) {
        await client.query('ROLLBACK');
        return fail(400, `Return quantity exceeds sold quantity for item ${orderItemId}`);
      }
      normalized.push({
        order_item_id: orderItemId,
        product_id: Number(row.product_id),
        quantity: qty,
        price: Number(row.price) || 0,
        amount: qty * (Number(row.price) || 0),
      });
    }
    if (normalized.length === 0) {
      await client.query('ROLLBACK');
      return fail(400, 'No return quantity');
    }

    const refundAmount = normalized.reduce((s, it) => s + it.amount, 0);

    const settingsRes = await client.query(
      `SELECT return_number_template, return_number_prefix, return_number_seq_digits,
              return_number_seq_reset, return_number_start
       FROM company_profile WHERE id = 1`
    );
    const settings = settingsRes.rows[0] || {};
    const returnNumber = await allocateReturnNumber(client, settings);

    const retRes = await client.query(
      `INSERT INTO returns (return_number, order_id, refund_amount, refund_method, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        returnNumber,
        orderId,
        refundAmount,
        String(body.refund_method || 'cash'),
        String(body.note || '').trim() || null,
        String(body.created_by || '').trim() || null,
      ]
    );
    const ret = retRes.rows[0];

    for (const item of normalized) {
      await client.query(
        `INSERT INTO return_items (return_id, order_item_id, product_id, quantity, price, amount)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ret.id, item.order_item_id, item.product_id, item.quantity, item.price, item.amount]
      );
      await client.query('UPDATE products SET qty_on_hand = qty_on_hand + $1 WHERE id = $2', [item.quantity, item.product_id]);
    }

    const itemsRes = await client.query(
      `SELECT ri.*, p.product_name
       FROM return_items ri LEFT JOIN products p ON p.id = ri.product_id
       WHERE ri.return_id = $1 ORDER BY ri.id`,
      [ret.id]
    );

    await client.query('COMMIT');
    return ok({ ...ret, items: itemsRes.rows });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
