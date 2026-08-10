export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { fail, handle, ok, getQuery, readJson } from '@/lib/api';
import { generateBarcodeValues, isCode128Encodable, BARCODE_PREFIX_RE } from '@/lib/code128';

const NO_BARCODE = `COALESCE(TRIM(p.barcode), '') = ''`;

// GET — ສິນຄ້າທີ່ຍັງບໍ່ມີບາໂຄດ (ກອງຕາມໝວດໝູ່ / ຍີ່ຫໍ້ / ຄຳຄົ້ນຫາ)
export const GET = handle(async (request) => {
  const { category, brand, q } = getQuery(request);
  const params = [category || null, brand || null, q ? `%${String(q).trim().toLowerCase()}%` : null];

  const where = `
    WHERE ${NO_BARCODE}
      AND ($1::text IS NULL OR p.category = $1::text)
      AND ($2::text IS NULL OR p.brand = $2::text)
      AND ($3::text IS NULL OR LOWER(COALESCE(p.product_name, '')) LIKE $3::text
           OR LOWER(COALESCE(p.product_code, '')) LIKE $3::text)`;

  const products = await pool.query(
    `SELECT p.id, p.product_code, p.product_name, p.category, p.brand, p.unit, p.qty_on_hand
       FROM products p ${where}
      ORDER BY p.product_code NULLS LAST, p.id`,
    params
  );

  // ໝວດໝູ່ / ຍີ່ຫໍ້ ນັບສະເພາະສິນຄ້າທີ່ຍັງບໍ່ມີບາໂຄດ ຈຶ່ງບໍ່ມີຕົວເລືອກທີ່ກອງແລ້ວວ່າງເປົ່າ
  const facets = await pool.query(
    `SELECT 'category' AS kind, COALESCE(NULLIF(TRIM(p.category), ''), '—') AS name, COUNT(*)::int AS n
       FROM products p WHERE ${NO_BARCODE} GROUP BY 2
      UNION ALL
     SELECT 'brand', COALESCE(NULLIF(TRIM(p.brand), ''), '—'), COUNT(*)::int
       FROM products p WHERE ${NO_BARCODE} GROUP BY 2
      ORDER BY 1, 3 DESC, 2`
  );

  const totals = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE ${NO_BARCODE})::int AS without_barcode,
            COUNT(*) FILTER (WHERE NOT (${NO_BARCODE}))::int AS with_barcode
       FROM products p`
  );

  return ok({
    products: products.rows,
    categories: facets.rows.filter(r => r.kind === 'category').map(({ name, n }) => ({ name, n })),
    brands: facets.rows.filter(r => r.kind === 'brand').map(({ name, n }) => ({ name, n })),
    totals: totals.rows[0],
  });
});

// POST — ສ້າງ ແລະ ບັນທຶກບາໂຄດໃຫ້ສິນຄ້າທີ່ຕິກເລືອກ
//   { product_ids: [1,2], prefix: '33', length: 13, dry_run?: true }
export const POST = handle(async (request) => {
  const body = await readJson(request);
  const ids = (Array.isArray(body?.product_ids) ? body.product_ids : [])
    .map(Number).filter(n => Number.isInteger(n) && n > 0);
  const prefix = String(body?.prefix ?? '').trim();
  const length = Number(body?.length ?? 13);
  const mode = body?.mode === 'sequential' ? 'sequential' : 'random';
  const dryRun = !!body?.dry_run;

  if (ids.length === 0) return fail(400, 'ກະລຸນາຕິກເລືອກສິນຄ້າຢ່າງໜ້ອຍ 1 ລາຍການ');
  if (!BARCODE_PREFIX_RE.test(prefix)) return fail(400, 'ຄຳນຳໜ້າໃຊ້ໄດ້ແຕ່ຕົວເລກ ຫຼື ຕົວອັກສອນອັງກິດ (ສູງສຸດ 8 ຕົວ)');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ລັອກແຖວທີ່ຈະແກ້ ແລະ ເອົາສະເພາະອັນທີ່ຍັງບໍ່ມີບາໂຄດຈິງໆ (ກັນຊ້ຳເມື່ອມີຄົນເຮັດພ້ອມກັນ)
    const target = await client.query(
      `SELECT id, product_code, product_name FROM products
        WHERE id = ANY($1::int[]) AND COALESCE(TRIM(barcode), '') = ''
        ORDER BY product_code NULLS LAST, id
          FOR UPDATE`,
      [ids]
    );
    if (target.rows.length === 0) {
      await client.query('ROLLBACK');
      return fail(400, 'ສິນຄ້າທີ່ເລືອກມີບາໂຄດຢູ່ແລ້ວທັງໝົດ');
    }

    const takenRes = await client.query(
      `SELECT TRIM(barcode) AS b FROM products WHERE COALESCE(TRIM(barcode), '') <> ''`
    );
    const taken = new Set(takenRes.rows.map(r => r.b));

    let generated;
    try {
      generated = generateBarcodeValues({
        prefix, totalLength: length, count: target.rows.length, taken, mode,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      return fail(400, e.message);
    }

    if (generated.exhausted) {
      await client.query('ROLLBACK');
      return fail(400, `ເລກບໍ່ພຽງພໍ — ຄຳນຳໜ້າ "${prefix}" ຄວາມຍາວ ${length} ມີພື້ນທີ່ ${generated.capacity} ເລກ ແລະ ຖືກໃຊ້ໄປຫຼາຍແລ້ວ`);
    }

    const assignments = target.rows.map((p, i) => ({
      product_id: p.id,
      product_code: p.product_code,
      product_name: p.product_name,
      barcode: generated.values[i],
    }));

    // ກັນເໝືອນຢ່າງເດັດຂາດ: ທຸກເລກຕ້ອງເຂົ້າລະຫັດ CODE 128 ໄດ້
    const bad = assignments.find(a => !isCode128Encodable(a.barcode));
    if (bad) {
      await client.query('ROLLBACK');
      return fail(400, `ເລກ "${bad.barcode}" ເຂົ້າລະຫັດ CODE 128 ບໍ່ໄດ້`);
    }

    if (dryRun) {
      await client.query('ROLLBACK');
      return ok({ dry_run: true, assigned: 0, skipped: ids.length - assignments.length, assignments });
    }

    for (const a of assignments) {
      await client.query('UPDATE products SET barcode = $1 WHERE id = $2', [a.barcode, a.product_id]);
    }

    await client.query('COMMIT');
    return ok({
      dry_run: false,
      mode,
      assigned: assignments.length,
      skipped: ids.length - assignments.length,
      assignments,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
