export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { ensureOrdersSchema } from '@/lib/migrations';

// Per-line cost source: oi.cost_price (snapshot ณ ເວລາຂາຍ, ເລີ່ມເກັບ v1.7.0);
// ບິນເກົ່າກ່ອນມີ snapshot ຈະ fallback ໃສ່ products.cost_price ປັດຈຸບັນ.
//
// Per-line revenue = (oi.price * oi.quantity), allocating order-level discount
// proportionally so margin is reported on net revenue.

export const GET = handle(async (request) => {
  await ensureOrdersSchema();
  const { from, to, limit } = getQuery(request);
  // limit=all lifts the top-N cap so exports carry every product / category
  const unlimited = String(limit || '').toLowerCase() === 'all';
  const productLimit = unlimited ? '' : `LIMIT ${Math.min(Math.max(Number(limit) || 50, 1), 1000)}`;
  const categoryLimit = unlimited ? '' : 'LIMIT 30';
  const params = [];
  const where = [];
  if (from) { params.push(from); where.push(`o.created_at::date >= $${params.length}`); }
  if (to) { params.push(to); where.push(`o.created_at::date <= $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const baseCTE = `
    WITH order_totals AS (
      SELECT o.id, o.created_at,
             COALESCE(SUM(oi.quantity * oi.price), 0) AS gross,
             COALESCE(o.discount, 0) AS discount,
             COALESCE(o.vat_amount, 0) AS vat_amount,
             o.vat_mode
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      ${whereSql}
      GROUP BY o.id, o.created_at, o.discount, o.vat_amount, o.vat_mode
    ),
    line_items AS (
      SELECT oi.order_id,
             oi.product_id,
             oi.quantity,
             oi.price,
             p.product_name,
             p.cost_price,
             p.category AS category_name,
             (oi.quantity * oi.price) AS line_gross,
             (oi.quantity * COALESCE(oi.cost_price, p.cost_price, 0)) AS line_cost,
             ot.gross AS order_gross,
             ot.discount AS order_discount,
             ot.vat_amount AS order_vat,
             ot.vat_mode,
             ot.created_at,
             CASE WHEN ot.gross > 0
               THEN (oi.quantity * oi.price) / ot.gross
               ELSE 0
             END AS line_share
      FROM order_items oi
      JOIN order_totals ot ON ot.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
    ),
    line_net AS (
      SELECT *,
             (line_gross - line_share * order_discount) AS line_revenue_inc_vat,
             CASE WHEN vat_mode = 'inclusive'
               THEN (line_gross - line_share * order_discount) - line_share * order_vat
               ELSE (line_gross - line_share * order_discount)
             END AS line_revenue_ex_vat
      FROM line_items
    )
  `;

  const summaryRes = await pool.query(
    `${baseCTE}
     SELECT
       COUNT(DISTINCT order_id) AS orders,
       COALESCE(SUM(line_revenue_ex_vat), 0) AS revenue,
       COALESCE(SUM(line_cost), 0) AS cost,
       COALESCE(SUM(line_revenue_ex_vat - line_cost), 0) AS profit
     FROM line_net`,
    params
  );

  const dailyRes = await pool.query(
    `${baseCTE}
     SELECT created_at::date AS d,
            COALESCE(SUM(line_revenue_ex_vat), 0) AS revenue,
            COALESCE(SUM(line_cost), 0) AS cost,
            COALESCE(SUM(line_revenue_ex_vat - line_cost), 0) AS profit
     FROM line_net
     GROUP BY d
     ORDER BY d DESC
     LIMIT 90`,
    params
  );

  const productsRes = await pool.query(
    `${baseCTE}
     SELECT product_id,
            COALESCE(product_name, '—') AS product_name,
            COALESCE(SUM(quantity), 0) AS qty,
            COALESCE(SUM(line_revenue_ex_vat), 0) AS revenue,
            COALESCE(SUM(line_cost), 0) AS cost,
            COALESCE(SUM(line_revenue_ex_vat - line_cost), 0) AS profit
     FROM line_net
     GROUP BY product_id, product_name
     ORDER BY profit DESC
     ${productLimit}`,
    params
  );

  const categoriesRes = await pool.query(
    `${baseCTE}
     SELECT COALESCE(category_name, 'ບໍ່ມີໝວດ') AS category_name,
            COALESCE(SUM(quantity), 0) AS qty,
            COALESCE(SUM(line_revenue_ex_vat), 0) AS revenue,
            COALESCE(SUM(line_cost), 0) AS cost,
            COALESCE(SUM(line_revenue_ex_vat - line_cost), 0) AS profit
     FROM line_net
     GROUP BY category_name
     ORDER BY profit DESC
     ${categoryLimit}`,
    params
  );

  return ok({
    range: { from: from || null, to: to || null },
    summary: summaryRes.rows[0],
    daily: dailyRes.rows,
    products: productsRes.rows,
    categories: categoriesRes.rows,
  });
});
