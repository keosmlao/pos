export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensurePriceHistorySchema } from '@/lib/migrations';
import { logPriceChange } from '@/lib/priceHistory';

export const POST = handle(async (request) => {
  await ensurePriceHistorySchema();
  const { updates, source } = await readJson(request);
  if (!Array.isArray(updates)) return fail(400, 'updates must be an array');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let updated = 0, skipped = 0, notFound = 0;
    const errors = [];
    for (const u of updates) {
      const id = u.id ? Number(u.id) : null;
      const code = u.product_code ? String(u.product_code).trim() : null;
      if (!id && !code) { skipped++; continue; }
      const cost = Number(u.cost_price);
      const sell = Number(u.selling_price);
      if (!isFinite(cost) || !isFinite(sell)) { skipped++; continue; }
      try {
        const findQ = id
          ? 'SELECT id, cost_price, selling_price FROM products WHERE id = $1'
          : 'SELECT id, cost_price, selling_price FROM products WHERE product_code = $1';
        const findRes = await client.query(findQ, [id || code]);
        if (findRes.rows.length === 0) { notFound++; continue; }
        const before = findRes.rows[0];
        await client.query(
          'UPDATE products SET cost_price = $1, selling_price = $2 WHERE id = $3',
          [cost, sell, before.id]
        );
        await logPriceChange(client, before.id, before, { cost_price: cost, selling_price: sell }, source || 'bulk_upload', null);
        updated++;
      } catch (e) {
        errors.push({ id, code, error: e.message });
      }
    }
    await client.query('COMMIT');
    return ok({ updated, skipped, notFound, total: updates.length, errors });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});