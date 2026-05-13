export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson, getQuery } from '@/lib/api';
import { ensureParkedCartsSchema } from '@/lib/migrations';
import { extractActor } from '@/lib/audit';

export const GET = handle(async (request) => {
  await ensureParkedCartsSchema();
  const { branch_id, mine } = getQuery(request);
  const where = [];
  const params = [];
  if (branch_id) { params.push(Number(branch_id)); where.push(`branch_id = $${params.length}`); }
  if (mine) {
    const actor = extractActor(request);
    if (actor.user_id) { params.push(actor.user_id); where.push(`user_id = $${params.length}`); }
  }
  const result = await pool.query(
    `SELECT id, user_id, username, branch_id, name, cart, discount, discount_mode, member_id, note, created_at, updated_at
     FROM parked_carts
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY updated_at DESC
     LIMIT 100`,
    params
  );
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureParkedCartsSchema();
  const body = await readJson(request);
  const cart = Array.isArray(body.cart) ? body.cart : null;
  if (!cart || cart.length === 0) return fail(400, 'cart is required');

  const actor = extractActor(request);
  const name = String(body.name || '').trim() || `Park ${new Date().toLocaleString('lo-LA')}`;
  const result = await pool.query(
    `INSERT INTO parked_carts (user_id, username, branch_id, name, cart, discount, discount_mode, member_id, note)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
     RETURNING *`,
    [
      actor.user_id || null,
      actor.username || null,
      Number(body.branch_id) || null,
      name,
      JSON.stringify(cart),
      Number(body.discount) || 0,
      body.discount_mode || null,
      Number(body.member_id) || null,
      body.note || null,
    ]
  );
  return ok(result.rows[0]);
});
