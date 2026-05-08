export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const GET = handle(async () => {
  const result = await pool.query(`
    SELECT dp.*, p.ref_number, p.total as purchase_total, s.name as supplier_name
    FROM debt_payments dp
    JOIN purchases p ON dp.purchase_id = p.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    ORDER BY dp.created_at DESC
  `);
  return ok(result.rows);
});