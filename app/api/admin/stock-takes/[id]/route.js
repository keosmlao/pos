export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureStockTakesSchema, ensureStockAdjustmentsSchema } from '@/lib/migrations';
import { extractActor } from '@/lib/audit';

export const GET = handle(async (_request, { params }) => {
  await ensureStockTakesSchema();
  const { id } = await params;
  const tid = Number(id);
  if (!Number.isInteger(tid) || tid <= 0) return fail(400, 'Invalid id');

  const takeRes = await pool.query(`SELECT * FROM stock_takes WHERE id = $1`, [tid]);
  if (takeRes.rowCount === 0) return fail(404, 'Not found');

  const itemsRes = await pool.query(
    `SELECT sti.*, p.product_name, p.product_code, p.barcode, p.unit, p.category, p.brand
     FROM stock_take_items sti
     LEFT JOIN products p ON p.id = sti.product_id
     WHERE sti.stock_take_id = $1
     ORDER BY p.product_name`,
    [tid]
  );
  return ok({ ...takeRes.rows[0], items: itemsRes.rows });
});

export const PUT = handle(async (request, { params }) => {
  // Update individual item counts, or complete the stock take.
  await ensureStockTakesSchema();
  await ensureStockAdjustmentsSchema();
  const { id } = await params;
  const tid = Number(id);
  if (!Number.isInteger(tid) || tid <= 0) return fail(400, 'Invalid id');
  const body = await readJson(request);
  const actor = extractActor(request);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const takeRes = await client.query(`SELECT * FROM stock_takes WHERE id = $1 FOR UPDATE`, [tid]);
    if (takeRes.rowCount === 0) { await client.query('ROLLBACK'); return fail(404, 'Not found'); }
    const take = takeRes.rows[0];

    if (Array.isArray(body.items)) {
      for (const it of body.items) {
        const counted = it.counted === '' || it.counted == null ? null : Number(it.counted);
        await client.query(
          `UPDATE stock_take_items
           SET counted = $1,
               delta = CASE WHEN $1 IS NULL THEN NULL ELSE $1 - expected END,
               note = $2,
               counted_at = CASE WHEN $1 IS NULL THEN NULL ELSE NOW() END
           WHERE id = $3 AND stock_take_id = $4`,
          [counted, it.note || null, Number(it.id), tid]
        );
      }
    }

    if (body.action === 'complete') {
      if (take.status === 'completed') { await client.query('ROLLBACK'); return fail(400, 'ປິດແລ້ວ'); }
      const variancesRes = await client.query(
        `SELECT sti.product_id, sti.expected, sti.counted, sti.delta, sti.note
         FROM stock_take_items sti
         WHERE sti.stock_take_id = $1 AND sti.counted IS NOT NULL AND sti.delta <> 0`,
        [tid]
      );
      for (const v of variancesRes.rows) {
        await client.query(`UPDATE products SET qty_on_hand = $1 WHERE id = $2`, [v.counted, v.product_id]);
        await client.query(
          `INSERT INTO stock_adjustments
             (product_id, qty_before, qty_after, delta, reason, note, user_id, username, adjustment_type, reference_id)
           VALUES ($1, $2, $3, $4, 'correction', $5, $6, $7, 'stock_take', $8)`,
          [
            v.product_id, v.expected, v.counted, v.delta,
            v.note ? `Stock take · ${v.note}` : `Stock take #${tid}`,
            actor.user_id || null, actor.username || null,
            tid,
          ]
        );
      }
      await client.query(
        `UPDATE stock_takes SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [tid]
      );
    }

    await client.query('COMMIT');
    const refreshed = await pool.query(`SELECT * FROM stock_takes WHERE id = $1`, [tid]);
    return ok(refreshed.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

export const DELETE = handle(async (_request, { params }) => {
  await ensureStockTakesSchema();
  const { id } = await params;
  const tid = Number(id);
  if (!Number.isInteger(tid) || tid <= 0) return fail(400, 'Invalid id');
  const exists = await pool.query(`SELECT status FROM stock_takes WHERE id = $1`, [tid]);
  if (exists.rowCount === 0) return fail(404, 'Not found');
  if (exists.rows[0].status === 'completed') return fail(400, 'ບໍ່ສາມາດລົບ stock take ທີ່ປິດແລ້ວ');
  await pool.query(`DELETE FROM stock_takes WHERE id = $1`, [tid]);
  return ok({ deleted: tid });
});
