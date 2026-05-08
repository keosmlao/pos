export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const DELETE = handle(async (_request, { params }) => {
  await pool.query('DELETE FROM pending_invoices WHERE id = $1', [params.id]);
  return ok({ ok: true });
});