export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api';

export const GET = handle(async (_request, { params }) => {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) return fail(400, 'Invalid product id');

  const result = await pool.query(
    `
    SELECT
      pi.id,
      pi.quantity,
      pi.cost_price,
      pu.id AS purchase_id,
      pu.ref_number,
      pu.sml_doc_no,
      pu.sml_doc_date,
      pu.created_at AS purchase_date,
      pu.currency,
      pu.exchange_rate,
      pu.status,
      s.name AS supplier_name
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    LEFT JOIN suppliers s ON s.id = pu.supplier_id
    WHERE pi.product_id = $1
    ORDER BY pu.created_at DESC, pi.id DESC
    LIMIT 200
    `,
    [productId]
  );
  return ok(result.rows);
});
