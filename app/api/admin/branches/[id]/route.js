export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureBranchesSchema } from '@/lib/migrations';

export const PUT = handle(async (request, { params }) => {
  await ensureBranchesSchema();
  const { id } = await params;
  const bid = Number(id);
  if (!Number.isInteger(bid) || bid <= 0) return fail(400, 'Invalid id');
  const body = await readJson(request);
  const name = String(body.name || '').trim();
  if (!name) return fail(400, 'name is required');

  try {
    const result = await pool.query(
      `UPDATE branches SET
         name = $1, code = $2, address = $3, phone = $4,
         active = $5, sort_order = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [
        name,
        String(body.code || '').trim().toUpperCase() || null,
        String(body.address || '').trim() || null,
        String(body.phone || '').trim() || null,
        body.active !== false,
        Number(body.sort_order) || 0,
        bid,
      ]
    );
    if (result.rowCount === 0) return fail(404, 'Not found');
    return ok(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') return fail(409, 'ລະຫັດສາຂາ (code) ນີ້ມີຢູ່ແລ້ວ');
    throw e;
  }
});

export const DELETE = handle(async (_request, { params }) => {
  await ensureBranchesSchema();
  const { id } = await params;
  const bid = Number(id);
  if (!Number.isInteger(bid) || bid <= 0) return fail(400, 'Invalid id');

  // Don't delete the default branch
  const checkRes = await pool.query('SELECT is_default FROM branches WHERE id = $1', [bid]);
  if (checkRes.rowCount === 0) return fail(404, 'Not found');
  if (checkRes.rows[0].is_default) return fail(400, 'ບໍ່ສາມາດລົບສາຂາຫຼັກໄດ້');

  // Check for usage
  const usageRes = await pool.query(
    `SELECT (SELECT COUNT(*) FROM orders WHERE branch_id = $1) AS orders,
            (SELECT COUNT(*) FROM users WHERE branch_id = $1) AS users`,
    [bid]
  );
  const { orders, users } = usageRes.rows[0];
  if (Number(orders) > 0 || Number(users) > 0) {
    return fail(400, `ບໍ່ສາມາດລົບ — ມີຄຳສັ່ງຊື້ ${orders} ບີນ ແລະ ຜູ້ໃຊ້ ${users} ຄົນຜູກກັບສາຂານີ້`);
  }

  await pool.query('DELETE FROM branches WHERE id = $1', [bid]);
  return ok({ deleted: bid });
});
