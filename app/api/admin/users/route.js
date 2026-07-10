export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureUsersSchema } from '@/lib/migrations';
import { hashPassword } from '@/lib/passwords';
import { normalizeRolePermissions as normalizePermissions } from '@/lib/adminMenu';
const validRoles = new Set(['admin', 'cashier']);

export const GET = handle(async () => {
  await ensureUsersSchema();
  const result = await pool.query(
    `SELECT id, username, display_name, role, COALESCE(permissions, '{}'::jsonb) AS permissions,
            COALESCE(commission_rate, 0) AS commission_rate,
            COALESCE(sales_target, 0) AS sales_target,
            branch_id, created_at
     FROM users
     ORDER BY role = 'admin' DESC, username ASC`
  );
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureUsersSchema();
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
  if (!password || String(password).length < 4) return fail(400, 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 4 ຕົວ');

  try {
    const result = await pool.query(
      `INSERT INTO users (username, password, display_name, role, permissions, commission_rate, sales_target, branch_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
       RETURNING id, username, display_name, role, permissions, commission_rate, sales_target, branch_id, created_at`,
      [cleanUsername, await hashPassword(password), cleanDisplayName, cleanRole, JSON.stringify(cleanPermissions), commission, target, branch]
    );
    return ok(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') return fail(409, 'username ນີ້ມີຢູ່ແລ້ວ');
    throw e;
  }
});
