export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { ensurePriceHistorySchema } from '@/lib/migrations';

export const GET = handle(async () => {
  await ensurePriceHistorySchema();
  const result = await pool.query(
    'SELECT id, product_code, barcode, product_name, category, brand, cost_price, selling_price, unit FROM products WHERE status = true ORDER BY product_name'
  );
  return ok(result.rows);
});
