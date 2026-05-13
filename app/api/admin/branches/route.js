export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureBranchesSchema } from '@/lib/migrations';

export const GET = handle(async () => {
  await ensureBranchesSchema();
  const result = await pool.query(
    `SELECT * FROM branches ORDER BY sort_order, id`
  );
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureBranchesSchema();
  const body = await readJson(request);
  const name = String(body.name || '').trim();
  if (!name) return fail(400, 'name is required');
  const code = String(body.code || '').trim().toUpperCase() || null;
  const address = String(body.address || '').trim() || null;
  const phone = String(body.phone || '').trim() || null;
  const active = body.active !== false;
  const sortOrder = Number(body.sort_order) || 0;

  try {
    const result = await pool.query(
      `INSERT INTO branches (name, code, address, phone, active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, code, address, phone, active, sortOrder]
    );
    return ok(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') return fail(409, 'ລະຫັດສາຂາ (code) ນີ້ມີຢູ່ແລ້ວ');
    throw e;
  }
});
