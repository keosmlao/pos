export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { ensureOrdersSchema, ensureUsersSchema } from '@/lib/migrations';

export const GET = handle(async (request) => {
  await ensureOrdersSchema();
  await ensureUsersSchema();
  const { from, to } = getQuery(request);
  const where = [];
  const params = [];
  if (from) { params.push(from); where.push(`o.created_at::date >= $${params.length}`); }
  if (to) { params.push(to); where.push(`o.created_at::date <= $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Per cashier stats
  const cashierRes = await pool.query(
    `SELECT
       COALESCE(u.id, NULL) AS user_id,
       COALESCE(u.username, o.created_by_username, '(ບໍ່ຣະບຸ)') AS username,
       COALESCE(u.display_name, o.created_by_username, '(ບໍ່ຣະບຸ)') AS display_name,
       COALESCE(u.role, 'cashier') AS role,
       COALESCE(u.commission_rate, 0) AS commission_rate,
       COALESCE(u.sales_target, 0) AS sales_target,
       COUNT(o.id) AS orders,
       COALESCE(SUM(o.total), 0) AS revenue,
       COALESCE(AVG(o.total), 0) AS avg_order,
       COUNT(o.id) FILTER (WHERE o.payment_method = 'credit') AS credit_orders,
       COALESCE(SUM(o.discount), 0) AS discount_given
     FROM orders o
     LEFT JOIN users u ON u.id = o.created_by_user_id
     ${whereSql}
     GROUP BY u.id, u.username, u.display_name, u.role, u.commission_rate, u.sales_target, o.created_by_username
     ORDER BY revenue DESC`,
    params
  );

  // Daily per cashier
  const dailyRes = await pool.query(
    `SELECT
       o.created_at::date AS d,
       COALESCE(o.created_by_username, '(ບໍ່ຣະບຸ)') AS username,
       COUNT(*) AS orders,
       COALESCE(SUM(o.total), 0) AS revenue
     FROM orders o ${whereSql}
     GROUP BY d, username
     ORDER BY d DESC, revenue DESC
     LIMIT 200`,
    params
  );

  const summaryRes = await pool.query(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
     FROM orders o ${whereSql}`,
    params
  );

  return ok({
    cashiers: cashierRes.rows.map(c => ({
      ...c,
      commission_amount: Math.round((Number(c.revenue) * Number(c.commission_rate || 0)) / 100),
      target_pct: Number(c.sales_target) > 0 ? (Number(c.revenue) / Number(c.sales_target)) * 100 : null,
    })),
    daily: dailyRes.rows,
    summary: summaryRes.rows[0],
  });
});
