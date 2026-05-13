export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { ensureReturnsSchema } from '@/lib/migrations';

export const GET = handle(async (request) => {
  await ensureReturnsSchema();
  const sp = request.nextUrl.searchParams;
  const start = sp.get('start');
  const end = sp.get('end');
  const branchId = sp.get('branch_id');

  let query = `
    WITH order_refunds AS (
      SELECT order_id, COALESCE(SUM(refund_amount), 0)::float AS refund_total
      FROM returns
      GROUP BY order_id
    ),
    item_returns AS (
      SELECT order_item_id, COALESCE(SUM(quantity), 0)::float AS returned_qty
      FROM return_items
      GROUP BY order_item_id
    )
    SELECT o.*,
      b.name AS branch_name,
      COALESCE(orf.refund_total, 0)::float AS refund_total,
      json_agg(json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'quantity', oi.quantity,
        'returned_qty', COALESCE(ir.returned_qty, 0),
        'price', oi.price,
        'product_name', p.product_name
      )) as items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN branches b ON b.id = o.branch_id
    LEFT JOIN order_refunds orf ON orf.order_id = o.id
    LEFT JOIN item_returns ir ON ir.order_item_id = oi.id
  `;
  const params = [];
  const conditions = [];

  if (start) {
    params.push(start);
    conditions.push(`o.created_at::date >= $${params.length}`);
  }
  if (end) {
    params.push(end);
    conditions.push(`o.created_at::date <= $${params.length}`);
  }
  if (branchId) {
    params.push(Number(branchId));
    conditions.push(`o.branch_id = $${params.length}`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY o.id, b.name, orf.refund_total ORDER BY o.created_at DESC';

  const result = await pool.query(query, params);
  return ok(result.rows);
});