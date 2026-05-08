export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const GET = handle(async () => {
  const formatResult = await pool.query("SELECT value FROM settings WHERE key = 'po_format'");
  const format = formatResult.rows.length > 0 ? formatResult.rows[0].value : 'PO-{YYYY}{MM}-{NNN}';

  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');

  const countResult = await pool.query(
    "SELECT COUNT(*) FROM purchases WHERE EXTRACT(YEAR FROM created_at) = $1 AND EXTRACT(MONTH FROM created_at) = $2",
    [now.getFullYear(), now.getMonth() + 1]
  );
  const nextNum = (parseInt(countResult.rows[0].count) + 1).toString().padStart(3, '0');

  const poNumber = format
    .replace('{YYYY}', yyyy)
    .replace('{YY}', yyyy.slice(-2))
    .replace('{MM}', mm)
    .replace('{NNN}', nextNum)
    .replace('{NN}', nextNum.slice(-2));

  return ok({ po_number: poNumber, number: poNumber, format });
});