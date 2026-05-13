export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';

// Bulk insert/update products from a parsed array. Each row should have:
//   product_code, product_name, barcode, category, brand, unit,
//   cost_price, selling_price, qty_on_hand, min_stock, supplier_name
// Match key: product_code (preferred) or barcode.
// Mode: 'create_only' | 'update_only' | 'upsert'
export const POST = handle(async (request) => {
  const body = await readJson(request);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const mode = body.mode === 'create_only' || body.mode === 'update_only' ? body.mode : 'upsert';
  if (rows.length === 0) return fail(400, 'rows is required');
  if (rows.length > 5000) return fail(400, 'Too many rows (max 5000)');

  const client = await pool.connect();
  const result = { created: 0, updated: 0, skipped: 0, errors: [] };
  try {
    await client.query('BEGIN');
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const productCode = String(r.product_code || '').trim() || null;
        const productName = String(r.product_name || '').trim();
        const barcode = String(r.barcode || '').trim() || null;
        if (!productName) { result.skipped++; result.errors.push(`ແຖວ ${i + 2}: ບໍ່ມີຊື່ສິນຄ້າ`); continue; }

        const find = await client.query(
          `SELECT id FROM products WHERE
             ($1::text IS NOT NULL AND product_code = $1)
             OR ($2::text IS NOT NULL AND barcode = $2)
           LIMIT 1`,
          [productCode, barcode]
        );
        const existing = find.rows[0];

        if (existing && mode === 'create_only') { result.skipped++; continue; }
        if (!existing && mode === 'update_only') { result.skipped++; continue; }

        const values = {
          product_code: productCode,
          product_name: productName,
          barcode,
          category: String(r.category || '').trim() || null,
          brand: String(r.brand || '').trim() || null,
          unit: String(r.unit || '').trim() || null,
          cost_price: Number(r.cost_price) || 0,
          selling_price: Number(r.selling_price) || 0,
          qty_on_hand: Number(r.qty_on_hand) || 0,
          min_stock: Number(r.min_stock) || 5,
          supplier_name: String(r.supplier_name || '').trim() || null,
        };

        if (existing) {
          await client.query(
            `UPDATE products SET
               product_code = COALESCE($1, product_code),
               product_name = $2,
               barcode = COALESCE($3, barcode),
               category = COALESCE($4, category),
               brand = COALESCE($5, brand),
               unit = COALESCE($6, unit),
               cost_price = $7,
               selling_price = $8,
               qty_on_hand = $9,
               min_stock = $10,
               supplier_name = COALESCE($11, supplier_name)
             WHERE id = $12`,
            [values.product_code, values.product_name, values.barcode, values.category, values.brand,
             values.unit, values.cost_price, values.selling_price, values.qty_on_hand, values.min_stock,
             values.supplier_name, existing.id]
          );
          result.updated++;
        } else {
          await client.query(
            `INSERT INTO products (product_code, product_name, barcode, category, brand, unit,
                                   cost_price, selling_price, qty_on_hand, min_stock, supplier_name, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE)`,
            [values.product_code, values.product_name, values.barcode, values.category, values.brand,
             values.unit, values.cost_price, values.selling_price, values.qty_on_hand, values.min_stock,
             values.supplier_name]
          );
          result.created++;
        }
      } catch (e) {
        result.errors.push(`ແຖວ ${i + 2}: ${e.message}`);
        result.skipped++;
      }
    }
    await client.query('COMMIT');
    return ok(result);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
