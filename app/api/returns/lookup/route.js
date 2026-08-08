export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { fail, handle, ok, getQuery } from '@/lib/api';
import { ensureReturnsSchema } from '@/lib/migrations';

export const GET = handle(async (request) => {
  await ensureReturnsSchema();
  const { q = '' } = getQuery(request);
  const query = String(q || '').trim();
  if (!query) return fail(400, 'q is required');

  const orderRes = await pool.query(
    `SELECT *
     FROM orders
     WHERE bill_number = $1 OR id::text = REGEXP_REPLACE($1, '^#', '')
     ORDER BY created_at DESC
     LIMIT 1`,
    [query]
  );
  if (orderRes.rowCount === 0) return fail(404, 'Order not found');
  const order = orderRes.rows[0];

  // ລາຄາຫຼັງຫຼຸດ = ລາຄາປ້າຍ × (ຍອດບິນຈິງ ÷ ມູນຄ່າສິນຄ້າລວມ) — ປັນສ່ວນສ່ວນຫຼຸດ,
  // ຫຼຸດດ້ວຍແຕ້ມ, VAT ແລະ ການປັດເສດ ທີ່ເກີດຂຶ້ນຕອນຂາຍ ລົງໃສ່ແຕ່ລະລາຍການ
  const itemsRes = await pool.query(
    `WITH gross AS (
       SELECT COALESCE(SUM(quantity * price), 0)::numeric AS total_gross
       FROM order_items WHERE order_id = $1
     )
     SELECT
       oi.id AS order_item_id,
       oi.product_id,
       p.product_name,
       oi.quantity::float AS sold_qty,
       oi.price::float AS price,
       (oi.price * CASE WHEN gross.total_gross > 0
          THEN (SELECT COALESCE(o2.total, 0) FROM orders o2 WHERE o2.id = $1) / gross.total_gross
          ELSE 1 END)::float AS net_price,
       COALESCE(SUM(ri.quantity), 0)::float AS returned_qty,
       GREATEST(0, oi.quantity - COALESCE(SUM(ri.quantity), 0))::float AS returnable_qty
     FROM order_items oi
     CROSS JOIN gross
     LEFT JOIN products p ON p.id = oi.product_id
     LEFT JOIN return_items ri ON ri.order_item_id = oi.id
     WHERE oi.order_id = $1
     GROUP BY oi.id, p.product_name, gross.total_gross
     ORDER BY oi.id`,
    [order.id]
  );

  const grossRes = await pool.query(
    `SELECT COALESCE(SUM(quantity * price), 0)::float AS order_gross FROM order_items WHERE order_id = $1`,
    [order.id]
  );
  const roundingRes = await pool.query(
    `SELECT rounding_mode, rounding_step FROM company_profile WHERE id = 1`
  );
  const orderGross = Number(grossRes.rows[0]?.order_gross) || 0;
  const netRatio = orderGross > 0 ? (Number(order.total) || 0) / orderGross : 1;

  const returnsRes = await pool.query(
    `SELECT id, return_number, refund_amount, refund_method, note, created_at
     FROM returns WHERE order_id = $1 ORDER BY created_at DESC`,
    [order.id]
  );

  return ok({
    order,
    items: itemsRes.rows,
    returns: returnsRes.rows,
    pricing: {
      order_gross: orderGross,
      order_total: Number(order.total) || 0,
      net_ratio: netRatio,
      // ສ່ວນຫຼຸດລວມທີ່ຖືກປັນສ່ວນ (ລວມສ່ວນຫຼຸດບິນ + ແຕ້ມ + VAT + ປັດເສດ)
      total_discount: Math.max(0, orderGross - (Number(order.total) || 0)),
      discounted: orderGross > (Number(order.total) || 0) + 0.5,
    },
    // ຄ່າປັດເສດເລີ່ມຕົ້ນ — ເອົາມາຈາກການຕັ້ງຄ່າບໍລິສັດ (ໜ້າຮັບຄືນປ່ຽນເປັນລາຍໃບໄດ້)
    rounding: {
      mode: roundingRes.rows[0]?.rounding_mode || 'none',
      step: Number(roundingRes.rows[0]?.rounding_step) || 0,
    },
  });
});

