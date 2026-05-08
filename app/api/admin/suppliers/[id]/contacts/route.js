export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const GET = handle(async (_request, { params }) => {
  const { id } = await params;
  const result = await pool.query(
    'SELECT * FROM supplier_contact_history WHERE supplier_id = $1 ORDER BY created_at DESC',
    [id]
  );
  return ok(result.rows);
});