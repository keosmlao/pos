export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureProductVariantsSchema } from '@/lib/migrations';

export const GET = handle(async (_request, { params }) => {
  await ensureProductVariantsSchema();
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) return fail(400, 'Invalid product id');
  const result = await pool.query(
    `SELECT * FROM product_variants WHERE product_id = $1
     ORDER BY sort_order, id`,
    [pid]
  );
  return ok(result.rows);
});

export const POST = handle(async (request, { params }) => {
  await ensureProductVariantsSchema();
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) return fail(400, 'Invalid product id');
  const body = await readJson(request);

  const name = String(body.variant_name || '').trim();
  if (!name) return fail(400, 'variant_name is required');

  const variantCode = String(body.variant_code || '').trim() || null;
  const barcode = String(body.barcode || '').trim() || null;
  const sellingPrice = body.selling_price != null && body.selling_price !== '' ? Number(body.selling_price) : null;
  const costPrice = body.cost_price != null && body.cost_price !== '' ? Number(body.cost_price) : null;
  const qty = Math.max(0, Number(body.qty_on_hand) || 0);
  const active = body.active !== false;
  const sortOrder = Number(body.sort_order) || 0;

  try {
    const result = await pool.query(
      `INSERT INTO product_variants
         (product_id, variant_name, variant_code, barcode, selling_price, cost_price, qty_on_hand, active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [pid, name, variantCode, barcode, sellingPrice, costPrice, qty, active, sortOrder]
    );
    return ok(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') return fail(409, 'Barcode ນີ້ມີຢູ່ແລ້ວ');
    throw e;
  }
});
