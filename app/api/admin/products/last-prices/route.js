export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const GET = handle(async () => {
  const result = await pool.query(`
    SELECT DISTINCT ON (pi.product_id)
      pi.product_id,
      pi.cost_price,
      p.currency,
      p.exchange_rate,
      p.created_at as purchase_date
    FROM purchase_items pi
    JOIN purchases p ON pi.purchase_id = p.id
    ORDER BY pi.product_id, p.created_at DESC
  `);
  return ok(result.rows);
});