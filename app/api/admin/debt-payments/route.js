export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { ensureCustomerDebtPaymentsSchema } from '@/lib/migrations';

export const GET = handle(async () => {
  await ensureCustomerDebtPaymentsSchema();

  const result = await pool.query(`
    SELECT *
    FROM (
      SELECT
        'supplier' AS debt_type,
        dp.id,
        dp.payment_number,
        COALESCE(dp.payment_date, dp.created_at::date) AS payment_date,
        dp.created_at,
        dp.amount,
        dp.currency,
        dp.exchange_rate,
        dp.payment_method,
        dp.note,
        dp.attachment,
        dp.purchase_id AS ref_id,
        p.ref_number AS ref_number,
        s.name AS party_name,
        'ຜູ້ສະໜອງ' AS party_type
      FROM debt_payments dp
      JOIN purchases p ON dp.purchase_id = p.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id

      UNION ALL

      SELECT
        'customer' AS debt_type,
        cdp.id,
        cdp.payment_number,
        COALESCE(cdp.payment_date, cdp.created_at::date) AS payment_date,
        cdp.created_at,
        cdp.amount,
        'LAK' AS currency,
        1 AS exchange_rate,
        cdp.payment_method,
        cdp.note,
        NULL AS attachment,
        cdp.order_id AS ref_id,
        COALESCE(o.bill_number, '#' || o.id::text) AS ref_number,
        COALESCE(o.customer_name, m.name, 'ລູກຄ້າ') AS party_name,
        'ລູກຄ້າ' AS party_type
      FROM customer_debt_payments cdp
      JOIN orders o ON cdp.order_id = o.id
      LEFT JOIN members m ON m.id = o.member_id
    ) payments
    ORDER BY payment_date DESC NULLS LAST, created_at DESC, id DESC
  `);

  return ok(result.rows);
});

