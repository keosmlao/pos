export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const GET = handle(async (_request, { params }) => {
  const { id } = await params;
  const result = await pool.query(`
    SELECT 'in' as type, pi.quantity, pi.cost_price as price, p.created_at,
           COALESCE(s.name, 'ຊື້ເຂົ້າ') as source,
           p.purchase_number as ref
    FROM purchase_items pi
    JOIN purchases p ON pi.purchase_id = p.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE pi.product_id = $1

    UNION ALL

    SELECT 'out' as type, oi.quantity, oi.price, o.created_at,
           CASE WHEN o.customer_name IS NOT NULL AND o.customer_name <> '' THEN 'ຂາຍ · ' || o.customer_name ELSE 'ການຂາຍ' END as source,
           COALESCE(o.bill_number, '#' || o.id) as ref
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_id = $1

    UNION ALL

    SELECT 'in' as type, ri.quantity, ri.price, r.created_at,
           'ຮັບຄືນສິນຄ້າ' as source,
           COALESCE(r.return_number, '#' || r.id) as ref
    FROM return_items ri
    JOIN returns r ON ri.return_id = r.id
    WHERE ri.product_id = $1

    ORDER BY created_at DESC
  `, [id]);
  return ok(result.rows);
});