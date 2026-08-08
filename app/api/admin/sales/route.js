export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { ensureOrdersSchema, ensureReturnsSchema, ensureBranchesSchema } from '@/lib/migrations';

export const GET = handle(async (request) => {
  await ensureOrdersSchema();     // ຄົ້ນຫາອີງ o.bill_number ຈຶ່ງຕ້ອງແນ່ໃຈວ່າມີຖັນນີ້
  await ensureReturnsSchema();
  await ensureBranchesSchema();   // ຄິວຣີ JOIN branches — ຖ້າຍັງບໍ່ມີຕາຕະລາງຈະ 500
  const sp = request.nextUrl.searchParams;
  const start = sp.get('start');
  const end = sp.get('end');
  const branchId = sp.get('branch_id');
  const search = String(sp.get('search') || '').trim().toLowerCase();
  const rowLimit = Math.max(50, Math.min(5000, Number(sp.get('limit')) || 3000));

  // ຄົ້ນຫາເລກບິນ ຄົ້ນທົ່ວປະຫວັດ ບໍ່ຈຳກັດຊ່ວງວັນທີ — ຄົນຄົ້ນເລກບິນ
  // ມັກບໍ່ຮູ້ວ່າບິນນັ້ນຢູ່ວັນທີໃດ ຖ້າຍັງກອງວັນທີຢູ່ຈະຫາບໍ່ພົບ
  const searchAllHistory = search.length > 0;

  let query = `
    WITH order_refunds AS (
      SELECT order_id, COALESCE(SUM(refund_amount), 0)::float AS refund_total
      FROM returns
      GROUP BY order_id
    ),
    item_returns AS (
      SELECT order_item_id, COALESCE(SUM(quantity), 0)::float AS returned_qty
      FROM return_items
      GROUP BY order_item_id
    )
    SELECT o.*,
      b.name AS branch_name,
      COALESCE(orf.refund_total, 0)::float AS refund_total,
      json_agg(json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'quantity', oi.quantity,
        'returned_qty', COALESCE(ir.returned_qty, 0),
        'price', oi.price,
        'product_name', p.product_name
      )) as items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id
    LEFT JOIN branches b ON b.id = o.branch_id
    LEFT JOIN order_refunds orf ON orf.order_id = o.id
    LEFT JOIN item_returns ir ON ir.order_item_id = oi.id
  `;
  const params = [];
  const conditions = [];

  if (start && !searchAllHistory) {
    params.push(start);
    conditions.push(`o.created_at::date >= $${params.length}`);
  }
  if (end && !searchAllHistory) {
    params.push(end);
    conditions.push(`o.created_at::date <= $${params.length}`);
  }
  if (branchId) {
    params.push(Number(branchId));
    conditions.push(`o.branch_id = $${params.length}`);
  }
  if (searchAllHistory) {
    params.push(`%${search}%`);
    const n = params.length;
    conditions.push(`(
      LOWER(COALESCE(o.bill_number, '')) LIKE $${n}
      OR CAST(o.id AS text) LIKE $${n}
      OR LOWER(COALESCE(o.customer_name, '')) LIKE $${n}
      OR LOWER(COALESCE(o.customer_phone, '')) LIKE $${n}
      OR LOWER(COALESCE(o.note, '')) LIKE $${n}
      OR EXISTS (
        SELECT 1 FROM order_items oi2
        JOIN products p2 ON p2.id = oi2.product_id
        WHERE oi2.order_id = o.id AND LOWER(p2.product_name) LIKE $${n}
      )
    )`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ` GROUP BY o.id, b.name, orf.refund_total
             ORDER BY o.created_at DESC
             LIMIT ${rowLimit}`;

  const result = await pool.query(query, params);
  return ok(result.rows);
});