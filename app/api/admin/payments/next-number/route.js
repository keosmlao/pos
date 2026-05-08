export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const GET = handle(async () => {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');

  const countResult = await pool.query(
    "SELECT COUNT(*) FROM debt_payments WHERE EXTRACT(YEAR FROM created_at) = $1 AND EXTRACT(MONTH FROM created_at) = $2",
    [now.getFullYear(), now.getMonth() + 1]
  );
  const nextNum = (parseInt(countResult.rows[0].count) + 1).toString().padStart(3, '0');

  const paymentNumber = `PAY-${yyyy}${mm}-${nextNum}`;
  return ok({ payment_number: paymentNumber, number: paymentNumber });
});