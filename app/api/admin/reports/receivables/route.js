export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { ensureOrdersSchema } from '@/lib/migrations';
import { buildDebtReport } from '@/lib/debtReport';

// ລາຍງານໜີ້ຄ້າງຮັບ (ລູກຄ້າ) — ບິນຂາຍຕິດໜີ້ທີ່ຍັງເກັບບໍ່ຄົບ
// ລູກຄ້າທີ່ເປັນສະມາຊິກຜູກດ້ວຍ member_id ສ່ວນລູກຄ້າທົ່ວໄປຜູກດ້ວຍຊື່ທີ່ບັນທຶກໃນບິນ
const BASE_CTE = `
  WITH base AS (
    SELECT
      o.id,
      COALESCE(NULLIF(TRIM(o.bill_number), ''), '#' || o.id) AS ref,
      CASE WHEN o.member_id IS NOT NULL
           THEN 'm' || o.member_id
           ELSE 'g:' || COALESCE(NULLIF(TRIM(o.customer_name), ''), '-') END AS party_key,
      COALESCE(NULLIF(TRIM(m.name), ''), NULLIF(TRIM(o.customer_name), ''), 'ລູກຄ້າທົ່ວໄປ') AS party_name,
      NULLIF(TRIM(CONCAT_WS(' · ', NULLIF(TRIM(COALESCE(m.member_code, '')), ''),
                                   NULLIF(TRIM(COALESCE(o.customer_phone, m.phone, '')), ''))), '') AS party_sub,
      o.created_at AS doc_date,
      o.credit_due_date AS due_date,
      COALESCE(o.total, 0) AS total,
      COALESCE(o.credit_paid, o.amount_paid, 0) AS paid,
      GREATEST(0, COALESCE(o.total, 0) - COALESCE(o.credit_paid, o.amount_paid, 0)) AS remaining
    FROM orders o
    LEFT JOIN members m ON m.id = o.member_id
    WHERE o.payment_method = 'credit'
      AND COALESCE(o.total, 0) > COALESCE(o.credit_paid, o.amount_paid, 0)
      AND ($1::date IS NULL OR o.created_at::date >= $1::date)
      AND ($2::date IS NULL OR o.created_at::date <= $2::date)
  )
`;

export const GET = handle(async (request) => {
  await ensureOrdersSchema();
  const { from, to, party, sort } = getQuery(request);
  const data = await buildDebtReport(pool, { baseCte: BASE_CTE, from, to, party, sort });
  return ok(data);
});
