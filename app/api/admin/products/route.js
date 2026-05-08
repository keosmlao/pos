export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson } from '@/lib/api';

export const GET = handle(async () => {
  const result = await pool.query('SELECT * FROM products ORDER BY product_name');
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  const body = await readJson(request);
  const { product_code, product_name, barcode, category, brand, cost_price, selling_price, qty_on_hand, min_stock, unit, expiry_date, supplier_name, image_url } = body;
  const result = await pool.query(
    `INSERT INTO products (product_code, product_name, barcode, category, brand, cost_price, selling_price, qty_on_hand, min_stock, unit, expiry_date, supplier_name, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [product_code, product_name, barcode, category, brand, cost_price || 0, selling_price || 0, qty_on_hand || 0, min_stock || 5, unit || 'ອັນ', expiry_date || null, supplier_name, image_url || null]
  );
  return ok(result.rows[0]);
});

export const DELETE = handle(async () => {
  const soldResult = await pool.query(`
    SELECT DISTINCT product_id FROM order_items WHERE product_id IS NOT NULL
  `);
  const soldIds = soldResult.rows.map((r) => r.product_id);

  let deleted;
  if (soldIds.length === 0) {
    deleted = await pool.query('DELETE FROM products RETURNING id');
  } else {
    deleted = await pool.query(
      `DELETE FROM products WHERE id <> ALL($1::int[]) RETURNING id`,
      [soldIds]
    );
  }

  return ok({
    deleted_count: deleted.rowCount,
    skipped_count: soldIds.length,
    message: `ລຶບ ${deleted.rowCount} ລາຍການ ${soldIds.length > 0 ? `(ຂ້າມ ${soldIds.length} ລາຍການທີ່ມີການຂາຍແລ້ວ)` : ''}`
  });
});