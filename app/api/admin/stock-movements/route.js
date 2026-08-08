export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import {
  ensureOrdersSchema, ensureReturnsSchema, ensureStockAdjustmentsSchema,
  ensureLaybysSchema, ensureProductVariantsSchema, ensurePurchaseReturnsSchema,
} from '@/lib/migrations';

// ການເຄື່ອນໄຫວສິນຄ້າ (stock movement / ບັດສາງ)
//
// ລະບົບນີ້ບໍ່ມີຕາຕະລາງ ledger ແຍກ — ຈຶ່ງປະກອບຂຶ້ນຈາກເອກະສານຈິງທຸກປະເພດ:
//   ບິນຂາຍ · ຮັບຄືນ · ຊື້ເຂົ້າ · ປັບປຸງສະຕັອກ · ນັບສິນຄ້າ · ຝາກຂາຍ · ຍົກເລີກຝາກຂາຍ
//
// ຍອດຄົງເຫຼືອຄິດ "ຖອຍຫຼັງຈາກຍອດປັດຈຸບັນ" (products.qty_on_hand) ບໍ່ແມ່ນບວກໄປໜ້າຈາກ 0
// — ຍອດແຖວລ່າສຸດຈຶ່ງກົງກັບສະຕັອກຈິງສະເໝີ. ການປ່ຽນສະຕັອກທີ່ບໍ່ມີເອກະສານ (ແກ້ໃນໜ້າ
// ສິນຄ້າ, import CSV, ຍອດຍົກມາຕອນສ້າງສິນຄ້າ) ຈະໄປລວມຢູ່ຍອດຍົກມາແຖວທຳອິດ.

export const DOC_TYPES = {
  sale: 'ບິນຂາຍ',
  return: 'ຮັບຄືນ',
  purchase: 'ຊື້ເຂົ້າ',
  adjustment: 'ປັບປຸງສະຕັອກ',
  stock_take: 'ນັບສິນຄ້າ',
  purchase_return: 'ສົ່ງຄືນຜູ້ສະໜອງ',
  layby: 'ຝາກຂາຍ (ຈອງ)',
  layby_cancel: 'ຍົກເລີກຝາກຂາຍ',
};

