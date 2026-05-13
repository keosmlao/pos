export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson, getQuery } from '@/lib/api';
import { ensureLaybysSchema } from '@/lib/migrations';
import { extractActor } from '@/lib/audit';

export const GET = handle(async (request) => {
  await ensureLaybysSchema();
  const { status } = getQuery(request);
  const where = [];
  const params = [];
  if (status) { params.push(status); where.push(`l.status = $${params.length}`); }
  const result = await pool.query(
    `SELECT l.*,
       (SELECT COUNT(*) FROM layby_items WHERE layby_id = l.id) AS item_count
     FROM laybys l
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY l.created_at DESC LIMIT 500`,
    params
  );
  return ok(result.rows);
});

function normalizeItems(items) {
  const list = Array.isArray(items) ? items : [];
  return list.map(it => ({
    product_id: Number(it.product_id) || null,
    variant_id: Number(it.variant_id) || null,
    quantity: Math.max(0, Number(it.quantity) || 0),
    price: Math.max(0, Number(it.price) || 0),
  })).filter(it => it.product_id && it.quantity > 0);
}

export const POST = handle(async (request) => {
  await ensureLaybysSchema();
  const body = await readJson(request);
  const customerName = String(body.customer_name || '').trim();
  if (!customerName) return fail(400, 'customer_name is required');
  const items = normalizeItems(body.items);
  if (items.length === 0) return fail(400, 'items is required');

  const subtotal = items.reduce((s, it) => s + it.quantity * it.price, 0);
  const discount = Math.max(0, Number(body.discount) || 0);
  const total = Math.max(0, subtotal - discount);
  const deposit = Math.max(0, Number(body.deposit) || 0);
  if (deposit > total) return fail(400, 'deposit ເກີນຍອດລວມ');

  const actor = extractActor(request);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Allocate layby number
    const numRes = await client.query(`SELECT COUNT(*) + 1 AS n FROM laybys`);
    const layNumber = `LAY-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(numRes.rows[0].n).padStart(4, '0')}`;

    const laybyRes = await client.query(
      `INSERT INTO laybys (layby_number, customer_name, customer_phone, member_id, status,
                           subtotal, discount, total, paid, balance, due_date, note, branch_id, created_by)
       VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        layNumber,
        customerName,
        body.customer_phone || null,
        Number(body.member_id) || null,
        subtotal, discount, total, deposit, total - deposit,
        body.due_date || null,
        body.note || null,
        Number(body.branch_id) || null,
        actor.username || null,
      ]
    );
    const layby = laybyRes.rows[0];

    // Insert items + decrement stock now (items reserved)
    for (const it of items) {
      await client.query(
        `INSERT INTO layby_items (layby_id, product_id, variant_id, quantity, price)
         VALUES ($1, $2, $3, $4, $5)`,
        [layby.id, it.product_id, it.variant_id, it.quantity, it.price]
      );
      if (it.variant_id) {
        await client.query(`UPDATE product_variants SET qty_on_hand = qty_on_hand - $1 WHERE id = $2`, [it.quantity, it.variant_id]);
      } else {
        await client.query(`UPDATE products SET qty_on_hand = qty_on_hand - $1 WHERE id = $2`, [it.quantity, it.product_id]);
      }
    }

    // Initial deposit payment
    if (deposit > 0) {
      await client.query(
        `INSERT INTO layby_payments (layby_id, amount, payment_method, note, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [layby.id, deposit, body.payment_method || 'cash', 'ມັດຈຳເບື້ອງຕົ້ນ', actor.username || null]
      );
    }

    await client.query('COMMIT');
    return ok(layby);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
