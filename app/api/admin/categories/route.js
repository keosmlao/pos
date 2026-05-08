export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson } from '@/lib/api';

export const GET = handle(async () => {
  const result = await pool.query('SELECT * FROM categories ORDER BY name');
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  const { name } = await readJson(request);
  const result = await pool.query(
    'INSERT INTO categories (name) VALUES ($1) RETURNING *',
    [name]
  );
  return ok(result.rows[0]);
});