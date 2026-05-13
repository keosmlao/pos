export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api';
import { ensureMembersSchema, ensureOrdersSchema } from '@/lib/migrations';
import { extractActor } from '@/lib/audit';
import { publishEvent } from '@/lib/appEvents';

export const DELETE = handle(async (request, { params }) => {
  await ensureOrdersSchema();
  await ensureMembersSchema();
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) return fail(400, 'Invalid order id');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query('SELECT id, bill_number, member_id, total, member_points_earned, member_points_used FROM orders WHERE id = $1', [numericId]);
    const items = await client.query('SELECT * FROM order_items WHERE order_id = $1', [numericId]);
    if (items.rowCount === 0) {
      if (orderRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return fail(404, 'Order not found');
      }
    }
    const returnsRes = await client.query(
      `SELECT r.id, r.return_number
         FROM returns r
        WHERE r.order_id = $1
        ORDER BY r.created_at`,
      [numericId]
    );
    if (returnsRes.rowCount > 0) {
      await client.query('ROLLBACK');
      const numbers = returnsRes.rows.map(r => r.return_number || `#${r.id}`).join(', ');
      return fail(409, `ບິນນີ້ມີການຮັບຄືນແລ້ວ (${numbers}). ກະລຸນາລົບການຮັບຄືນກ່ອນ ແລ້ວຄ່ອຍຍົກເລີກບິນ.`);
    }
    for (const it of items.rows) {
      await client.query(
        'UPDATE products SET qty_on_hand = qty_on_hand + $1 WHERE id = $2',
        [it.quantity, it.product_id]
      );
    }
    const order = orderRes.rows[0];
    if (order?.member_id) {
      const earned = Number(order.member_points_earned) || 0;
      const used = Number(order.member_points_used) || 0;
      const pointsRevert = used - earned;
      await client.query(
        `UPDATE members
         SET points = GREATEST(0, points + $1),
             total_spent = GREATEST(0, total_spent - $2),
             updated_at = NOW()
         WHERE id = $3`,
        [pointsRevert, Number(order.total) || 0, order.member_id]
      );
    }
    await client.query('DELETE FROM order_items WHERE order_id = $1', [numericId]);
    await client.query('DELETE FROM orders WHERE id = $1', [numericId]);
    await client.query('COMMIT');
    const actor = extractActor(request);
    publishEvent({
      type: 'order.void',
      title: 'ຍົກເລີກບິນຂາຍ',
      body: `ບິນ ${order?.bill_number || '#' + numericId} · ${Number(order?.total || 0).toLocaleString('en-US')} ກີບ`,
      data: { order_id: numericId, bill_number: order?.bill_number, total: Number(order?.total) || 0 },
      actor: actor.username,
    }).catch(() => {});
    return ok({ message: 'Order cancelled', id: numericId, restored_items: items.rowCount });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