const MOVEMENTS_CTE = `
  prod AS (
    SELECT p.id, p.product_code, p.product_name, COALESCE(p.unit, '') AS unit,
           COALESCE(p.qty_on_hand, 0)::numeric AS qty_on_hand
    FROM products p
    WHERE ($3::int IS NULL OR p.id = $3::int)
      AND ($4::text IS NULL
           OR LOWER(p.product_name) LIKE $4
           OR LOWER(COALESCE(p.product_code, '')) LIKE $4
           OR LOWER(COALESCE(p.barcode, '')) LIKE $4)
  ),
  mv AS (
    -- ບິນຂາຍ (ຍົກເວັ້ນບິນທີ່ເກີດຈາກການປິດຝາກຂາຍແບບຈອງສິນຄ້າ — ຕັດສະຕັອກໄປແລ້ວຕອນຈອງ)
    SELECT o.created_at AS doc_at, 'sale' AS doc_type,
           COALESCE(NULLIF(o.bill_number, ''), '#' || o.id) AS doc_no,
           oi.product_id, 0::numeric AS qty_in, oi.quantity::numeric AS qty_out,
           COALESCE(NULLIF(o.customer_name, ''), 'ລູກຄ້າທົ່ວໄປ') AS partner,
           o.id AS ref_id
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.product_id IN (SELECT id FROM prod)
      AND NOT EXISTS (
        SELECT 1 FROM laybys l JOIN layby_items li ON li.layby_id = l.id
        WHERE l.completed_order_id = o.id
      )

    UNION ALL
    -- ຮັບຄືນຈາກລູກຄ້າ
    SELECT r.created_at, 'return',
           COALESCE(NULLIF(r.return_number, ''), '#' || r.id),
           ri.product_id, ri.quantity::numeric, 0::numeric,
           COALESCE(NULLIF(o.customer_name, ''), 'ລູກຄ້າທົ່ວໄປ'), r.id
    FROM return_items ri
    JOIN returns r ON r.id = ri.return_id
    LEFT JOIN orders o ON o.id = r.order_id
    WHERE ri.product_id IN (SELECT id FROM prod)

    UNION ALL
    -- ຊື້ເຂົ້າ
    SELECT pu.created_at, 'purchase',
           COALESCE(NULLIF(pu.ref_number, ''), NULLIF(pu.sml_doc_no, ''), '#' || pu.id),
           pi.product_id, pi.quantity::numeric, 0::numeric,
           COALESCE(s.name, '—'), pu.id
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    LEFT JOIN suppliers s ON s.id = pu.supplier_id
    WHERE pi.product_id IN (SELECT id FROM prod)

    UNION ALL
    -- ສົ່ງເຄື່ອງຄືນຜູ້ສະໜອງ
    SELECT pr.created_at, 'purchase_return',
           COALESCE(NULLIF(pr.return_number, ''), '#' || pr.id),
           pri.product_id, 0::numeric, pri.quantity::numeric,
           COALESCE(s2.name, '—'), pr.id
    FROM purchase_return_items pri
    JOIN purchase_returns pr ON pr.id = pri.purchase_return_id
    LEFT JOIN suppliers s2 ON s2.id = pr.supplier_id
    WHERE pri.product_id IN (SELECT id FROM prod)

    UNION ALL
    -- ປັບປຸງສະຕັອກ + ນັບສິນຄ້າ (ນັບສິນຄ້າຂຽນແຖວ mirror ໄວ້ໃນ stock_adjustments ຢູ່ແລ້ວ)
    SELECT COALESCE(sa.approved_at, sa.created_at),
           CASE WHEN sa.adjustment_type = 'stock_take' THEN 'stock_take' ELSE 'adjustment' END,
           COALESCE(NULLIF(sa.adjustment_number, ''), '#' || sa.id),
           sa.product_id,
           GREATEST(COALESCE(sa.delta, 0), 0)::numeric,
           GREATEST(-COALESCE(sa.delta, 0), 0)::numeric,
           COALESCE(NULLIF(sa.reason, ''), COALESCE(sa.username, '—')), sa.id
    FROM stock_adjustments sa
    WHERE sa.product_id IN (SELECT id FROM prod)
      AND (sa.status = 'approved' OR sa.status IS NULL)
      AND COALESCE(sa.delta, 0) <> 0

    UNION ALL
    -- ຝາກຂາຍ — ຕັດສະຕັອກຕອນຈອງ
    SELECT l.created_at, 'layby',
           COALESCE(NULLIF(l.layby_number, ''), '#' || l.id),
           li.product_id, 0::numeric, li.quantity::numeric,
           COALESCE(NULLIF(l.customer_name, ''), 'ລູກຄ້າທົ່ວໄປ'), l.id
    FROM layby_items li
    JOIN laybys l ON l.id = li.layby_id
    WHERE li.product_id IN (SELECT id FROM prod)

    UNION ALL
    -- ຍົກເລີກຝາກຂາຍ — ສິນຄ້າກັບເຂົ້າສາງ
    SELECT COALESCE(l.cancelled_at, l.updated_at, l.created_at), 'layby_cancel',
           COALESCE(NULLIF(l.layby_number, ''), '#' || l.id),
           li.product_id, li.quantity::numeric, 0::numeric,
           COALESCE(NULLIF(l.customer_name, ''), 'ລູກຄ້າທົ່ວໄປ'), l.id
    FROM layby_items li
    JOIN laybys l ON l.id = li.layby_id
    WHERE li.product_id IN (SELECT id FROM prod)
      AND l.status = 'cancelled'
  ),
  mv_typed AS (
    SELECT * FROM mv WHERE ($5::text[] IS NULL OR doc_type = ANY($5::text[]))
  ),
  -- ຍອດແລ່ນຄິດຈາກ mv (ທຸກປະເພດ) ບໍ່ແມ່ນ mv_typed — ຕົວກອງປະເພດບໍ່ຄວນເຮັດໃຫ້
  -- ຍອດຄົງເຫຼືອຜິດ. ຕົວກອງເປັນພຽງການເລືອກແຖວທີ່ຈະສະແດງ.
  mv_run AS (
    SELECT m.*, p.product_code, p.product_name, p.unit, p.qty_on_hand,
           (m.qty_in - m.qty_out) AS qty_net,
           SUM(m.qty_in - m.qty_out) OVER (
             PARTITION BY m.product_id ORDER BY m.doc_at, m.doc_type, m.ref_id
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_net,
           SUM(m.qty_in - m.qty_out) OVER (PARTITION BY m.product_id) AS total_net
    FROM mv m JOIN prod p ON p.id = m.product_id
  )
`;

