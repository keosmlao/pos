export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureUsersSchema } from '@/lib/migrations';
import { hashPassword } from '@/lib/passwords';
import { createFullPermissions, normalizePermissions as normalizeFromMenu } from '@/lib/adminMenu';
const validRoles = new Set(['admin', 'cashier']);

// ໃຊ້ລາຍການ path ຈາກ lib/adminMenu.js (ແຫຼ່ງດຽວກັບ UI) — ເມື່ອກ່ອນລາຍການນີ້ຂາດ 16 ໜ້າ
// ເຮັດໃຫ້ສິດທີ່ຕັ້ງໄວ້ຫາຍທຸກຄັ້ງທີ່ບັນທຶກຜູ້ໃຊ້
function normalizePermissions(input, role) {
  if (role === 'admin') return createFullPermissions();
  const normalized = normalizeFromMenu(input);
  for (const p of Object.values(normalized)) {
    if (!p.access) { p.edit = false; p.delete = false; }
  }
  return normalized;
}

async function adminCount(client = pool) {
  const result = await client.query(`SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'`);
  return result.rows[0]?.count || 0;
}

export const PUT = handle(async (request, { params }) => {
  await ensureUsersSchema();
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return fail(400, 'invalid id');

  const { username, password, display_name, role, permissions, commission_rate, sales_target, branch_id } = await readJson(request);
  const cleanUsername = String(username || '').trim();
  const cleanDisplayName = String(display_name || '').trim();
  const cleanRole = validRoles.has(role) ? role : 'cashier';
  const cleanPermissions = normalizePermissions(permissions, cleanRole);
  const commission = Math.max(0, Math.min(100, Number(commission_rate) || 0));
  const target = Math.max(0, Number(sales_target) || 0);
  const branch = Number(branch_id) || null;
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

    const values = [cleanUsername, cleanDisplayName, cleanRole, JSON.stringify(cleanPermissions), commission, target, branch, numericId];
    let query = `
      UPDATE users
      SET username = $1, display_name = $2, role = $3, permissions = $4::jsonb,
          commission_rate = $5, sales_target = $6, branch_id = $7
      WHERE id = $8
      RETURNING id, username, display_name, role, permissions, commission_rate, sales_target, branch_id, created_at
    `;
    if (password) {
      values.splice(7, 0, await hashPassword(password));
      query = `
        UPDATE users
        SET username = $1, display_name = $2, role = $3, permissions = $4::jsonb,
            commission_rate = $5, sales_target = $6, branch_id = $7, password = $8
        WHERE id = $9
        RETURNING id, username, display_name, role, permissions, commission_rate, sales_target, branch_id, created_at
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
