export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { ensureOrdersSchema } from '@/lib/migrations';

export const GET = handle(async () => {
  await ensureOrdersSchema();
  const today = await pool.query(`
    SELECT
      COUNT(*)::int AS count,
      COALESCE(SUM(total), 0)::float AS revenue,
      COALESCE(SUM(discount), 0)::float AS discount,
      COALESCE(SUM(amount_paid), 0)::float AS paid,
      COALESCE(AVG(total), 0)::float AS avg_order,
      COUNT(*) FILTER (WHERE payment_method = 'cash')::int AS cash_count,
      COALESCE(SUM(total) FILTER (WHERE payment_method = 'cash'), 0)::float AS cash_revenue,
      COUNT(*) FILTER (WHERE payment_method = 'transfer')::int AS transfer_count,
      COALESCE(SUM(total) FILTER (WHERE payment_method = 'transfer'), 0)::float AS transfer_revenue,
      COUNT(*) FILTER (WHERE payment_method = 'qr')::int AS qr_count,
      COALESCE(SUM(total) FILTER (WHERE payment_method = 'qr'), 0)::float AS qr_revenue
    FROM orders
    WHERE created_at::date = CURRENT_DATE
  `);
  const topItems = await pool.query(`
    SELECT p.product_name AS name,
           SUM(oi.quantity)::int AS qty,
           SUM(oi.quantity * oi.price)::float AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.created_at::date = CURRENT_DATE
    GROUP BY p.id, p.product_name
    ORDER BY qty DESC
    LIMIT 5
  `);
  return ok({ today: today.rows[0], top_items: topItems.rows });
});