export const GET = handle(async (request) => {
  await ensureOrdersSchema();
  await ensureReturnsSchema();
  await ensureStockAdjustmentsSchema();
  await ensureLaybysSchema();
  await ensureProductVariantsSchema();
  await ensurePurchaseReturnsSchema();

  const { from, to, product_id, search, types, limit } = getQuery(request);
  const productId = Number(product_id) > 0 ? Number(product_id) : null;
  const term = String(search || '').trim().toLowerCase();
  const typeList = String(types || '').split(',').map(t => t.trim()).filter(t => DOC_TYPES[t]);
  const rowLimit = Math.max(50, Math.min(5000, Number(limit) || 2000));

  const params = [
    from || null,
    to || null,
    productId,
    term ? `%${term}%` : null,
    typeList.length > 0 ? typeList : null,
  ];

  // ໜ້າຕ່າງວັນທີໃຊ້ຕອນ "ສະແດງ" ເທົ່ານັ້ນ — ຍອດຄົງເຫຼືອຄິດຈາກປະຫວັດທັງໝົດ
  const inWindow = `
    ($1::date IS NULL OR doc_at::date >= $1::date)
    AND ($2::date IS NULL OR doc_at::date <= $2::date)`;

  const detailRes = await pool.query(
    `WITH ${MOVEMENTS_CTE}
     SELECT doc_at, doc_type, doc_no, product_id, product_code, product_name, unit, partner,
            qty_in::float, qty_out::float, qty_net::float,
            (qty_on_hand - total_net + cum_net - qty_net)::float AS balance_begin,
            (qty_on_hand - total_net + cum_net)::float AS balance_end
     FROM mv_run
     WHERE ${inWindow}
       AND ($5::text[] IS NULL OR doc_type = ANY($5::text[]))
     ORDER BY product_code NULLS LAST, product_id, doc_at, doc_type
     LIMIT ${rowLimit}`,
    params
  );

  const dailyRes = await pool.query(
    `WITH ${MOVEMENTS_CTE},
     -- ຍອດຄົງເຫຼືອຕໍ່ວັນ: ຄິດຈາກທຸກປະເພດ
     day_all AS (
       SELECT m.product_id, m.doc_at::date AS d, SUM(m.qty_in - m.qty_out) AS net_all
       FROM mv m GROUP BY m.product_id, m.doc_at::date
     ),
     day_run AS (
       SELECT da.*, p.product_code, p.product_name, p.unit, p.qty_on_hand,
              SUM(da.net_all) OVER (
                PARTITION BY da.product_id ORDER BY da.d
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_net,
              SUM(da.net_all) OVER (PARTITION BY da.product_id) AS total_net
       FROM day_all da JOIN prod p ON p.id = da.product_id
     ),
     -- ຮັບເຂົ້າ/ຈ່າຍອອກທີ່ສະແດງ: ຕາມຕົວກອງປະເພດ
     day_shown AS (
       SELECT m.product_id, m.doc_at::date AS d,
              SUM(m.qty_in) AS qty_in, SUM(m.qty_out) AS qty_out
       FROM mv_typed m GROUP BY m.product_id, m.doc_at::date
     )
     SELECT dr.d, dr.product_id, dr.product_code, dr.product_name, dr.unit,
            ds.qty_in::float, ds.qty_out::float, (ds.qty_in - ds.qty_out)::float AS qty_net,
            (dr.qty_on_hand - dr.total_net + dr.cum_net - dr.net_all)::float AS balance_begin,
            (dr.qty_on_hand - dr.total_net + dr.cum_net)::float AS balance_end
     FROM day_run dr
     JOIN day_shown ds ON ds.product_id = dr.product_id AND ds.d = dr.d
     WHERE ($1::date IS NULL OR dr.d >= $1::date) AND ($2::date IS NULL OR dr.d <= $2::date)
     ORDER BY dr.product_code NULLS LAST, dr.product_id, dr.d
     LIMIT ${rowLimit}`,
    params
  );

  const summaryRes = await pool.query(
    `WITH ${MOVEMENTS_CTE}
     SELECT COALESCE(SUM(qty_in), 0)::float AS qty_in,
            COALESCE(SUM(qty_out), 0)::float AS qty_out,
            COUNT(*)::int AS movements,
            COUNT(DISTINCT product_id)::int AS products,
            COUNT(DISTINCT doc_type)::int AS doc_types
     FROM mv_typed
     WHERE ${inWindow}`,
    params
  );

  const byTypeRes = await pool.query(
    `WITH ${MOVEMENTS_CTE}
     SELECT doc_type, COUNT(*)::int AS documents,
            COALESCE(SUM(qty_in), 0)::float AS qty_in,
            COALESCE(SUM(qty_out), 0)::float AS qty_out
     FROM mv_typed
     WHERE ${inWindow}
     GROUP BY doc_type ORDER BY doc_type`,
    params
  );

  return ok({
    range: { from: from || null, to: to || null },
    doc_types: DOC_TYPES,
    summary: summaryRes.rows[0],
    by_type: byTypeRes.rows,
    movements: detailRes.rows,
    daily: dailyRes.rows,
    truncated: detailRes.rowCount >= rowLimit || dailyRes.rowCount >= rowLimit,
  });
});
