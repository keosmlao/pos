export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';

export const PUT = handle(async (request, { params }) => {
  const { id } = await params;
  const { name, pos_visible } = await readJson(request);

  const old = await pool.query('SELECT name FROM categories WHERE id = $1', [id]);
  if (old.rows.length === 0) return fail(404, 'Category not found');
  const oldName = old.rows[0].name;

  if (name !== undefined && pos_visible !== undefined) {
    const result = await pool.query(
      'UPDATE categories SET name = $1, pos_visible = $2 WHERE id = $3 RETURNING *',
      [name, !!pos_visible, id]
    );
    if (name !== oldName) {
      await pool.query('UPDATE products SET category = $1 WHERE category = $2', [name, oldName]);
    }
    return ok(result.rows[0]);
  }

  if (pos_visible !== undefined) {
    const result = await pool.query(
      'UPDATE categories SET pos_visible = $1 WHERE id = $2 RETURNING *',
      [!!pos_visible, id]
    );
    return ok(result.rows[0]);
  }

  const result = await pool.query(
    'UPDATE categories SET name = $1 WHERE id = $2 RETURNING *',
    [name, id]
  );
  if (name !== oldName) {
    await pool.query('UPDATE products SET category = $1 WHERE category = $2', [name, oldName]);
  }
  return ok(result.rows[0]);
});

export const DELETE = handle(async (_request, { params }) => {
  const { id } = await params;
  const cat = await pool.query('SELECT name FROM categories WHERE id = $1', [id]);
  if (cat.rows.length === 0) return fail(404, 'Category not found');

  const products = await pool.query('SELECT COUNT(*) FROM products WHERE category = $1', [cat.rows[0].name]);
  if (parseInt(products.rows[0].count) > 0) {
    return fail(400, 'ບໍ່ສາມາດລຶບໝວດໝູ່ທີ່ມີສິນຄ້າ');
  }

  await pool.query('DELETE FROM categories WHERE id = $1', [id]);
  return ok({ message: 'Category deleted' });
});