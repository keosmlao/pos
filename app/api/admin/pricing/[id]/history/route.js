export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { ensurePriceHistorySchema } from '@/lib/migrations';

export const GET = handle(async (_request, { params }) => {
  await ensurePriceHistorySchema();
  const { id } = await params;
  const result = await pool.query(
    `SELECT h.*, p.product_code, p.product_name, p.unit
     FROM price_history h
     LEFT JOIN products p ON p.id = h.product_id
     WHERE h.product_id = $1
     ORDER BY h.changed_at DESC`,
    [id]
  );
  return ok(result.rows);
});