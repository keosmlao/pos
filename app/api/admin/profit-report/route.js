export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { ensureOrdersSchema } from '@/lib/migrations';
import { lineRevenueCTE } from '@/lib/salesRevenueSql';

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

  const baseCTE = `WITH ${lineRevenueCTE(whereSql)}`;

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
