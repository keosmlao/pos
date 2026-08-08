export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api';
import { extractActor } from '@/lib/audit';
import { publishEvent } from '@/lib/appEvents';

export const DELETE = handle(async (request, { params }) => {
  const { id } = await params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const purchaseRes = await client.query(
      `SELECT p.ref_number, p.total, p.currency, s.name AS supplier_name
       FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.id = $1`,
      [id]
    );
    const purchase = purchaseRes.rows[0];

    // ບິນທີ່ມີໃບສົ່ງຄືນຜູ້ສະໜອງແລ້ວ ລົບບໍ່ໄດ້ — ຕ້ອງຍົກເລີກໃບສົ່ງຄືນກ່ອນ
    const prCount = await client.query(
      `SELECT COUNT(*)::int AS n FROM purchase_returns WHERE purchase_id = $1`, [id]
    ).catch(() => ({ rows: [{ n: 0 }] }));
    if (Number(prCount.rows[0]?.n) > 0) {
      await client.query('ROLLBACK');
      return fail(400, 'ບິນນີ້ມີໃບສົ່ງຄືນຜູ້ສະໜອງແລ້ວ — ກະລຸນາຍົກເລີກໃບສົ່ງຄືນກ່ອນ');
    }

    const items = await client.query('SELECT * FROM purchase_items WHERE purchase_id = $1', [id]);
    for (const item of items.rows) {
      await client.query(
        'UPDATE products SET qty_on_hand = qty_on_hand - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    await client.query('DELETE FROM debt_payments WHERE purchase_id = $1', [id]);
    await client.query('DELETE FROM purchase_items WHERE purchase_id = $1', [id]);
    await client.query('UPDATE pending_invoices SET purchase_id = NULL WHERE purchase_id = $1', [id]);
    await client.query('DELETE FROM purchases WHERE id = $1', [id]);

    await client.query('COMMIT');
    const actor = extractActor(request);
    publishEvent({
      type: 'purchase.void',
      title: 'ຍົກເລີກບິນຊື້',
      body: `${purchase?.ref_number || '#' + id} · ${purchase?.supplier_name || 'ບໍ່ມີຜູ້ສະໜອງ'} · ${Number(purchase?.total || 0).toLocaleString('en-US')} ${purchase?.currency || 'LAK'}`,
      data: { purchase_id: Number(id), ref_number: purchase?.ref_number, supplier_name: purchase?.supplier_name, total: Number(purchase?.total) || 0 },
      actor: actor.username,
    }).catch(() => {});
    return ok({ message: 'Purchase deleted' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});