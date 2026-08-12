export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureMembersSchema } from '@/lib/migrations';
import { normalizeTaxId } from '@/lib/taxId';

function normalizeText(value) {
  return String(value || '').trim();
}

async function nextMemberCode(client = pool) {
  const res = await client.query(`SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM members`);
  return `MB${String(res.rows[0].next_id || 1).padStart(5, '0')}`;
}

export const GET = handle(async (request) => {
  await ensureMembersSchema();
  const q = normalizeText(request.nextUrl.searchParams.get('search')).toLowerCase();
  const params = [];
  let where = `WHERE m.active IS NOT FALSE`;
  if (q) {
    params.push(`%${q}%`);
    where += ` AND (LOWER(m.member_code) LIKE $1 OR LOWER(m.name) LIKE $1 OR LOWER(COALESCE(m.phone, '')) LIKE $1)`;
  }
  // points_expires_at ຕ້ອງອອກເປັນ 'YYYY-MM-DD' — ຖ້າປ່ອຍເປັນ Date ມັນຈະຖືກແປງເປັນ
  // UTC ຕອນ JSON ແລ້ວວັນເລື່ອນ 1 ວັນ (ລາວ = UTC+7)
  const result = await pool.query(
    `SELECT m.*, to_char(m.points_expires_at, 'YYYY-MM-DD') AS points_expires_at
     FROM members m ${where} ORDER BY m.updated_at DESC, m.id DESC LIMIT 30`,
    params
  );
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureMembersSchema();
  const body = await readJson(request);
  const name = normalizeText(body.name);
  if (!name) return fail(400, 'name is required');

  const phone = normalizeText(body.phone) || null;
  const email = normalizeText(body.email) || null;
  const province = normalizeText(body.province);
  const district = normalizeText(body.district);
  const village = normalizeText(body.village);
  const address = normalizeText(body.address) || null;
  const note = normalizeText(body.note) || null;
  if (!province || !district || !village) return fail(400, 'province, district and village are required');
  const taxId = normalizeTaxId(body.tax_id);
  if (!taxId.ok) return fail(400, taxId.error);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const code = normalizeText(body.member_code) || await nextMemberCode(client);
    const result = await client.query(
      `INSERT INTO members (member_code, name, phone, email, province, district, village, address, tier, points, total_spent, active, note, credit_limit, tax_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        code,
        name,
        phone,
        email,
        province,
        district,
        village,
        address,
        normalizeText(body.tier) || 'standard',
        Math.max(0, Number(body.points) || 0),
        Math.max(0, Number(body.total_spent) || 0),
        body.active !== false,
        note,
        Math.max(0, Number(body.credit_limit) || 0),
        taxId.value,
      ]
    );
    await client.query('COMMIT');
    return ok(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return fail(409, 'member code or phone already exists');
    throw error;
  } finally {
    client.release();
  }
});
