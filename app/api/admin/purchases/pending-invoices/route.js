export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { ensurePendingInvoicesSchema } from '@/lib/migrations';

export const GET = handle(async () => {
  await ensurePendingInvoicesSchema();
  const result = await pool.query(`
    SELECT pi.*, s.name AS supplier_name
    FROM pending_invoices pi
    LEFT JOIN suppliers s ON s.id = pi.supplier_id
    WHERE pi.purchase_id IS NULL
    ORDER BY pi.doc_date DESC NULLS LAST, pi.created_at DESC
  `);
  return ok(result.rows);
});