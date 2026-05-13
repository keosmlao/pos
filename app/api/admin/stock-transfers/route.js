export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson, getQuery } from '@/lib/api';
import { ensureStockTransfersSchema, ensureBranchesSchema } from '@/lib/migrations';
import { extractActor } from '@/lib/audit';

export const GET = handle(async (request) => {
  await ensureStockTransfersSchema();
  await ensureBranchesSchema();
  const { status, branch_id } = getQuery(request);
  const where = [];
  const params = [];
  if (status) { params.push(status); where.push(`st.status = $${params.length}`); }
  if (branch_id) {
    params.push(Number(branch_id));
    where.push(`(st.from_branch_id = $${params.length} OR st.to_branch_id = $${params.length})`);
  }
  const result = await pool.query(
    `SELECT st.*,
       bf.name AS from_branch_name,
       bt.name AS to_branch_name,
       (SELECT COUNT(*) FROM stock_transfer_items WHERE transfer_id = st.id) AS item_count,
       (SELECT COALESCE(SUM(quantity), 0) FROM stock_transfer_items WHERE transfer_id = st.id) AS total_qty
     FROM stock_transfers st
     LEFT JOIN branches bf ON bf.id = st.from_branch_id
     LEFT JOIN branches bt ON bt.id = st.to_branch_id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY st.created_at DESC LIMIT 200`,
    params
  );
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureStockTransfersSchema();
  const body = await readJson(request);
  const fromId = Number(body.from_branch_id);
  const toId = Number(body.to_branch_id);
  if (!fromId || !toId || fromId === toId) return fail(400, 'from_branch_id != to_branch_id required');
  const items = Array.isArray(body.items)
    ? body.items.map(it => ({ product_id: Number(it.product_id), quantity: Math.max(0, Number(it.quantity) || 0) })).filter(it => it.product_id && it.quantity > 0)
    : [];
  if (items.length === 0) return fail(400, 'items required');

  const actor = extractActor(request);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const numRes = await client.query(`SELECT COUNT(*) + 1 AS n FROM stock_transfers`);
    const transferNumber = `TF-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(numRes.rows[0].n).padStart(4, '0')}`;

    const tRes = await client.query(
      `INSERT INTO stock_transfers (transfer_number, from_branch_id, to_branch_id, status, note, created_by)
       VALUES ($1, $2, $3, 'pending', $4, $5) RETURNING *`,
      [transferNumber, fromId, toId, body.note || null, actor.username || null]
    );
    const transfer = tRes.rows[0];
    for (const it of items) {
      await client.query(
        `INSERT INTO stock_transfer_items (transfer_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [transfer.id, it.product_id, it.quantity]
      );
    }
    await client.query('COMMIT');
    return ok(transfer);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
