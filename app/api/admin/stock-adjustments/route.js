export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson, getQuery } from '@/lib/api';
import { ensureCompanyProfileSchema, ensureStockAdjustmentsSchema } from '@/lib/migrations';
import { extractActor } from '@/lib/audit';
import { allocateDocumentNumber } from '@/lib/billNumber';

const REASONS = new Set(['damaged', 'lost', 'found', 'correction', 'transfer', 'expired', 'theft', 'other']);

export const GET = handle(async (request) => {
  await ensureStockAdjustmentsSchema();
  const { from, to, product_id, reason, status } = getQuery(request);
  const where = [];
  const params = [];
  if (from) { params.push(from); where.push(`sa.created_at::date >= $${params.length}`); }
  if (to) { params.push(to); where.push(`sa.created_at::date <= $${params.length}`); }
  if (product_id) { params.push(Number(product_id)); where.push(`sa.product_id = $${params.length}`); }
  if (reason) { params.push(reason); where.push(`sa.reason = $${params.length}`); }
  if (status) {
    params.push(status);
    where.push(status === 'approved'
      ? `(sa.status = $${params.length} OR sa.status IS NULL)`
      : `sa.status = $${params.length}`);
  }
  const result = await pool.query(
    `SELECT sa.*, p.product_name, p.product_code, p.unit
     FROM stock_adjustments sa
     LEFT JOIN products p ON p.id = sa.product_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY sa.created_at DESC
     LIMIT 500`,
    params
  );
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureStockAdjustmentsSchema();
  await ensureCompanyProfileSchema();
  const body = await readJson(request);
  const reason = String(body.reason || '').trim();
  if (!REASONS.has(reason)) return fail(400, 'Invalid reason');

  const rawItems = Array.isArray(body.items) && body.items.length > 0
    ? body.items
    : [{ product_id: body.product_id, variant_id: body.variant_id, delta: body.delta, qty_after: body.qty_after }];
  const items = rawItems.map((it) => ({
    productId: Number(it.product_id),
    variantId: Number(it.variant_id) || null,
    delta: Number(it.delta),
    qtyAfterRaw: it.qty_after,
    setAbsolute: it.qty_after != null && it.qty_after !== '',
  })).filter((it) => Number.isInteger(it.productId) && it.productId > 0);
  if (items.length === 0) return fail(400, 'items is required');
  if (items.some((it) => !it.setAbsolute && !Number.isFinite(it.delta))) {
    return fail(400, 'delta or qty_after required');
  }

  const actor = extractActor(request);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const settingsRes = await client.query('SELECT * FROM company_profile WHERE id = 1');
    const adjustmentNumber = await allocateDocumentNumber(client, 'stock_adjustment', settingsRes.rows[0] || {});
    const inserted = [];

    for (const item of items) {
      let qtyBefore;
      if (item.variantId) {
        const r = await client.query(`SELECT qty_on_hand FROM product_variants WHERE id = $1 AND product_id = $2`, [item.variantId, item.productId]);
        if (r.rowCount === 0) { await client.query('ROLLBACK'); return fail(404, 'Variant not found'); }
        qtyBefore = Number(r.rows[0].qty_on_hand) || 0;
      } else {
        const r = await client.query(`SELECT qty_on_hand FROM products WHERE id = $1`, [item.productId]);
        if (r.rowCount === 0) { await client.query('ROLLBACK'); return fail(404, 'Product not found'); }
        qtyBefore = Number(r.rows[0].qty_on_hand) || 0;
      }
      const qtyAfter = item.setAbsolute ? Math.max(0, Number(item.qtyAfterRaw) || 0) : Math.max(0, qtyBefore + item.delta);
      const finalDelta = qtyAfter - qtyBefore;

      const insRes = await client.query(
        `INSERT INTO stock_adjustments
           (adjustment_number, product_id, variant_id, branch_id, qty_before, qty_after, delta,
            reason, note, user_id, username, requested_by, adjustment_type, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
         RETURNING *`,
        [
          adjustmentNumber,
          item.productId, item.variantId,
          Number(body.branch_id) || null,
          qtyBefore, qtyAfter, finalDelta,
          reason,
          body.note?.trim() || null,
          actor.user_id || null, actor.username || null,
          actor.username || null,
          body.adjustment_type || 'manual',
        ]
      );
      inserted.push(insRes.rows[0]);
    }
    await client.query('COMMIT');
    return ok({
      adjustment_number: adjustmentNumber,
      created_at: inserted[0]?.created_at || null,
      count: inserted.length,
      items: inserted,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
