export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson, getQuery } from '@/lib/api';
import { ensurePurchaseRequestsSchema } from '@/lib/migrations';
import { extractActor } from '@/lib/audit';

export const GET = handle(async (request) => {
  await ensurePurchaseRequestsSchema();
  const { status } = getQuery(request);
  const where = [];
  const params = [];
  if (status) { params.push(status); where.push(`pr.status = $${params.length}`); }
  const result = await pool.query(
    `SELECT pr.*,
       (SELECT COUNT(*) FROM purchase_request_items WHERE request_id = pr.id) AS item_count,
       (SELECT COALESCE(SUM(quantity), 0) FROM purchase_request_items WHERE request_id = pr.id) AS total_qty
     FROM purchase_requests pr
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY pr.created_at DESC LIMIT 300`,
    params
  );
  return ok(result.rows);
});

function normalizeItems(items) {
  return (Array.isArray(items) ? items : []).map(it => ({
    product_id: Number(it.product_id),
    product_name: String(it.product_name || '').trim() || null,
    quantity: Math.max(0, Number(it.quantity) || 0),
    cost_price: Math.max(0, Number(it.cost_price) || 0),
    note: it.note || null,
  })).filter(it => it.product_id && it.quantity > 0);
}

export const POST = handle(async (request) => {
  await ensurePurchaseRequestsSchema();
  const body = await readJson(request);
  const items = normalizeItems(body.items);
  if (items.length === 0) return fail(400, 'items required');
  const actor = extractActor(request);

  const subtotal = items.reduce((s, it) => s + it.quantity * it.cost_price, 0);
  const initStatus = body.status === 'submitted' ? 'submitted' : 'draft';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const numRes = await client.query(`SELECT COUNT(*) + 1 AS n FROM purchase_requests`);
    const requestNumber = `PR-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(numRes.rows[0].n).padStart(4, '0')}`;

    const prRes = await client.query(
      `INSERT INTO purchase_requests
         (request_number, supplier_id, supplier_name, status, needed_by, subtotal, total, reason, note,
          branch_id, requested_by, requested_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        requestNumber,
        Number(body.supplier_id) || null,
        body.supplier_name?.trim() || null,
        initStatus,
        body.needed_by || null,
        subtotal, subtotal,
        body.reason?.trim() || null,
        body.note?.trim() || null,
        Number(body.branch_id) || null,
        actor.username || null,
        actor.user_id || null,
      ]
    );
    const pr = prRes.rows[0];

    for (const it of items) {
      await client.query(
        `INSERT INTO purchase_request_items (request_id, product_id, product_name, quantity, cost_price, amount, note)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [pr.id, it.product_id, it.product_name, it.quantity, it.cost_price, it.quantity * it.cost_price, it.note]
      );
    }
    await client.query('COMMIT');
    return ok(pr);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
