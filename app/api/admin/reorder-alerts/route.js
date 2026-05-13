export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

// Returns products that have hit reorder threshold: qty_on_hand <= min_stock
// (and min_stock > 0 — products with no threshold set are skipped).
//
// Sorted by severity (out-of-stock first, then closest-to-zero).
export const GET = handle(async () => {
  const result = await pool.query(
    `SELECT p.id, p.product_code, p.product_name, p.barcode, p.unit,
            p.qty_on_hand, p.min_stock, p.cost_price, p.selling_price,
            p.category, p.brand, p.supplier_name,
            CASE
              WHEN p.qty_on_hand <= 0 THEN 'out'
              WHEN p.qty_on_hand <= p.min_stock / 2 THEN 'critical'
              ELSE 'low'
            END AS severity,
            (SELECT MAX(pu.created_at) FROM purchase_items pi
             JOIN purchases pu ON pu.id = pi.purchase_id
             WHERE pi.product_id = p.id) AS last_purchase_at,
            (SELECT MAX(o.created_at) FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE oi.product_id = p.id) AS last_sold_at
     FROM products p
     WHERE COALESCE(p.min_stock, 0) > 0
       AND COALESCE(p.qty_on_hand, 0) <= p.min_stock
     ORDER BY
       CASE WHEN p.qty_on_hand <= 0 THEN 0 ELSE 1 END,
       p.qty_on_hand ASC,
       p.product_name`
  );

  const summary = {
    total: result.rowCount,
    out: result.rows.filter(r => r.severity === 'out').length,
    critical: result.rows.filter(r => r.severity === 'critical').length,
    low: result.rows.filter(r => r.severity === 'low').length,
  };

  return ok({ items: result.rows, summary });
});
