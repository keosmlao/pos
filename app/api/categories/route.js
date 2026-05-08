export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const GET = handle(async () => {
  const result = await pool.query(`
    SELECT DISTINCT p.category
    FROM products p
    LEFT JOIN categories c ON c.name = p.category
    WHERE p.status = true
      AND p.category IS NOT NULL
      AND (c.pos_visible IS NULL OR c.pos_visible = true)
    ORDER BY p.category
  `);
  return ok(result.rows.map((r) => r.category));
});