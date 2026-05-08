export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const GET = handle(async () => {
  const result = await pool.query(`
    SELECT p.*, pr.product_name
    FROM promotions p
    LEFT JOIN products pr ON p.product_id = pr.id
    WHERE p.active = true
      AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
      AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
  `);
  return ok(result.rows);
});