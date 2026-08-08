export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { fail, handle, ok } from '@/lib/api';
import { ensurePurchaseReturnsSchema } from '@/lib/migrations';
import { publishEvent } from '@/lib/appEvents';
import { recalcProductCosts } from '@/lib/productCost';

// ຍົກເລີກໃບສົ່ງຄືນ — ສິນຄ້າກັບເຂົ້າສາງ ແລະ ຍ້ອນຜົນທາງບັນຊີຄືນ
export const DELETE = handle(async (_request, { params }) => {
  await ensurePurchaseReturnsSchema();
  const { id } = await params;
  const returnId = Number(id);
  if (!Number.isInteger(returnId) || returnId <= 0) return fail(400, 'Invalid return id');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const retRes = await client.query(
      `SELECT id, return_number, purchase_id, refund_amount, settle_mode
       FROM purchase_returns WHERE id = $1 FOR UPDATE`,
      [returnId]
    );
    if (retRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'ບໍ່ພົບໃບສົ່ງຄືນ');
    }
    const ret = retRes.rows[0];

    const itemsRes = await client.query(
      'SELECT product_id, quantity FROM purchase_return_items WHERE purchase_return_id = $1',
      [returnId]
    );
    for (const it of itemsRes.rows) {
      if (!it.product_id) continue;
      await client.query(
        'UPDATE products SET qty_on_hand = qty_on_hand + $1 WHERE id = $2',
        [Number(it.quantity) || 0, it.product_id]
      );
    }

    if (ret.settle_mode === 'debt') {
      await client.query(
        `UPDATE purchases SET paid = GREATEST(0, COALESCE(paid, 0) - $1) WHERE id = $2`,
        [Number(ret.refund_amount) || 0, ret.purchase_id]
      );
      await client.query(
        `UPDATE purchases SET status = CASE WHEN paid >= total THEN 'paid' WHEN paid > 0 THEN 'partial' ELSE 'pending' END
         WHERE id = $1`,
        [ret.purchase_id]
      );
    }

    await client.query('DELETE FROM purchase_returns WHERE id = $1', [returnId]);
    // ຍົກເລີກໃບສົ່ງຄືນແລ້ວ ຕົ້ນທຶນຕ້ອງກັບໄປຕາມເອກະສານທີ່ຍັງເຫຼືອ
    await recalcProductCosts(client, itemsRes.rows.map(i => i.product_id));
    await client.query('COMMIT');

    publishEvent('purchase.return_void', { id: returnId, return_number: ret.return_number }).catch(() => {});
    return ok({ id: returnId, return_number: ret.return_number });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
