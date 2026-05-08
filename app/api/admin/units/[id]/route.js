export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';

export const PUT = handle(async (request, { params }) => {
  const { id } = await params;
  const { name } = await readJson(request);

  const old = await pool.query('SELECT name FROM units WHERE id = $1', [id]);
  if (old.rows.length === 0) return fail(404, 'Unit not found');
  const oldName = old.rows[0].name;

  const result = await pool.query(
    'UPDATE units SET name = $1 WHERE id = $2 RETURNING *',
    [name, id]
  );

  await pool.query('UPDATE products SET unit = $1 WHERE unit = $2', [name, oldName]);

  return ok(result.rows[0]);
});

export const DELETE = handle(async (_request, { params }) => {
  const { id } = await params;
  const unit = await pool.query('SELECT name FROM units WHERE id = $1', [id]);
  if (unit.rows.length === 0) return fail(404, 'Unit not found');

  const products = await pool.query('SELECT COUNT(*) FROM products WHERE unit = $1', [unit.rows[0].name]);
  if (parseInt(products.rows[0].count) > 0) {
    return fail(400, 'ບໍ່ສາມາດລຶບຫົວໜ່ວຍທີ່ມີສິນຄ້າ');
  }

  await pool.query('DELETE FROM units WHERE id = $1', [id]);
  return ok({ message: 'Unit deleted' });
});