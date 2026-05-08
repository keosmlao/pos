export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureUsersSchema } from '@/lib/migrations';

const hashPassword = (password) => crypto.createHash('sha256').update(String(password || '')).digest('hex');
const validRoles = new Set(['admin', 'cashier']);

export const GET = handle(async () => {
  await ensureUsersSchema();
  const result = await pool.query(
    `SELECT id, username, display_name, role, created_at
     FROM users
     ORDER BY role = 'admin' DESC, username ASC`
  );
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureUsersSchema();
  const { username, password, display_name, role } = await readJson(request);
  const cleanUsername = String(username || '').trim();
  const cleanDisplayName = String(display_name || '').trim();
  const cleanRole = validRoles.has(role) ? role : 'cashier';

  if (!cleanUsername) return fail(400, 'ກະລຸນາປ້ອນ username');
  if (!cleanDisplayName) return fail(400, 'ກະລຸນາປ້ອນຊື່ສະແດງ');
  if (!password || String(password).length < 4) return fail(400, 'ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 4 ຕົວ');

  try {
    const result = await pool.query(
      `INSERT INTO users (username, password, display_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, display_name, role, created_at`,
      [cleanUsername, hashPassword(password), cleanDisplayName, cleanRole]
    );
    return ok(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') return fail(409, 'username ນີ້ມີຢູ່ແລ້ວ');
    throw e;
  }
});
