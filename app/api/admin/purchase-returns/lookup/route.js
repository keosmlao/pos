export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { fail, handle, ok, getQuery } from '@/lib/api';
import { ensurePurchaseReturnsSchema } from '@/lib/migrations';

// ດຶງບິນຊື້ເຂົ້າ 1 ໃບ ພ້ອມຈຳນວນທີ່ຍັງສົ່ງຄືນໄດ້ ແລະ ຕົ້ນທຶນຫຼັງປັນສ່ວນສ່ວນຫຼຸດ
export const GET = handle(async (request) => {
  await ensurePurchaseReturnsSchema();
  const { q = '' } = getQuery(request);
  const query = String(q || '').trim();
  if (!query) return fail(400, 'q is required');

  const purRes = await pool.query(
    `SELECT p.*, s.name AS supplier_name, s.phone AS supplier_phone
     FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.ref_number = $1 OR p.sml_doc_no = $1 OR p.id::text = REGEXP_REPLACE($1, '^#', '')
     ORDER BY p.created_at DESC LIMIT 1`,
    [query]
  );
  if (purRes.rowCount === 0) return fail(404, 'ບໍ່ພົບບິນຊື້ເຂົ້າ');
  const purchase = purRes.rows[0];

  const itemsRes = await pool.query(
    `WITH gross AS (
       SELECT COALESCE(SUM(quantity * cost_price), 0)::numeric AS total_gross
       FROM purchase_items WHERE purchase_id = $1
     )
     SELECT
       pi.id AS purchase_item_id,
       pi.product_id,
       pd.product_name,
       pd.product_code,
       COALESCE(pd.unit, '') AS unit,
       COALESCE(pd.qty_on_hand, 0)::float AS qty_on_hand,
       pi.quantity::float AS bought_qty,
       pi.cost_price::float AS cost_price,
       (pi.cost_price * CASE WHEN gross.total_gross > 0
          THEN (SELECT COALESCE(p2.total, 0) FROM purchases p2 WHERE p2.id = $1) / gross.total_gross
          ELSE 1 END)::float AS net_price,
       COALESCE(SUM(pri.quantity), 0)::float AS returned_qty,
       GREATEST(0, pi.quantity - COALESCE(SUM(pri.quantity), 0))::float AS returnable_qty
     FROM purchase_items pi
     CROSS JOIN gross
     LEFT JOIN products pd ON pd.id = pi.product_id
     LEFT JOIN purchase_return_items pri ON pri.purchase_item_id = pi.id
     WHERE pi.purchase_id = $1
     GROUP BY pi.id, pd.product_name, pd.product_code, pd.unit, pd.qty_on_hand, gross.total_gross
     ORDER BY pi.id`,
    [purchase.id]
  );

  const grossRes = await pool.query(
    `SELECT COALESCE(SUM(quantity * cost_price), 0)::float AS gross FROM purchase_items WHERE purchase_id = $1`,
    [purchase.id]
  );
  const purchaseGross = Number(grossRes.rows[0]?.gross) || 0;
  const purchaseTotal = Number(purchase.total) || 0;

  const returnsRes = await pool.query(
    `SELECT id, return_number, refund_amount, gross_amount, settle_mode, payments, note, created_at
     FROM purchase_returns WHERE purchase_id = $1 ORDER BY created_at DESC`,
    [purchase.id]
  );

  return ok({
    purchase,
    items: itemsRes.rows,
    returns: returnsRes.rows,
    pricing: {
      purchase_gross: purchaseGross,
      purchase_total: purchaseTotal,
      net_ratio: purchaseGross > 0 ? purchaseTotal / purchaseGross : 1,
      total_discount: Math.max(0, purchaseGross - purchaseTotal),
      discounted: purchaseGross > purchaseTotal + 0.5,
    },
    debt: {
      total: purchaseTotal,
      paid: Number(purchase.paid) || 0,
      remaining: Math.max(0, purchaseTotal - (Number(purchase.paid) || 0)),
      payment_type: purchase.payment_type || 'cash',
      status: purchase.status,
    },
  });
});
