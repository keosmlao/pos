export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const GET = handle(async (_request, { params }) => {
  const { id } = await params;
  const result = await pool.query(`
    SELECT 'in' as type, pi.quantity, pi.cost_price as price, p.created_at, s.name as source
    FROM purchase_items pi
    JOIN purchases p ON pi.purchase_id = p.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE pi.product_id = $1

    UNION ALL

    SELECT 'out' as type, oi.quantity, oi.price, o.created_at, 'ການຂາຍ #' || o.id as source
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_id = $1

    ORDER BY created_at DESC
  `, [id]);
  return ok(result.rows);
});