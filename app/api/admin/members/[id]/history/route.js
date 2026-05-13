export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api';

export const GET = handle(async (_request, { params }) => {
  const { id } = await params;
  const mid = Number(id);
  if (!Number.isInteger(mid) || mid <= 0) return fail(400, 'Invalid id');

  const memberRes = await pool.query('SELECT * FROM members WHERE id = $1', [mid]);
  if (memberRes.rowCount === 0) return fail(404, 'Member not found');
  const member = memberRes.rows[0];

  // Lifetime stats
  const statsRes = await pool.query(
    `SELECT
       COUNT(*) AS orders,
       COALESCE(SUM(total), 0) AS revenue,
       COALESCE(AVG(total), 0) AS avg_order,
       MIN(created_at) AS first_order,
       MAX(created_at) AS last_order,
       COUNT(*) FILTER (WHERE credit_status IN ('outstanding', 'partial')) AS open_credits,
       COALESCE(SUM(GREATEST(total - COALESCE(credit_paid, 0), 0)) FILTER (WHERE credit_status IN ('outstanding', 'partial')), 0) AS outstanding
     FROM orders WHERE member_id = $1`,
    [mid]
  );

  // Recent orders
  const ordersRes = await pool.query(
    `SELECT o.id, o.bill_number, o.created_at, o.payment_method, o.total,
            o.discount, o.vat_amount, o.credit_status, o.credit_paid, o.credit_due_date,
            (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
     FROM orders o WHERE member_id = $1
     ORDER BY o.created_at DESC LIMIT 200`,
    [mid]
  );

  // Top products
  const topRes = await pool.query(
    `SELECT p.product_name, COALESCE(SUM(oi.quantity), 0) AS qty,
            COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN products p ON p.id = oi.product_id
     WHERE o.member_id = $1
     GROUP BY p.product_name
     ORDER BY qty DESC LIMIT 20`,
    [mid]
  );

  // Monthly spend trend
  const monthlyRes = await pool.query(
    `SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
            COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
     FROM orders WHERE member_id = $1
     GROUP BY month ORDER BY month DESC LIMIT 12`,
    [mid]
  );

  return ok({
    member,
    stats: statsRes.rows[0],
    orders: ordersRes.rows,
    top_products: topRes.rows,
    monthly: monthlyRes.rows,
  });
});
