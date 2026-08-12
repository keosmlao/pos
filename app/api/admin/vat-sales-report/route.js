export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { ensureMembersSchema, ensureOrdersSchema } from '@/lib/migrations';

// ລາຍງານການຂາຍສິນຄ້າ ອມພ (VAT) — ຕາມບິນຂາຍ
//
// ຄືນຄ່າດິບຂອງແຕ່ລະບິນ + ຜົນລວມແຖວສິນຄ້າ (items_sum) ແລ້ວໃຫ້ຝັ່ງໜ້າຈໍ
// ແຍກຍອດດ້ວຍ orderVatBreakdown() ອັນດຽວກັບທີ່ໃຊ້ພິມບິນ ແລະ ລາຍງານໜ້າ POS
// ຈຶ່ງໝັ້ນໃຈວ່າຕົວເລກໃນລາຍງານ ຕົງກັບໃນໃບບິນສະເໝີ
//
// ພາຣາມິເຕີ: from, to (YYYY-MM-DD) · vat = with | without | all · branch_id

const MAX_ROWS = 5000;

export const GET = handle(async (request) => {
  await ensureOrdersSchema();
  await ensureMembersSchema();

  const { from, to, vat, branch_id } = getQuery(request);
  const today = new Date().toISOString().slice(0, 10);
  const start = from || today;
  const end = to || start;
  const vatFilter = vat === 'without' ? 'without' : vat === 'all' ? 'all' : 'with';
  const branchFilter = Number(branch_id) > 0 ? Number(branch_id) : null;

  const params = [start, end, branchFilter];
  const baseWhere = `
     WHERE o.created_at::date BETWEEN $1::date AND $2::date
       AND ($3::int IS NULL OR o.branch_id = $3::int)`;

  // ບິນ "ມີ ອມພ" = ມີທັງຈຳນວນ ອມພ ແລະ ອັດຕາ — ຄືກັນກັບ hasVat ໃນ orderVatBreakdown()
  const HAS_VAT = `(COALESCE(o.vat_amount, 0) > 0 AND COALESCE(o.vat_rate, 0) > 0)`;
  const vatWhere = vatFilter === 'with' ? ` AND ${HAS_VAT}`
    : vatFilter === 'without' ? ` AND NOT ${HAS_VAT}`
    : '';

  const countRes = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE ${HAS_VAT})::int     AS with_vat,
            COUNT(*) FILTER (WHERE NOT ${HAS_VAT})::int AS without_vat
       FROM orders o ${baseWhere}`,
    params
  );
  const counts = countRes.rows[0];
  const matched = vatFilter === 'with' ? counts.with_vat
    : vatFilter === 'without' ? counts.without_vat
    : counts.with_vat + counts.without_vat;

  const res = await pool.query(
    `SELECT o.id,
            o.bill_number,
            o.created_at,
            o.payment_method,
            -- ຊື່ຈາກທະບຽນສະມາຊິກມາກ່ອນ (ຖ້າແກ້ຊື່ພາຍຫຼັງ ລາຍງານຈະຕາມທັນ)
            COALESCE(NULLIF(TRIM(m.name), ''), NULLIF(TRIM(o.customer_name), '')) AS customer_name,
            m.member_code,
            o.created_by_username,
            COALESCE(o.discount, 0)   AS discount,
            COALESCE(o.subtotal, 0)   AS subtotal,
            COALESCE(o.vat_rate, 0)   AS vat_rate,
            o.vat_mode,
            COALESCE(o.vat_amount, 0) AS vat_amount,
            COALESCE(o.total, 0)      AS total,
            COALESCE(i.items_sum, 0)  AS items_sum
       FROM orders o
       LEFT JOIN (
         SELECT order_id, SUM(quantity * price) AS items_sum
           FROM order_items GROUP BY order_id
       ) i ON i.order_id = o.id
       LEFT JOIN members m ON m.id = o.member_id
       ${baseWhere}${vatWhere}
      ORDER BY o.created_at ASC
      LIMIT ${MAX_ROWS}`,
    params
  );

  return ok({
    from: start,
    to: end,
    vat: vatFilter,
    rows: res.rows,
    with_vat_bills: counts.with_vat,
    without_vat_bills: counts.without_vat,
    total_bills: matched,
    // ບອກໃຫ້ຮູ້ຖ້າຕັດອອກ — ຢ່າໃຫ້ຜູ້ໃຊ້ເຂົ້າໃຈຜິດວ່າເຫັນຄົບແລ້ວ
    truncated: matched > res.rows.length,
  });
});
