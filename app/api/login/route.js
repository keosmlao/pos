export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import pool from '@/lib/db';
import { handle, fail, ok, readJson } from '@/lib/api';
import { ensureUsersSchema } from '@/lib/migrations';

export const POST = handle(async (request) => {
  await ensureUsersSchema();
  const { username, password } = await readJson(request);
  const hashedPassword = crypto.createHash('sha256').update(String(password || '')).digest('hex');
  const result = await pool.query(
    `SELECT id, username, display_name, role, COALESCE(permissions, '{}'::jsonb) AS permissions
     FROM users WHERE username = $1 AND password = $2`,
    [username, hashedPassword]
  );
  if (result.rows.length === 0) {
    return fail(401, 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ');
  }
  return ok(result.rows[0]);
});
