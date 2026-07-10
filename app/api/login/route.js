export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, fail, ok, readJson } from '@/lib/api';
import { ensureUsersSchema } from '@/lib/migrations';
import { verifyPassword, hashPassword, isLegacyHash } from '@/lib/passwords';
import { createSession, sessionCookie } from '@/lib/auth';
import { consumeRateLimit, clearRateLimit } from '@/lib/rateLimit';

export const POST = handle(async (request) => {
  await ensureUsersSchema();
  const { username, password } = await readJson(request);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  const accountKey = `login-account:${ip}:${String(username || '').trim().toLowerCase()}`;
  const ipKey = `login-ip:${ip}`;
  const accountRate = consumeRateLimit(accountKey, { limit: 5 });
  const ipRate = consumeRateLimit(ipKey, { limit: 30 });
  if (!accountRate.allowed || !ipRate.allowed) {
    return fail(429, `ລອງເຂົ້າລະບົບຫຼາຍເກີນໄປ ກະລຸນາລໍຖ້າ ${Math.max(accountRate.retryAfter, ipRate.retryAfter)} ວິນາທີ`);
  }
  const result = await pool.query(
    `SELECT id, username, password, display_name, role, COALESCE(permissions, '{}'::jsonb) AS permissions
     FROM users WHERE username = $1`,
    [username]
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(password, user.password))) {
    return fail(401, 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ');
  }
  clearRateLimit(accountKey);
  clearRateLimit(ipKey);

  // upgrade hash ເກົ່າ (sha256) ເປັນ bcrypt ແບບອັດຕະໂນມັດ
  if (isLegacyHash(user.password)) {
    const upgraded = await hashPassword(password);
    pool.query('UPDATE users SET password = $1 WHERE id = $2', [upgraded, user.id]).catch(() => {});
  }

  const token = await createSession(user.id);
  const { password: _pw, ...safeUser } = user;
  return ok(safeUser, { headers: { 'Set-Cookie': sessionCookie(token) } });
});
