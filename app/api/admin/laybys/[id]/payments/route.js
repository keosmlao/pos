export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureLaybysSchema } from '@/lib/migrations';
import { extractActor } from '@/lib/audit';

export const POST = handle(async (request, { params }) => {
  await ensureLaybysSchema();
  const { id } = await params;
  const lid = Number(id);
  if (!Number.isInteger(lid) || lid <= 0) return fail(400, 'Invalid id');
  const body = await readJson(request);
  const amount = Math.max(0, Number(body.amount) || 0);
  if (amount <= 0) return fail(400, 'amount > 0 required');

  const actor = extractActor(request);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lRes = await client.query(`SELECT * FROM laybys WHERE id = $1 FOR UPDATE`, [lid]);
    if (lRes.rowCount === 0) { await client.query('ROLLBACK'); return fail(404, 'Not found'); }
    const layby = lRes.rows[0];
    if (layby.status !== 'open') { await client.query('ROLLBACK'); return fail(400, 'Layby ບໍ່ໄດ້ເປີດ'); }
    const newPaid = Number(layby.paid) + amount;
    const newBalance = Math.max(0, Number(layby.total) - newPaid);
    if (newPaid > Number(layby.total)) {
      await client.query('ROLLBACK');
      return fail(400, `ຍອດຊຳລະເກີນ — ຄ້າງ ${layby.balance}`);
    }
    await client.query(
      `INSERT INTO layby_payments (layby_id, amount, payment_method, payment_date, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [lid, amount, body.payment_method || 'cash', body.payment_date || new Date().toISOString().slice(0, 10), body.note || null, actor.username || null]
    );
    await client.query(
      `UPDATE laybys SET paid = $1, balance = $2, updated_at = NOW() WHERE id = $3`,
      [newPaid, newBalance, lid]
    );
    await client.query('COMMIT');
    return ok({ paid: newPaid, balance: newBalance });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
