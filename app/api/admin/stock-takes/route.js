export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureStockTakesSchema } from '@/lib/migrations';
import { extractActor } from '@/lib/audit';

export const GET = handle(async () => {
  await ensureStockTakesSchema();
  const result = await pool.query(
    `SELECT st.*,
       (SELECT COUNT(*) FROM stock_take_items WHERE stock_take_id = st.id) AS item_count,
       (SELECT COUNT(*) FROM stock_take_items WHERE stock_take_id = st.id AND counted IS NOT NULL) AS counted_count,
       (SELECT COUNT(*) FROM stock_take_items WHERE stock_take_id = st.id AND counted IS NOT NULL AND delta <> 0) AS variance_count
     FROM stock_takes st
     ORDER BY st.created_at DESC`
  );
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureStockTakesSchema();
  const body = await readJson(request);
  const name = String(body.name || '').trim() || `Stock take ${new Date().toLocaleString('lo-LA')}`;
  const scope = body.scope || 'all';
  const scopeValue = body.scope_value || null;
  const actor = extractActor(request);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const takeRes = await client.query(
      `INSERT INTO stock_takes (name, status, branch_id, scope, scope_value, note, created_by)
       VALUES ($1, 'open', $2, $3, $4, $5, $6) RETURNING *`,
      [name, Number(body.branch_id) || null, scope, scopeValue, body.note || null, actor.username || null]
    );
    const take = takeRes.rows[0];

    // Snapshot products in scope as expected counts
    let productSql = `SELECT id, qty_on_hand FROM products WHERE status IS TRUE`;
    const params = [];
    if (scope === 'category' && scopeValue) {
      params.push(scopeValue);
      productSql += ` AND category = $${params.length}`;
    } else if (scope === 'brand' && scopeValue) {
      params.push(scopeValue);
      productSql += ` AND brand = $${params.length}`;
    }
    const productsRes = await client.query(productSql, params);
    for (const p of productsRes.rows) {
      await client.query(
        `INSERT INTO stock_take_items (stock_take_id, product_id, expected, counted)
         VALUES ($1, $2, $3, NULL)`,
        [take.id, p.id, Number(p.qty_on_hand) || 0]
      );
    }
    await client.query('COMMIT');
    return ok({ ...take, item_count: productsRes.rowCount });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
