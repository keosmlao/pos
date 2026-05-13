export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { ensureCompanyProfileSchema } from '@/lib/migrations';
import { previewDocumentNumber } from '@/lib/billNumber';

export const GET = handle(async () => {
  await ensureCompanyProfileSchema();

  const countResult = await pool.query(
    "SELECT COUNT(*) FROM purchases WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW()) AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())"
  );
  const nextSeq = parseInt(countResult.rows[0].count, 10) + 1;
  const settingsRes = await pool.query('SELECT * FROM company_profile WHERE id = 1');
  const settings = settingsRes.rows[0] || {};
  const poNumber = previewDocumentNumber('purchase', settings, nextSeq);

  return ok({ po_number: poNumber, number: poNumber, format: settings.purchase_number_template });
});
