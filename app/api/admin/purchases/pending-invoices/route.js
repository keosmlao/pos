export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { ensurePendingInvoicesSchema } from '@/lib/migrations';

// ?dismissed=1 → ບິນທີ່ຖືກເຊື່ອງໄວ້ · ບໍ່ລະບຸ = ບິນທີ່ຍັງລໍຖ້ານຳເຂົ້າ
export const GET = handle(async (request) => {
  await ensurePendingInvoicesSchema();
  const { dismissed } = getQuery(request);
  const onlyDismissed = String(dismissed || '') === '1';

  const result = await pool.query(`
    SELECT pi.*, s.name AS supplier_name
    FROM pending_invoices pi
    LEFT JOIN suppliers s ON s.id = pi.supplier_id
    WHERE pi.purchase_id IS NULL
      AND pi.dismissed_at IS ${onlyDismissed ? 'NOT NULL' : 'NULL'}
    ORDER BY ${onlyDismissed ? 'pi.dismissed_at DESC' : 'pi.doc_date DESC NULLS LAST, pi.created_at DESC'}
  `);
  return ok(result.rows);
});
