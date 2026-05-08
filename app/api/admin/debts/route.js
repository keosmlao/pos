export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const GET = handle(async () => {
  const result = await pool.query(`
    SELECT p.*, s.name as supplier_name,
      (p.total - p.paid) as remaining
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.total > p.paid
    ORDER BY p.created_at DESC
  `);
  return ok(result.rows);
});