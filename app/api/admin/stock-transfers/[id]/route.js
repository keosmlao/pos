export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureStockTransfersSchema } from '@/lib/migrations';

export const GET = handle(async (_request, { params }) => {
  await ensureStockTransfersSchema();
  const { id } = await params;
  const tid = Number(id);
  if (!Number.isInteger(tid) || tid <= 0) return fail(400, 'Invalid id');
  const tRes = await pool.query(
    `SELECT st.*, bf.name AS from_branch_name, bt.name AS to_branch_name
     FROM stock_transfers st
     LEFT JOIN branches bf ON bf.id = st.from_branch_id
     LEFT JOIN branches bt ON bt.id = st.to_branch_id
     WHERE st.id = $1`,
    [tid]
  );
  if (tRes.rowCount === 0) return fail(404, 'Not found');
  const itemsRes = await pool.query(
    `SELECT sti.*, p.product_name, p.product_code, p.unit
     FROM stock_transfer_items sti
     LEFT JOIN products p ON p.id = sti.product_id
     WHERE sti.transfer_id = $1
     ORDER BY sti.id`,
    [tid]
  );
  return ok({ ...tRes.rows[0], items: itemsRes.rows });
});

// PUT — complete or cancel transfer.
export const PUT = handle(async (request, { params }) => {
  await ensureStockTransfersSchema();
  const { id } = await params;
  const tid = Number(id);
  if (!Number.isInteger(tid) || tid <= 0) return fail(400, 'Invalid id');
  const body = await readJson(request);
  const action = body.action;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tRes = await client.query(`SELECT * FROM stock_transfers WHERE id = $1 FOR UPDATE`, [tid]);
    if (tRes.rowCount === 0) { await client.query('ROLLBACK'); return fail(404, 'Not found'); }
    const transfer = tRes.rows[0];
    if (transfer.status !== 'pending') { await client.query('ROLLBACK'); return fail(400, `Transfer ${transfer.status}`); }

    const itemsRes = await client.query(`SELECT * FROM stock_transfer_items WHERE transfer_id = $1`, [tid]);

    if (action === 'complete') {
      for (const it of itemsRes.rows) {
        // Decrement from_branch, increment to_branch (initialize rows lazily)
        await client.query(
          `INSERT INTO branch_stocks (product_id, branch_id, qty) VALUES ($1, $2, 0)
           ON CONFLICT (product_id, branch_id) DO NOTHING`,
          [it.product_id, transfer.from_branch_id]
        );
        await client.query(
          `INSERT INTO branch_stocks (product_id, branch_id, qty) VALUES ($1, $2, 0)
           ON CONFLICT (product_id, branch_id) DO NOTHING`,
          [it.product_id, transfer.to_branch_id]
        );
        await client.query(
          `UPDATE branch_stocks SET qty = qty - $1, updated_at = NOW()
           WHERE product_id = $2 AND branch_id = $3`,
          [it.quantity, it.product_id, transfer.from_branch_id]
        );
        await client.query(
          `UPDATE branch_stocks SET qty = qty + $1, updated_at = NOW()
           WHERE product_id = $2 AND branch_id = $3`,
          [it.quantity, it.product_id, transfer.to_branch_id]
        );
      }
      await client.query(
        `UPDATE stock_transfers SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [tid]
      );
    } else if (action === 'cancel') {
      await client.query(
        `UPDATE stock_transfers SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [tid]
      );
    } else {
      await client.query('ROLLBACK');
      return fail(400, 'Invalid action — use complete or cancel');
    }
    await client.query('COMMIT');
    const refreshed = await pool.query(`SELECT * FROM stock_transfers WHERE id = $1`, [tid]);
    return ok(refreshed.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
