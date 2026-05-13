export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensurePurchaseRequestsSchema } from '@/lib/migrations';
import { extractActor } from '@/lib/audit';

export const GET = handle(async (_request, { params }) => {
  await ensurePurchaseRequestsSchema();
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) return fail(400, 'Invalid id');
  const prRes = await pool.query(`SELECT * FROM purchase_requests WHERE id = $1`, [pid]);
  if (prRes.rowCount === 0) return fail(404, 'Not found');
  const itemsRes = await pool.query(
    `SELECT pri.*, p.product_code, p.unit, p.cost_price AS current_cost
     FROM purchase_request_items pri
     LEFT JOIN products p ON p.id = pri.product_id
     WHERE pri.request_id = $1 ORDER BY pri.id`,
    [pid]
  );
  return ok({ ...prRes.rows[0], items: itemsRes.rows });
});

// Actions: submit, approve, reject, cancel.
export const PUT = handle(async (request, { params }) => {
  await ensurePurchaseRequestsSchema();
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) return fail(400, 'Invalid id');
  const body = await readJson(request);
  const actor = extractActor(request);

  if (body.action === 'submit') {
    const r = await pool.query(
      `UPDATE purchase_requests SET status = 'submitted', updated_at = NOW()
       WHERE id = $1 AND status = 'draft' RETURNING *`,
      [pid]
    );
    if (r.rowCount === 0) return fail(400, 'PR ບໍ່ສາມາດສົ່ງໄດ້ (ບໍ່ແມ່ນ draft ຫຼື ບໍ່ພົບ)');
    return ok(r.rows[0]);
  }
  if (body.action === 'approve') {
    const r = await pool.query(
      `UPDATE purchase_requests SET status = 'approved', approved_at = NOW(), approved_by = $1, updated_at = NOW()
       WHERE id = $2 AND status IN ('draft','submitted') RETURNING *`,
      [actor.username || null, pid]
    );
    if (r.rowCount === 0) return fail(400, 'PR ບໍ່ສາມາດອະນຸມັດໄດ້');
    return ok(r.rows[0]);
  }
  if (body.action === 'reject') {
    const r = await pool.query(
      `UPDATE purchase_requests SET status = 'rejected', rejected_at = NOW(), approved_by = $1, updated_at = NOW()
       WHERE id = $2 AND status IN ('draft','submitted','approved') RETURNING *`,
      [actor.username || null, pid]
    );
    if (r.rowCount === 0) return fail(400, 'PR ບໍ່ສາມາດປະຕິເສດໄດ້');
    return ok(r.rows[0]);
  }
  if (body.action === 'mark_converted') {
    const purchaseId = Number(body.purchase_id);
    if (!Number.isInteger(purchaseId) || purchaseId <= 0) return fail(400, 'purchase_id required');
    const r = await pool.query(
      `UPDATE purchase_requests SET status = 'converted',
         converted_purchase_id = $1, converted_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'approved' RETURNING *`,
      [purchaseId, pid]
    );
    if (r.rowCount === 0) return fail(400, 'PR ບໍ່ສາມາດປ່ຽນສະຖານະໄດ້');
    return ok(r.rows[0]);
  }
  if (body.action === 'cancel') {
    const r = await pool.query(
      `UPDATE purchase_requests SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND status NOT IN ('converted','cancelled') RETURNING *`,
      [pid]
    );
    if (r.rowCount === 0) return fail(400, 'PR ບໍ່ສາມາດຍົກເລີກໄດ້');
    return ok(r.rows[0]);
  }
  return fail(400, 'Invalid action');
});

export const DELETE = handle(async (_request, { params }) => {
  await ensurePurchaseRequestsSchema();
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) return fail(400, 'Invalid id');
  const exists = await pool.query(`SELECT status FROM purchase_requests WHERE id = $1`, [pid]);
  if (exists.rowCount === 0) return fail(404, 'Not found');
  if (exists.rows[0].status === 'converted') {
    return fail(400, 'ບໍ່ສາມາດລົບ PR ທີ່ປ່ຽນເປັນບີນຊື້ແລ້ວ');
  }
  await pool.query(`DELETE FROM purchase_requests WHERE id = $1`, [pid]);
  return ok({ deleted: pid });
});
