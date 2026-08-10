export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensurePendingInvoicesSchema } from '@/lib/migrations';

// ເຊື່ອງ / ກູ້ຄືນ ບິນ pending
//   { action: 'dismiss', reason: '...' } → ບໍ່ໃຫ້ສະແດງ (ຕ້ອງມີເຫດຜົນ)
//   { action: 'restore' }                → ກັບມາສະແດງອີກ
// ບໍ່ລຶບແຖວ ເພາະ sync ຮອບຕໍ່ໄປຈະດຶງບິນນັ້ນກັບມາໃໝ່
export const PATCH = handle(async (request, { params }) => {
  await ensurePendingInvoicesSchema();
  const body = await readJson(request);
  const action = String(body?.action || 'dismiss');

  if (action === 'restore') {
    const r = await pool.query(
      `UPDATE pending_invoices
          SET dismissed_at = NULL, dismiss_reason = NULL, dismissed_by = NULL
        WHERE id = $1 RETURNING id`,
      [params.id]
    );
    if (!r.rows.length) return fail(404, 'ບໍ່ພົບບິນນີ້');
    return ok({ ok: true, restored: true });
  }

  const reason = String(body?.reason || '').trim();
  if (!reason) return fail(400, 'ກະລຸນາລະບຸເຫດຜົນທີ່ບໍ່ໃຫ້ສະແດງ');

  const r = await pool.query(
    `UPDATE pending_invoices
        SET dismissed_at = NOW(), dismiss_reason = $2, dismissed_by = $3
      WHERE id = $1 RETURNING id, doc_no`,
    [params.id, reason, request.sessionUser?.username || null]
  );
  if (!r.rows.length) return fail(404, 'ບໍ່ພົບບິນນີ້');
  return ok({ ok: true, dismissed: true, doc_no: r.rows[0].doc_no });
});

export const DELETE = handle(async (_request, { params }) => {
  await pool.query('DELETE FROM pending_invoices WHERE id = $1', [params.id]);
  return ok({ ok: true });
});
