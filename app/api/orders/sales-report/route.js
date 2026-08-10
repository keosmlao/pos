export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { ensureMembersSchema, ensureOrdersSchema } from '@/lib/migrations';

// ລາຍງານການຂາຍຕາມບິນຂາຍ (ໃຊ້ຢູ່ໜ້າຂາຍ POS)
//
// ຄືນຄ່າດິບຂອງແຕ່ລະບິນ + ຜົນລວມແຖວສິນຄ້າ (items_sum) ແລ້ວໃຫ້ຝັ່ງໜ້າຈໍ
// ແຍກຍອດດ້ວຍ orderVatBreakdown() ອັນດຽວກັບທີ່ໃຊ້ພິມບິນ A5/A4
// ຈຶ່ງໝັ້ນໃຈວ່າຕົວເລກໃນລາຍງານ ຕົງກັບໃນໃບບິນສະເໝີ
//
// ພາຣາມິເຕີ: from, to (YYYY-MM-DD · ບໍ່ລະບຸ = ມື້ນີ້) · cashier · branch_id

const MAX_ROWS = 2000;

export const GET = handle(async (request) => {
  await ensureOrdersSchema();
  await ensureMembersSchema();

  const { from, to, cashier, branch_id } = getQuery(request);
  const today = new Date().toISOString().slice(0, 10);
  const start = from || today;
  const end = to || start;
  const cashierFilter = cashier ? String(cashier).trim() : null;
  const branchFilter = Number(branch_id) > 0 ? Number(branch_id) : null;

  const params = [start, end, cashierFilter, branchFilter];
  const where = `
     WHERE o.created_at::date BETWEEN $1::date AND $2::date
       AND ($3::text IS NULL OR o.created_by_username = $3::text)
       AND ($4::int IS NULL OR o.branch_id = $4::int)`;

  const countRes = await pool.query(`SELECT COUNT(*)::int AS c FROM orders o ${where}`, params);
  const totalBills = countRes.rows[0].c;

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
       ${where}
      ORDER BY o.created_at ASC
      LIMIT ${MAX_ROWS}`,
    params
  );

  return ok({
    from: start,
    to: end,
    rows: res.rows,
    total_bills: totalBills,
    // ບອກໃຫ້ຮູ້ຖ້າຕັດອອກ — ຢ່າໃຫ້ຜູ້ໃຊ້ເຂົ້າໃຈຜິດວ່າເຫັນຄົບແລ້ວ
    truncated: totalBills > res.rows.length,
  });
});
