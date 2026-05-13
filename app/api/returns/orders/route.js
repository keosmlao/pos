export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { ensureReturnsSchema } from '@/lib/migrations';

export const GET = handle(async (request) => {
  await ensureReturnsSchema();
  const { q = '', limit = '50' } = getQuery(request);
  const query = String(q || '').trim();
  const lim = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));

  const params = [];
  const where = [];
  if (query) {
    params.push(`%${query.toLowerCase()}%`);
    const i = params.length;
    where.push(`(
      LOWER(COALESCE(o.bill_number, '')) LIKE $${i}
      OR o.id::text LIKE $${i}
      OR LOWER(COALESCE(o.customer_name, '')) LIKE $${i}
      OR COALESCE(o.customer_phone, '') LIKE $${i}
    )`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  params.push(lim);
  const limitParam = `$${params.length}`;

  const result = await pool.query(
    `
    SELECT
      o.id,
      o.bill_number,
      o.customer_name,
      o.customer_phone,
      o.created_at,
      o.total,
      o.payment_method,
      COALESCE(SUM(oi.quantity), 0)::int AS sold_qty,
      COALESCE(SUM(oi.quantity), 0)::int - COALESCE(SUM(ri.qty), 0)::int AS returnable_qty,
      COALESCE(SUM(ri.qty), 0)::int AS returned_qty
    FROM orders o
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN (
      SELECT order_item_id, SUM(quantity) AS qty
      FROM return_items
      GROUP BY order_item_id
    ) ri ON ri.order_item_id = oi.id
    ${whereSql}
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT ${limitParam}
    `,
    params
  );

  return ok(result.rows);
});
