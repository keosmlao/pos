export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, getQuery } from '@/lib/api';
import { ensurePromotionsSchema } from '@/lib/migrations';

// Look up a promotion by coupon code. Returns the promotion if it's active
// (within date range, not exhausted, days/time match). The POS-side promo
// engine still does the full applicability check against the cart.
export const GET = handle(async (request) => {
  await ensurePromotionsSchema();
  const { code } = getQuery(request);
  const c = String(code || '').trim();
  if (!c) return fail(400, 'code is required');

  const result = await pool.query(
    `SELECT * FROM promotions
     WHERE LOWER(code) = LOWER($1)
       AND active = true
       AND (start_date IS NULL OR start_date <= CURRENT_DATE)
       AND (end_date IS NULL OR end_date >= CURRENT_DATE)
       AND (max_uses IS NULL OR COALESCE(used_count, 0) < max_uses)
     LIMIT 1`,
    [c]
  );
  if (result.rowCount === 0) return fail(404, 'ບໍ່ພົບ Coupon ຫຼື ໝົດອາຍຸ');
  return ok(result.rows[0]);
});
