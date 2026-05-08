export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const GET = handle(async (request) => {
  const sp = request.nextUrl.searchParams;
  const category = sp.get('category');
  const search = sp.get('search');
  let query = `
    SELECT p.*
    FROM products p
    LEFT JOIN categories c ON c.name = p.category
    WHERE p.status = true
      AND (p.category IS NULL OR c.pos_visible IS NULL OR c.pos_visible = true)
  `;
  const params = [];

  if (category) {
    params.push(category);
    query += ` AND p.category = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (p.product_name ILIKE $${params.length} OR p.product_code ILIKE $${params.length} OR p.barcode ILIKE $${params.length})`;
  }

  query += ' ORDER BY p.product_name';
  const result = await pool.query(query, params);
  return ok(result.rows);
});