export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureProductVariantsSchema } from '@/lib/migrations';

export const PUT = handle(async (request, { params }) => {
  await ensureProductVariantsSchema();
  const { id, variantId } = await params;
  const pid = Number(id);
  const vid = Number(variantId);
  if (!Number.isInteger(pid) || pid <= 0) return fail(400, 'Invalid product id');
  if (!Number.isInteger(vid) || vid <= 0) return fail(400, 'Invalid variant id');

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
      `UPDATE product_variants SET
         variant_name = $1, variant_code = $2, barcode = $3,
         selling_price = $4, cost_price = $5, qty_on_hand = $6,
         active = $7, sort_order = $8, updated_at = NOW()
       WHERE id = $9 AND product_id = $10
       RETURNING *`,
      [name, variantCode, barcode, sellingPrice, costPrice, qty, active, sortOrder, vid, pid]
    );
    if (result.rowCount === 0) return fail(404, 'Variant not found');
    return ok(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') return fail(409, 'Barcode ນີ້ມີຢູ່ແລ້ວ');
    throw e;
  }
});

export const DELETE = handle(async (_request, { params }) => {
  await ensureProductVariantsSchema();
  const { id, variantId } = await params;
  const pid = Number(id);
  const vid = Number(variantId);
  if (!Number.isInteger(pid) || pid <= 0) return fail(400, 'Invalid product id');
  if (!Number.isInteger(vid) || vid <= 0) return fail(400, 'Invalid variant id');
  const result = await pool.query(
    `DELETE FROM product_variants WHERE id = $1 AND product_id = $2 RETURNING id`,
    [vid, pid]
  );
  if (result.rowCount === 0) return fail(404, 'Variant not found');
  return ok({ deleted: vid });
});
