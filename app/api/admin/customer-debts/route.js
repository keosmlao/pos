export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { ensureCustomerDebtPaymentsSchema } from '@/lib/migrations';

export const GET = handle(async () => {
  await ensureCustomerDebtPaymentsSchema();
  const result = await pool.query(`
    SELECT o.*,
      m.member_code,
      COALESCE(o.credit_paid, o.amount_paid, 0) AS paid,
      GREATEST(0, o.total - COALESCE(o.credit_paid, o.amount_paid, 0)) AS remaining,
      json_agg(json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'quantity', oi.quantity,
        'price', oi.price,
        'product_name', p.product_name
      ) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL) AS items
    FROM orders o
    LEFT JOIN members m ON m.id = o.member_id
    LEFT JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.payment_method = 'credit'
    GROUP BY o.id, m.member_code
    ORDER BY
      CASE WHEN GREATEST(0, o.total - COALESCE(o.credit_paid, o.amount_paid, 0)) > 0 THEN 0 ELSE 1 END,
      o.credit_due_date ASC NULLS LAST,
      o.created_at DESC
  `);
  return ok(result.rows);
});
