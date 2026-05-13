export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const GET = handle(async () => {
  // Basic counts
  const totalProducts = await pool.query('SELECT COUNT(*)::int AS n FROM products WHERE status = true');
  const totalCustomers = await pool.query('SELECT COUNT(*)::int AS n FROM members WHERE active IS NOT FALSE');

  // Revenue/orders by period
  const periodStats = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS today_orders,
      COALESCE(SUM(total) FILTER (WHERE created_at::date = CURRENT_DATE), 0)::float AS today_revenue,
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE - INTERVAL '1 day')::int AS yesterday_orders,
      COALESCE(SUM(total) FILTER (WHERE created_at::date = CURRENT_DATE - INTERVAL '1 day'), 0)::float AS yesterday_revenue,
      COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE))::int AS week_orders,
      COALESCE(SUM(total) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)), 0)::float AS week_revenue,
      COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE))::int AS month_orders,
      COALESCE(SUM(total) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0)::float AS month_revenue,
      COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND created_at < DATE_TRUNC('month', CURRENT_DATE))::int AS last_month_orders,
      COALESCE(SUM(total) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND created_at < DATE_TRUNC('month', CURRENT_DATE)), 0)::float AS last_month_revenue,
      COUNT(*)::int AS all_orders,
      COALESCE(SUM(total), 0)::float AS all_revenue
    FROM orders
  `);

  // Daily revenue last 30 days (for trend chart)
  const trendRes = await pool.query(`
    WITH days AS (
      SELECT generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day')::date AS d
    )
    SELECT
      d::text AS date,
      COALESCE(SUM(o.total), 0)::float AS revenue,
      COUNT(o.id)::int AS orders
    FROM days
    LEFT JOIN orders o ON o.created_at::date = d
    GROUP BY d
    ORDER BY d
  `);

  // Revenue by payment method (this month)
  const byMethodRes = await pool.query(`
    SELECT payment_method, COUNT(*)::int AS orders, COALESCE(SUM(total), 0)::float AS revenue
    FROM orders
    WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY payment_method
    ORDER BY revenue DESC
  `);

  // Top products (this month)
  const topProductsRes = await pool.query(`
    SELECT p.product_name, p.product_code,
      SUM(oi.quantity)::int AS total_sold,
      SUM(oi.quantity * oi.price)::float AS total_revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON oi.product_id = p.id
    WHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY p.id, p.product_name, p.product_code
    ORDER BY total_revenue DESC
    LIMIT 8
  `);

  // Top customers (this month, by total spend)
  const topCustomersRes = await pool.query(`
    SELECT
      COALESCE(m.name, o.customer_name, 'ລູກຄ້າທົ່ວໄປ') AS name,
      m.member_code,
      COUNT(o.id)::int AS orders,
      SUM(o.total)::float AS revenue
    FROM orders o
    LEFT JOIN members m ON m.id = o.member_id
    WHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE)
      AND (o.member_id IS NOT NULL OR COALESCE(o.customer_name, '') <> '')
    GROUP BY COALESCE(m.name, o.customer_name, 'ລູກຄ້າທົ່ວໄປ'), m.member_code
    ORDER BY revenue DESC
    LIMIT 5
  `);

  // Low stock products
  const lowStockRes = await pool.query(
    `SELECT id, product_name, product_code, qty_on_hand, min_stock, selling_price
     FROM products WHERE status = true AND qty_on_hand <= min_stock
     ORDER BY qty_on_hand ASC LIMIT 30`
  );

  // Inventory value (stored cost-based)
  const invValueRes = await pool.query(`
    SELECT
      COALESCE(SUM(qty_on_hand * cost_price), 0)::float AS cost_value,
      COALESCE(SUM(qty_on_hand * selling_price), 0)::float AS retail_value,
      COALESCE(SUM(qty_on_hand), 0)::int AS total_qty
    FROM products WHERE status = true
  `);

  // Customer debts (AR)
  const arRes = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE GREATEST(0, total - COALESCE(credit_paid, amount_paid, 0)) > 0)::int AS open_count,
      COALESCE(SUM(GREATEST(0, total - COALESCE(credit_paid, amount_paid, 0))), 0)::float AS open_amount,
      COUNT(*) FILTER (WHERE credit_due_date IS NOT NULL AND credit_due_date < CURRENT_DATE
        AND GREATEST(0, total - COALESCE(credit_paid, amount_paid, 0)) > 0)::int AS overdue_count,
      COALESCE(SUM(GREATEST(0, total - COALESCE(credit_paid, amount_paid, 0))) FILTER (
        WHERE credit_due_date IS NOT NULL AND credit_due_date < CURRENT_DATE
          AND GREATEST(0, total - COALESCE(credit_paid, amount_paid, 0)) > 0), 0)::float AS overdue_amount
    FROM orders WHERE payment_method = 'credit'
  `);

  // Supplier debts (AP)
  const apRes = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE GREATEST(0, total - paid) > 0)::int AS open_count,
      COALESCE(SUM(GREATEST(0, total - paid)), 0)::float AS open_amount
    FROM purchases
  `).catch(() => ({ rows: [{ open_count: 0, open_amount: 0 }] }));

  // Today's hourly sales (for sparkline)
  const hourlyRes = await pool.query(`
    WITH hours AS (SELECT generate_series(0, 23) AS h)
    SELECT h AS hour,
      COALESCE(SUM(o.total) FILTER (WHERE EXTRACT(HOUR FROM o.created_at) = h AND o.created_at::date = CURRENT_DATE), 0)::float AS revenue,
      COUNT(o.id) FILTER (WHERE EXTRACT(HOUR FROM o.created_at) = h AND o.created_at::date = CURRENT_DATE)::int AS orders
    FROM hours
    LEFT JOIN orders o ON o.created_at::date = CURRENT_DATE
    GROUP BY h
    ORDER BY h
  `);

  // Recent orders
  const recentRes = await pool.query(`
    SELECT id, bill_number, total, payment_method, customer_name, created_at
    FROM orders ORDER BY created_at DESC LIMIT 8
  `);

  // Gross profit (this month) = revenue - cost from order_items joined with products
  const profitRes = await pool.query(`
    SELECT
      COALESCE(SUM(oi.quantity * oi.price), 0)::float AS revenue,
      COALESCE(SUM(oi.quantity * COALESCE(p.cost_price, 0)), 0)::float AS cogs
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE)
  `);

  // Sales by category (this month)
  const categoryRes = await pool.query(`
    SELECT COALESCE(p.category, 'ບໍ່ມີໝວດ') AS category,
      SUM(oi.quantity)::int AS qty,
      SUM(oi.quantity * oi.price)::float AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    LEFT JOIN products p ON p.id = oi.product_id
    WHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY COALESCE(p.category, 'ບໍ່ມີໝວດ')
    ORDER BY revenue DESC
    LIMIT 8
  `);

  // Sales by cashier (this month)
  const cashierRes = await pool.query(`
    SELECT
      'unknown' AS cashier_id,
      COUNT(DISTINCT o.id)::int AS orders,
      SUM(o.total)::float AS revenue
    FROM orders o
    WHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY 1
  `).catch(() => ({ rows: [] }));

  // Slow-moving inventory (products with stock but not sold in 30 days)
  const slowMovingRes = await pool.query(`
    SELECT p.id, p.product_name, p.product_code, p.qty_on_hand, p.cost_price,
      (p.qty_on_hand * COALESCE(p.cost_price, 0))::float AS stuck_value,
      (SELECT MAX(o.created_at) FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.product_id = p.id) AS last_sold_at
    FROM products p
    WHERE p.status = true AND p.qty_on_hand > 0
      AND NOT EXISTS (
        SELECT 1 FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        WHERE oi.product_id = p.id AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
      )
    ORDER BY (p.qty_on_hand * COALESCE(p.cost_price, 0)) DESC NULLS LAST
    LIMIT 10
  `);

  // Member tier distribution
  const memberTierRes = await pool.query(`
    SELECT tier, COUNT(*)::int AS count, COALESCE(SUM(total_spent), 0)::float AS total_spent
    FROM members WHERE active IS NOT FALSE
    GROUP BY tier
    ORDER BY total_spent DESC
  `).catch(() => ({ rows: [] }));

  // Week comparison (this week vs last week)
  const weekCompareRes = await pool.query(`
    SELECT
      COALESCE(SUM(total) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE)), 0)::float AS this_week,
      COALESCE(SUM(total) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days') AND created_at < DATE_TRUNC('week', CURRENT_DATE)), 0)::float AS last_week,
      COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE))::int AS this_week_orders,
      COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '7 days') AND created_at < DATE_TRUNC('week', CURRENT_DATE))::int AS last_week_orders
    FROM orders
  `);

  // Today's return stats
  const returnsRes = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS today_count,
      COALESCE(SUM(refund_amount) FILTER (WHERE created_at::date = CURRENT_DATE), 0)::float AS today_amount,
      COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE))::int AS month_count,
      COALESCE(SUM(refund_amount) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0)::float AS month_amount
    FROM returns
  `).catch(() => ({ rows: [{ today_count: 0, today_amount: 0, month_count: 0, month_amount: 0 }] }));

  // Quotation pipeline stats
  const quoteRes = await pool.query(`
    SELECT
      status,
      COUNT(*)::int AS count,
      COALESCE(SUM(total), 0)::float AS amount
    FROM quotations
    WHERE quote_date >= DATE_TRUNC('month', CURRENT_DATE)
    GROUP BY status
  `).catch(() => ({ rows: [] }));

  // Cash flow this month (income vs expense from cash_transactions)
  const cashRes = await pool.query(`
    SELECT
      COALESCE(SUM(amount_lak) FILTER (WHERE txn_type = 'income'), 0)::float AS income,
      COALESCE(SUM(amount_lak) FILTER (WHERE txn_type = 'expense'), 0)::float AS expense
    FROM cash_transactions
    WHERE txn_date >= DATE_TRUNC('month', CURRENT_DATE)
  `).catch(() => ({ rows: [{ income: 0, expense: 0 }] }));

  const s = periodStats.rows[0];
  const ar = arRes.rows[0];
  const ap = apRes.rows[0];

  return ok({
    counts: {
      products: totalProducts.rows[0].n,
      customers: totalCustomers.rows[0].n,
    },
    periods: {
      today: { orders: s.today_orders, revenue: s.today_revenue },
      yesterday: { orders: s.yesterday_orders, revenue: s.yesterday_revenue },
      week: { orders: s.week_orders, revenue: s.week_revenue },
      month: { orders: s.month_orders, revenue: s.month_revenue },
      last_month: { orders: s.last_month_orders, revenue: s.last_month_revenue },
      all: { orders: s.all_orders, revenue: s.all_revenue },
    },
    trend: trendRes.rows,
    hourly: hourlyRes.rows,
    by_method: byMethodRes.rows,
    top_products: topProductsRes.rows,
    top_customers: topCustomersRes.rows,
    low_stock: lowStockRes.rows,
    inventory: invValueRes.rows[0],
    ar: {
      open_count: ar.open_count, open_amount: ar.open_amount,
      overdue_count: ar.overdue_count, overdue_amount: ar.overdue_amount,
    },
    ap: { open_count: ap.open_count, open_amount: ap.open_amount },
    cash_flow_month: cashRes.rows[0],
    recent_orders: recentRes.rows,
    profit_month: profitRes.rows[0],
    by_category: categoryRes.rows,
    by_cashier: cashierRes.rows,
    slow_moving: slowMovingRes.rows,
    member_tiers: memberTierRes.rows,
    week_compare: weekCompareRes.rows[0],
    returns_stats: returnsRes.rows[0],
    quotation_pipeline: quoteRes.rows,
  });
});
