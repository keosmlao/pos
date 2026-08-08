export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import {
  ensureOrdersSchema, ensureReturnsSchema, ensureStockAdjustmentsSchema,
  ensureLaybysSchema, ensureProductVariantsSchema, ensurePurchaseReturnsSchema,
} from '@/lib/migrations';
import { MOVEMENTS_CTE, DOC_TYPES } from '@/lib/stockMovementSql';

// ການເຄື່ອນໄຫວສິນຄ້າ (stock movement / ບັດສາງ)
//
// ລະບົບນີ້ບໍ່ມີຕາຕະລາງ ledger ແຍກ — ຈຶ່ງປະກອບຂຶ້ນຈາກເອກະສານຈິງທຸກປະເພດ:
//   ບິນຂາຍ · ຮັບຄືນ · ຊື້ເຂົ້າ · ປັບປຸງສະຕັອກ · ນັບສິນຄ້າ · ຝາກຂາຍ · ຍົກເລີກຝາກຂາຍ
//
// ຍອດຄົງເຫຼືອຄິດ "ຖອຍຫຼັງຈາກຍອດປັດຈຸບັນ" (products.qty_on_hand) ບໍ່ແມ່ນບວກໄປໜ້າຈາກ 0
// — ຍອດແຖວລ່າສຸດຈຶ່ງກົງກັບສະຕັອກຈິງສະເໝີ. ການປ່ຽນສະຕັອກທີ່ບໍ່ມີເອກະສານ (ແກ້ໃນໜ້າ
// ສິນຄ້າ, import CSV, ຍອດຍົກມາຕອນສ້າງສິນຄ້າ) ຈະໄປລວມຢູ່ຍອດຍົກມາແຖວທຳອິດ.

// ຄຳນິຍາມ SQL ຢູ່ໃນ lib/stockMovementSql.js — ໃຊ້ຮ່ວມກັບໜ້າ "ຕົ້ນທຶນສິນຄ້າ"
// ພາລາມິເຕີໃນໄຟລ໌ນີ້: $1 product_id · $2 search · $3 from · $4 to · $5 doc types

const CTE = `${MOVEMENTS_CTE},
  mv_typed AS (
    SELECT * FROM mv WHERE ($5::text[] IS NULL OR doc_type = ANY($5::text[]))
  )`;

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
    productId,
    term ? `%${term}%` : null,
    from || null,
    to || null,
    typeList.length > 0 ? typeList : null,
  ];

  // ໜ້າຕ່າງວັນທີໃຊ້ຕອນ "ສະແດງ" ເທົ່ານັ້ນ — ຍອດຄົງເຫຼືອຄິດຈາກປະຫວັດທັງໝົດ
  const inWindow = `
    ($3::date IS NULL OR doc_at::date >= $3::date)
    AND ($4::date IS NULL OR doc_at::date <= $4::date)`;

  const detailRes = await pool.query(
    `WITH ${CTE}
     -- ສົ່ງວັນທີເປັນຂໍ້ຄວາມຕາມເຂດເວລາເຊີບເວີ — ຖ້າສົ່ງເປັນ timestamp ຈະຖືກແປງເປັນ UTC
     -- ແລ້ວເອກະສານຕອນແລງຈະສະແດງເປັນວັນທີກ່ອນໜ້າ
     SELECT to_char(doc_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS doc_at,
            doc_type, doc_no, product_id, product_code, product_name, unit, partner,
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
    `WITH ${CTE},
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
     SELECT to_char(dr.d, 'YYYY-MM-DD') AS d,
            dr.product_id, dr.product_code, dr.product_name, dr.unit,
            ds.qty_in::float, ds.qty_out::float, (ds.qty_in - ds.qty_out)::float AS qty_net,
            (dr.qty_on_hand - dr.total_net + dr.cum_net - dr.net_all)::float AS balance_begin,
            (dr.qty_on_hand - dr.total_net + dr.cum_net)::float AS balance_end
     FROM day_run dr
     JOIN day_shown ds ON ds.product_id = dr.product_id AND ds.d = dr.d
     WHERE ($3::date IS NULL OR dr.d >= $3::date) AND ($4::date IS NULL OR dr.d <= $4::date)
     ORDER BY dr.product_code NULLS LAST, dr.product_id, dr.d
     LIMIT ${rowLimit}`,
    params
  );

  const summaryRes = await pool.query(
    `WITH ${CTE}
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
    `WITH ${CTE}
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
