export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const GET = handle(async () => {
  const totalProducts = await pool.query('SELECT COUNT(*) FROM products WHERE status = true');
  const todayOrders = await pool.query(
    "SELECT COUNT(*) FROM orders WHERE created_at::date = CURRENT_DATE"
  );
  const todayRevenue = await pool.query(
    "SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE created_at::date = CURRENT_DATE"
  );
  const allOrders = await pool.query('SELECT COUNT(*) FROM orders');
  const allRevenue = await pool.query('SELECT COALESCE(SUM(total), 0) as total FROM orders');
  const lowStock = await pool.query(
    'SELECT * FROM products WHERE status = true AND qty_on_hand <= min_stock ORDER BY qty_on_hand ASC'
  );
  const topProducts = await pool.query(`
    SELECT p.product_name, SUM(oi.quantity) as total_sold, SUM(oi.quantity * oi.price) as total_revenue
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    GROUP BY p.id, p.product_name
    ORDER BY total_sold DESC
    LIMIT 10
  `);

  return ok({
    total_products: parseInt(totalProducts.rows[0].count),
    today_orders: parseInt(todayOrders.rows[0].count),
    today_revenue: parseFloat(todayRevenue.rows[0].total),
    all_orders: parseInt(allOrders.rows[0].count),
    all_revenue: parseFloat(allRevenue.rows[0].total),
    low_stock: lowStock.rows,
    top_products: topProducts.rows,
  });
});