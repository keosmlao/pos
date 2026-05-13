export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson } from '@/lib/api';
import { ensurePromotionsSchema } from '@/lib/migrations';

const normalize = (b) => {
  const code = String(b.code || '').trim().toUpperCase().replace(/\s+/g, '');
  return {
    name: b.name,
    description: b.description || null,
    type: b.type || 'cart_percent',
    value: Number(b.value) || 0,
    buy_qty: Number(b.buy_qty) || 0,
    get_qty: Number(b.get_qty) || 0,
    min_purchase: Number(b.min_purchase) || 0,
    scope: b.scope || 'all',
    scope_ids: Array.isArray(b.scope_ids) ? b.scope_ids : [],
    product_id: b.product_id ? Number(b.product_id) : null,
    category: b.category || null,
    start_date: b.start_date || null,
    end_date: b.end_date || null,
    start_time: b.start_time || null,
    end_time: b.end_time || null,
    days_of_week: Array.isArray(b.days_of_week) ? b.days_of_week : [],
    priority: Number(b.priority) || 0,
    max_uses: b.max_uses ? Number(b.max_uses) : null,
    stackable: b.stackable !== false,
    active: b.active !== false,
    gift_product_id: b.gift_product_id ? Number(b.gift_product_id) : null,
    code: code || null,
    requires_code: !!b.requires_code && !!code,
  };
};

export const GET = handle(async () => {
  await ensurePromotionsSchema();
  const result = await pool.query(`
    SELECT p.*, pr.product_name
    FROM promotions p
    LEFT JOIN products pr ON p.product_id = pr.id
    ORDER BY p.priority DESC, p.created_at DESC
  `);
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensurePromotionsSchema();
  const n = normalize(await readJson(request));
  const result = await pool.query(
    `INSERT INTO promotions
     (name, description, type, value, buy_qty, get_qty, min_purchase, scope, scope_ids, product_id, category,
      start_date, end_date, start_time, end_time, days_of_week, priority, max_uses, stackable, active, gift_product_id,
      code, requires_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18,$19,$20,$21,$22,$23) RETURNING *`,
    [n.name, n.description, n.type, n.value, n.buy_qty, n.get_qty, n.min_purchase, n.scope, JSON.stringify(n.scope_ids),
     n.product_id, n.category, n.start_date, n.end_date, n.start_time, n.end_time, JSON.stringify(n.days_of_week),
     n.priority, n.max_uses, n.stackable, n.active, n.gift_product_id, n.code, n.requires_code]
  );
  return ok(result.rows[0]);
});