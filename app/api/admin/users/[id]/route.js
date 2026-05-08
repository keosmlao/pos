export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureUsersSchema } from '@/lib/migrations';

const hashPassword = (password) => crypto.createHash('sha256').update(String(password || '')).digest('hex');
const validRoles = new Set(['admin', 'cashier']);

async function adminCount(client = pool) {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'`);
  return result.rows[0]?.count || 0;
}

export const PUT = handle(async (request, { params }) => {
  await ensureUsersSchema();
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return fail(400, 'invalid id');

  const { username, password, display_name, role } = await readJson(request);
  const cleanUsername = String(username || '').trim();
  const cleanDisplayName = String(display_name || '').trim();
  const cleanRole = validRoles.has(role) ? role : 'cashier';
  if (!cleanUsername) return fail(400, 'ກະລຸນາປ້ອນ username');
  if (!cleanDisplayName) return fail(400, 'ກະລຸນາປ້ອນຊື່ສະແດງ');
  if (password && String(password).length < 4) return fail(400, 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 4 ຕົວ');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT id, role FROM users WHERE id = $1', [numericId]);
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'not found');
    }
    if (current.rows[0].role === 'admin' && cleanRole !== 'admin' && await adminCount(client) <= 1) {
      await client.query('ROLLBACK');
      return fail(400, 'ບໍ່ສາມາດປ່ຽນ admin ຄົນສຸດທ້າຍໄດ້');
    }

    const values = [cleanUsername, cleanDisplayName, cleanRole, numericId];
    let query = `
      UPDATE users
      SET username = $1, display_name = $2, role = $3
      WHERE id = $4
      RETURNING id, username, display_name, role, created_at
    `;
    if (password) {
      values.splice(3, 0, hashPassword(password));
      query = `
        UPDATE users
        SET username = $1, display_name = $2, role = $3, password = $4
        WHERE id = $5
        RETURNING id, username, display_name, role, created_at
      `;
    }
    const result = await client.query(query, values);
    await client.query('COMMIT');
    return ok(result.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return fail(409, 'username ນີ້ມີຢູ່ແລ້ວ');
    throw e;
  } finally {
    client.release();
  }
});

export const DELETE = handle(async (_request, { params }) => {
  await ensureUsersSchema();
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return fail(400, 'invalid id');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT id, role FROM users WHERE id = $1', [numericId]);
    if (current.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'not found');
    }
    if (current.rows[0].role === 'admin' && await adminCount(client) <= 1) {
      await client.query('ROLLBACK');
      return fail(400, 'ບໍ່ສາມາດລົບ admin ຄົນສຸດທ້າຍໄດ້');
    }
    await client.query('DELETE FROM users WHERE id = $1', [numericId]);
    await client.query('COMMIT');
    return ok({ message: 'deleted', id: numericId });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
