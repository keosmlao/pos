export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureMembersSchema } from '@/lib/migrations';

function clean(value) {
  return String(value || '').trim();
}

export const PATCH = handle(async (request, { params }) => {
  await ensureMembersSchema();
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return fail(400, 'Invalid member id');

  const body = await readJson(request);
  const name = clean(body.name);
  if (!name) return fail(400, 'name is required');
  const province = clean(body.province);
  const district = clean(body.district);
  const village = clean(body.village);
  if (!province || !district || !village) return fail(400, 'province, district and village are required');

  try {
    const result = await pool.query(
      `UPDATE members
       SET member_code = $1,
           name = $2,
           phone = $3,
           email = $4,
           province = $5,
           district = $6,
           village = $7,
           address = $8,
           tier = $9,
           points = $10,
           total_spent = $11,
           active = $12,
           note = $13,
           credit_limit = $14,
           updated_at = NOW()
       WHERE id = $15
       RETURNING *`,
      [
        clean(body.member_code),
        name,
        clean(body.phone) || null,
        clean(body.email) || null,
        province,
        district,
        village,
        clean(body.address) || null,
        clean(body.tier) || 'standard',
        Math.max(0, Number(body.points) || 0),
        Math.max(0, Number(body.total_spent) || 0),
        body.active !== false,
        clean(body.note) || null,
        Math.max(0, Number(body.credit_limit) || 0),
        numericId,
      ]
    );
    if (result.rowCount === 0) return fail(404, 'Member not found');
    return ok(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') return fail(409, 'member code or phone already exists');
    throw error;
  }
});

export const DELETE = handle(async (request, { params }) => {
  await ensureMembersSchema();
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return fail(400, 'Invalid member id');

  const result = await pool.query(
    `UPDATE members SET active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [numericId]
  );
  if (result.rowCount === 0) return fail(404, 'Member not found');
  return ok(result.rows[0]);
});
