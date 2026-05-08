export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensurePriceHistorySchema } from '@/lib/migrations';
import { logPriceChange } from '@/lib/priceHistory';

export const PUT = handle(async (request, { params }) => {
  await ensurePriceHistorySchema();
  const { id } = await params;
  const { cost_price, selling_price, note } = await readJson(request);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const findRes = await client.query('SELECT id, cost_price, selling_price FROM products WHERE id = $1', [id]);
    if (findRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'Product not found');
    }
    const before = findRes.rows[0];
    const result = await client.query(
      'UPDATE products SET cost_price = $1, selling_price = $2 WHERE id = $3 RETURNING *',
      [cost_price, selling_price, id]
    );
    await logPriceChange(client, Number(id), before, { cost_price, selling_price }, 'manual', note || null);
    await client.query('COMMIT');
    return ok(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});