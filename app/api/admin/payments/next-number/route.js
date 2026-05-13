export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { ensureCompanyProfileSchema } from '@/lib/migrations';
import { previewDocumentNumber } from '@/lib/billNumber';

export const GET = handle(async () => {
  await ensureCompanyProfileSchema();

  const countResult = await pool.query(
    "SELECT COUNT(*) FROM debt_payments WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW()) AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())"
  );
  const nextSeq = parseInt(countResult.rows[0].count, 10) + 1;
  const settingsRes = await pool.query('SELECT * FROM company_profile WHERE id = 1');
  const settings = settingsRes.rows[0] || {};
  const paymentNumber = previewDocumentNumber('supplier_payment', settings, nextSeq);

  return ok({ payment_number: paymentNumber, number: paymentNumber });
});
