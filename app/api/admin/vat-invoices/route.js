export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { ensureMembersSchema, ensureOrdersSchema } from '@/lib/migrations';

// ບິນທີ່ມີ ອມພ ສຳລັບ "ສົ່ງຂໍ້ມູນບິນອາກອນ" ແລະ "ລາຍງານອອກບິນອາກອນ"
//
// ຄືນຄ່າດິບຂອງແຕ່ລະບິນ + ຜົນລວມແຖວສິນຄ້າ (items_sum) ແລ້ວໃຫ້ຝັ່ງໜ້າຈໍ
// ແຍກຍອດດ້ວຍ orderVatBreakdown() ອັນດຽວກັບທີ່ໃຊ້ພິມບິນ ຈຶ່ງບໍ່ຫຼົງກັນ
//
// ພາຣາມິເຕີ: from, to (YYYY-MM-DD) · status = all | pending | sent

const MAX_ROWS = 5000;

// ບິນ "ມີ ອມພ" — ຄືກັນກັບ hasVat ໃນ orderVatBreakdown()
const HAS_VAT = `(COALESCE(o.vat_amount, 0) > 0 AND COALESCE(o.vat_rate, 0) > 0)`;

export const GET = handle(async (request) => {
  await ensureOrdersSchema();
  await ensureMembersSchema();

  const { from, to, status } = getQuery(request);
  const today = new Date().toISOString().slice(0, 10);
  const start = from || today;
  const end = to || start;
  const statusFilter = status === 'pending' ? 'pending' : status === 'sent' ? 'sent' : 'all';

  const statusWhere = statusFilter === 'pending' ? ' AND o.tax_submitted_at IS NULL'
    : statusFilter === 'sent' ? ' AND o.tax_submitted_at IS NOT NULL'
    : '';

  const params = [start, end];
  const where = `
     WHERE o.created_at::date BETWEEN $1::date AND $2::date
       AND ${HAS_VAT}${statusWhere}`;

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS matched,
            COUNT(*) FILTER (WHERE o.tax_submitted_at IS NULL)::int     AS pending,
            COUNT(*) FILTER (WHERE o.tax_submitted_at IS NOT NULL)::int AS sent
       FROM orders o
      WHERE o.created_at::date BETWEEN $1::date AND $2::date AND ${HAS_VAT}`,
    params
  );

  const res = await pool.query(
    `SELECT o.id,
            o.bill_number,
            o.created_at,
            o.payment_method,
            -- ຊື່ຈາກທະບຽນສະມາຊິກມາກ່ອນ (ຖ້າແກ້ຊື່ພາຍຫຼັງ ລາຍງານຈະຕາມທັນ)
            COALESCE(NULLIF(TRIM(m.name), ''), NULLIF(TRIM(o.customer_name), '')) AS customer_name,
            m.member_code,
            -- ເລກປະຈຳຕົວຜູ້ເສຍອາກອນ (TIN) ຂອງລູກຄ້າ — ວ່າງໄດ້
            NULLIF(TRIM(COALESCE(m.tax_id, '')), '') AS customer_tax_id,
            COALESCE(o.discount, 0)   AS discount,
            COALESCE(o.subtotal, 0)   AS subtotal,
            COALESCE(o.vat_rate, 0)   AS vat_rate,
            o.vat_mode,
            COALESCE(o.vat_amount, 0) AS vat_amount,
            COALESCE(o.total, 0)      AS total,
            o.tax_submitted_at,
            COALESCE(i.items_sum, 0)  AS items_sum,
            COALESCE(i.item_names, '') AS item_names
       FROM orders o
       LEFT JOIN (
         SELECT oi.order_id,
                SUM(oi.quantity * oi.price) AS items_sum,
                STRING_AGG(DISTINCT p.product_name, ', ') AS item_names
           FROM order_items oi
           LEFT JOIN products p ON p.id = oi.product_id
          GROUP BY oi.order_id
       ) i ON i.order_id = o.id
       LEFT JOIN members m ON m.id = o.member_id
       ${where}
      ORDER BY o.created_at ASC
      LIMIT ${MAX_ROWS}`,
    params
  );

  const counts = countRes.rows[0];
  const matched = statusFilter === 'pending' ? counts.pending
    : statusFilter === 'sent' ? counts.sent
    : counts.matched;

  return ok({
    from: start,
    to: end,
    status: statusFilter,
    rows: res.rows,
    total_bills: matched,
    pending_bills: counts.pending,
    sent_bills: counts.sent,
    // ບອກໃຫ້ຮູ້ຖ້າຕັດອອກ — ຢ່າໃຫ້ຜູ້ໃຊ້ເຂົ້າໃຈຜິດວ່າເຫັນຄົບແລ້ວ
    truncated: matched > res.rows.length,
  });
});
