export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { ensurePriceHistorySchema, ensureProductsExtraSchema, ensureCompanyProfileSchema } from '@/lib/migrations';

export const GET = handle(async () => {
  await ensurePriceHistorySchema();
  await ensureProductsExtraSchema();
  await ensureCompanyProfileSchema();

  const [productsRes, companyRes] = await Promise.all([
    pool.query(`
      SELECT
        p.id, p.product_code, p.barcode, p.product_name, p.category, p.brand,
        p.cost_price, p.selling_price, p.unit, p.costing_method,
        cs.avg_cost, cs.fifo_cost, cs.last_cost, cs.last_purchase_date
      FROM products p
      LEFT JOIN LATERAL (
        SELECT
          (SELECT SUM(pi.quantity * pi.cost_price) / NULLIF(SUM(pi.quantity), 0)
             FROM purchase_items pi WHERE pi.product_id = p.id) AS avg_cost,
          (SELECT pi.cost_price
             FROM purchase_items pi JOIN purchases pu ON pu.id = pi.purchase_id
             WHERE pi.product_id = p.id
             ORDER BY pu.created_at ASC, pi.id ASC LIMIT 1) AS fifo_cost,
          (SELECT pi.cost_price
             FROM purchase_items pi JOIN purchases pu ON pu.id = pi.purchase_id
             WHERE pi.product_id = p.id
             ORDER BY pu.created_at DESC, pi.id DESC LIMIT 1) AS last_cost,
          (SELECT MAX(pu.created_at)
             FROM purchase_items pi JOIN purchases pu ON pu.id = pi.purchase_id
             WHERE pi.product_id = p.id) AS last_purchase_date
      ) cs ON TRUE
      WHERE p.status = true
      ORDER BY p.product_name
    `),
    pool.query(`SELECT default_costing_method FROM company_profile WHERE id = 1`),
  ]);

  const defaultMethod = companyRes.rows[0]?.default_costing_method || 'AVG';
  const rows = productsRes.rows.map((r) => {
    const method = (r.costing_method || defaultMethod || 'AVG').toUpperCase();
    let effective = null;
    if (method === 'AVG') effective = r.avg_cost;
    else if (method === 'FIFO') effective = r.fifo_cost;
    else if (method === 'LIFO') effective = r.last_cost; // approximation without batch tracking
    else if (method === 'LAST') effective = r.last_cost;
    // Fallback to stored cost_price if no purchase history yet
    if (effective == null) effective = r.cost_price;
    return {
      ...r,
      lifo_cost: r.last_cost,
      effective_costing_method: method,
      effective_cost: effective == null ? null : Number(effective),
    };
  });

  return ok(rows);
});
