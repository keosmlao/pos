export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { ensurePriceHistorySchema } from '@/lib/migrations';

export const GET = handle(async (request) => {
  await ensurePriceHistorySchema();
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 200, 1000);
  const result = await pool.query(
    `SELECT h.*, p.product_code, p.product_name, p.unit
     FROM price_history h
     LEFT JOIN products p ON p.id = h.product_id
     ORDER BY h.changed_at DESC
     LIMIT $1`,
    [limit]
  );
  return ok(result.rows);
});