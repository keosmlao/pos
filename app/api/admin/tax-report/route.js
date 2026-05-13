export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { ensureOrdersSchema, ensureCompanyProfileSchema } from '@/lib/migrations';

export const GET = handle(async (request) => {
  await ensureOrdersSchema();
  await ensureCompanyProfileSchema();

  const url = new URL(request.url);
  const from = url.searchParams.get('from') || null;
  const to = url.searchParams.get('to') || null;

  const params = [];
  const where = [];
  if (from) { params.push(from); where.push(`o.created_at::date >= $${params.length}`); }
  if (to) { params.push(to); where.push(`o.created_at::date <= $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const summaryRes = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE COALESCE(o.vat_amount, 0) > 0) AS taxable_count,
       COUNT(*) FILTER (WHERE COALESCE(o.vat_amount, 0) = 0) AS exempt_count,
       COALESCE(SUM(o.total), 0) AS gross_total,
       COALESCE(SUM(o.subtotal), 0) AS net_total,
       COALESCE(SUM(o.vat_amount), 0) AS vat_total,
       COALESCE(SUM(o.discount), 0) AS discount_total
     FROM orders o ${whereSql}`,
    params
  );

  const byRateRes = await pool.query(
    `SELECT
       COALESCE(o.vat_rate, 0) AS rate,
       COALESCE(o.vat_mode, 'none') AS mode,
       COUNT(*) AS orders,
       COALESCE(SUM(o.subtotal), 0) AS net,
       COALESCE(SUM(o.vat_amount), 0) AS vat,
       COALESCE(SUM(o.total), 0) AS gross
     FROM orders o ${whereSql}
     GROUP BY rate, mode
     ORDER BY rate DESC`,
    params
  );

  const dailyRes = await pool.query(
    `SELECT
       o.created_at::date AS d,
       COUNT(*) AS orders,
       COALESCE(SUM(o.subtotal), 0) AS net,
       COALESCE(SUM(o.vat_amount), 0) AS vat,
       COALESCE(SUM(o.total), 0) AS gross
     FROM orders o ${whereSql}
     GROUP BY d
     ORDER BY d DESC
     LIMIT 365`,
    params
  );

  const recentWhere = [...where, `COALESCE(o.vat_amount, 0) > 0`];
  const recentSql = `SELECT o.id, o.bill_number, o.created_at, o.customer_name,
            o.subtotal, o.discount, o.vat_rate, o.vat_mode, o.vat_amount, o.total
     FROM orders o
     WHERE ${recentWhere.join(' AND ')}
     ORDER BY o.created_at DESC
     LIMIT 200`;
  const recentRes = await pool.query(recentSql, params);

  return ok({
    summary: summaryRes.rows[0],
    by_rate: byRateRes.rows,
    daily: dailyRes.rows,
    recent: recentRes.rows,
  });
});
