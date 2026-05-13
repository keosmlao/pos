export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { fail, handle, ok, getQuery } from '@/lib/api';
import { ensureReturnsSchema } from '@/lib/migrations';

export const GET = handle(async (request) => {
  await ensureReturnsSchema();
  const { q = '' } = getQuery(request);
  const query = String(q || '').trim();
  if (!query) return fail(400, 'q is required');

  const orderRes = await pool.query(
    `SELECT *
     FROM orders
     WHERE bill_number = $1 OR id::text = REGEXP_REPLACE($1, '^#', '')
     ORDER BY created_at DESC
     LIMIT 1`,
    [query]
  );
  if (orderRes.rowCount === 0) return fail(404, 'Order not found');
  const order = orderRes.rows[0];

  const itemsRes = await pool.query(
    `SELECT
       oi.id AS order_item_id,
       oi.product_id,
       p.product_name,
       oi.quantity::float AS sold_qty,
       oi.price::float AS price,
       COALESCE(SUM(ri.quantity), 0)::float AS returned_qty,
       GREATEST(0, oi.quantity - COALESCE(SUM(ri.quantity), 0))::float AS returnable_qty
     FROM order_items oi
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN return_items ri ON ri.order_item_id = oi.id
     WHERE oi.order_id = $1
     GROUP BY oi.id, p.product_name
     ORDER BY oi.id`,
    [order.id]
  );

  const returnsRes = await pool.query(
    `SELECT id, return_number, refund_amount, refund_method, note, created_at
     FROM returns WHERE order_id = $1 ORDER BY created_at DESC`,
    [order.id]
  );

  return ok({ order, items: itemsRes.rows, returns: returnsRes.rows });
});

