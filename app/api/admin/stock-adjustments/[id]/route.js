export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureStockAdjustmentsSchema } from '@/lib/migrations';
import { extractActor } from '@/lib/audit';

export const PUT = handle(async (request, { params }) => {
  await ensureStockAdjustmentsSchema();
  const { id } = await params;
  const adjustmentId = Number(id);
  if (!Number.isInteger(adjustmentId) || adjustmentId <= 0) return fail(400, 'Invalid id');

  const body = await readJson(request);
  const action = String(body.action || '').trim();
  if (!['approve', 'reject'].includes(action)) return fail(400, 'Invalid action');

  const actor = extractActor(request);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const adjRes = await client.query(
      `SELECT * FROM stock_adjustments WHERE id = $1 FOR UPDATE`,
      [adjustmentId]
    );
    if (adjRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'Not found');
    }
    const adj = adjRes.rows[0];
    const docNumber = adj.adjustment_number || null;
    const docRes = docNumber
      ? await client.query(`SELECT * FROM stock_adjustments WHERE adjustment_number = $1 FOR UPDATE`, [docNumber])
      : adjRes;
    const rows = docRes.rows;
    if (rows.some((row) => row.status !== 'pending')) {
      await client.query('ROLLBACK');
      return fail(400, 'Document is not pending');
    }

    if (action === 'reject') {
      const result = await client.query(
        `UPDATE stock_adjustments
         SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), rejection_note = $2
         WHERE ${docNumber ? 'adjustment_number = $3' : 'id = $3'}
         RETURNING *`,
        [actor.username || null, String(body.rejection_note || '').trim() || null, docNumber || adjustmentId]
      );
      await client.query('COMMIT');
      return ok({ adjustment_number: docNumber, count: result.rowCount, items: result.rows });
    }

    for (const row of rows) {
      if (row.variant_id) {
        await client.query(
          `UPDATE product_variants SET qty_on_hand = $1, updated_at = NOW()
           WHERE id = $2 AND product_id = $3`,
          [row.qty_after, row.variant_id, row.product_id]
        );
      } else {
        await client.query(
          `UPDATE products SET qty_on_hand = $1 WHERE id = $2`,
          [row.qty_after, row.product_id]
        );
      }
    }

    const result = await client.query(
      `UPDATE stock_adjustments
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE ${docNumber ? 'adjustment_number = $2' : 'id = $2'}
       RETURNING *`,
      [actor.username || null, docNumber || adjustmentId]
    );
    await client.query('COMMIT');
    return ok({ adjustment_number: docNumber, count: result.rowCount, items: result.rows });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
