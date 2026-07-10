export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureProductsExtraSchema } from '@/lib/migrations';
import { findDuplicateProduct } from '@/lib/productChecks';
import { VALID_COSTING } from '@/lib/costingMethods';


export const GET = handle(async () => {
  await ensureProductsExtraSchema();
  const result = await pool.query('SELECT * FROM products ORDER BY product_name');
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureProductsExtraSchema();
  const body = await readJson(request);
  const { product_code, product_name, barcode, category, brand, cost_price, selling_price, qty_on_hand, min_stock, unit, expiry_date, supplier_name, image_url, costing_method } = body;
  const cm = costing_method && VALID_COSTING.has(String(costing_method).toUpperCase()) ? String(costing_method).toUpperCase() : null;
  const dup = await findDuplicateProduct({ product_code, barcode });
  if (dup) return fail(400, dup.message);
  const result = await pool.query(
    `INSERT INTO products (product_code, product_name, barcode, category, brand, cost_price, selling_price, qty_on_hand, min_stock, unit, expiry_date, supplier_name, image_url, costing_method)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
    [product_code, product_name, barcode, category, brand, cost_price || 0, selling_price || 0, qty_on_hand || 0, min_stock || 5, unit || 'ອັນ', expiry_date || null, supplier_name, image_url || null, cm]
  );
  return ok(result.rows[0]);
});

export const DELETE = handle(async () => {
  const soldResult = await pool.query(`
    SELECT DISTINCT product_id FROM order_items WHERE product_id IS NOT NULL
  `);
  const soldIds = soldResult.rows.map((r) => r.product_id);

  let deleted;
  try {
    if (soldIds.length === 0) {
      deleted = await pool.query('DELETE FROM products RETURNING id');
    } else {
      deleted = await pool.query(
        `DELETE FROM products WHERE id <> ALL($1::int[]) RETURNING id`,
        [soldIds]
      );
    }
  } catch (e) {
    if (e.code === '23503') {
      return fail(400, 'ບໍ່ສາມາດລຶບໄດ້: ມີສິນຄ້າທີ່ຍັງຖືກອ້າງອີງໃນ layby ຫຼື ໃບສັ່ງຊື້');
    }
    throw e;
  }

  return ok({
    deleted_count: deleted.rowCount,
    skipped_count: soldIds.length,
    message: `ລຶບ ${deleted.rowCount} ລາຍການ ${soldIds.length > 0 ? `(ຂ້າມ ${soldIds.length} ລາຍການທີ່ມີການຂາຍແລ້ວ)` : ''}`
  });
});