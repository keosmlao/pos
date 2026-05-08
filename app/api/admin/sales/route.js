export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const GET = handle(async (request) => {
  const sp = request.nextUrl.searchParams;
  const start = sp.get('start');
  const end = sp.get('end');

  let query = `
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

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' GROUP BY o.id ORDER BY o.created_at DESC';

  const result = await pool.query(query, params);
  return ok(result.rows);
});