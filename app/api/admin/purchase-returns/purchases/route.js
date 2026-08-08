export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { ensurePurchaseReturnsSchema } from '@/lib/migrations';

// ລາຍການບິນຊື້ເຂົ້າສຳລັບເລືອກມາສົ່ງຄືນ
export const GET = handle(async (request) => {
  await ensurePurchaseReturnsSchema();
  const { q = '', limit = '50' } = getQuery(request);
  const query = String(q || '').trim().toLowerCase();
  const lim = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));

  const params = [];
  const where = [];
  if (query) {
    params.push(`%${query}%`);
    const i = params.length;
    where.push(`(
      LOWER(COALESCE(p.ref_number, '')) LIKE $${i}
      OR LOWER(COALESCE(p.sml_doc_no, '')) LIKE $${i}
      OR p.id::text LIKE $${i}
      OR LOWER(COALESCE(s.name, '')) LIKE $${i}
    )`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  params.push(lim);

  const result = await pool.query(
    `SELECT
       p.id, p.ref_number, p.sml_doc_no, p.created_at, p.total, p.paid, p.status,
       p.currency, p.payment_type, s.name AS supplier_name,
       COALESCE(bought.qty, 0)::float AS bought_qty,
       COALESCE(ret.qty, 0)::float AS returned_qty,
       GREATEST(0, COALESCE(bought.qty, 0) - COALESCE(ret.qty, 0))::float AS returnable_qty
     FROM purchases p
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     LEFT JOIN (
       SELECT purchase_id, SUM(quantity) AS qty FROM purchase_items GROUP BY purchase_id
     ) bought ON bought.purchase_id = p.id
     LEFT JOIN (
       SELECT pi.purchase_id, SUM(pri.quantity) AS qty
       FROM purchase_return_items pri JOIN purchase_items pi ON pi.id = pri.purchase_item_id
       GROUP BY pi.purchase_id
     ) ret ON ret.purchase_id = p.id
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return ok(result.rows);
});
