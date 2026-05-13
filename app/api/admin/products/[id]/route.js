export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureProductsExtraSchema } from '@/lib/migrations';

const VALID_COSTING = new Set(['FIFO', 'LIFO', 'AVG', 'LAST']);

export const PUT = handle(async (request, { params }) => {
  await ensureProductsExtraSchema();
  const { id } = await params;
  const body = await readJson(request);
  const { product_code, product_name, barcode, category, brand, cost_price, selling_price, qty_on_hand, min_stock, unit, expiry_date, supplier_name, status, image_url, costing_method } = body;
  const cm = costing_method == null || costing_method === ''
    ? null
    : (VALID_COSTING.has(String(costing_method).toUpperCase()) ? String(costing_method).toUpperCase() : null);
  const result = await pool.query(
    `UPDATE products SET product_code=$1, product_name=$2, barcode=$3, category=$4, brand=$5, cost_price=$6, selling_price=$7, qty_on_hand=$8, min_stock=$9, unit=$10, expiry_date=$11, supplier_name=$12, status=$13, image_url=$14, costing_method=$15
     WHERE id=$16 RETURNING *`,
    [product_code, product_name, barcode, category, brand, cost_price, selling_price, qty_on_hand, min_stock, unit, expiry_date || null, supplier_name, status !== undefined ? status : true, image_url || null, cm, id]
  );
  if (result.rows.length === 0) return fail(404, 'Product not found');
  return ok(result.rows[0]);
});

export const DELETE = handle(async (_request, { params }) => {
  const { id } = await params;
  const sales = await pool.query('SELECT COUNT(*) FROM order_items WHERE product_id = $1', [id]);
  if (parseInt(sales.rows[0].count) > 0) {
    return fail(400, 'ບໍ່ສາມາດລຶບສິນຄ້າທີ່ມີການຂາຍແລ້ວ');
  }
  await pool.query('DELETE FROM products WHERE id = $1', [id]);
  return ok({ message: 'Product deleted' });
});