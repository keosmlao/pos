export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson } from '@/lib/api';
import {
  ensureOrdersSchema, ensureReturnsSchema, ensureStockAdjustmentsSchema,
  ensureLaybysSchema, ensurePurchaseReturnsSchema, ensureProductsExtraSchema,
  ensureCompanyProfileSchema,
} from '@/lib/migrations';
import { recalcProductCost } from '@/lib/productCost';

// ຄຳນວນຕົ້ນທຶນສິນຄ້າຄືນຍ້ອນຫຼັງ ຈາກເອກະສານຮັບເຂົ້າ-ຈ່າຍອອກທີ່ມີຢູ່ຈິງ
//
// ໃຊ້ເມື່ອ: ຂໍ້ມູນເກົ່າທີ່ບັນທຶກກ່ອນລະບົບຄຳນວນຄືນອັດຕະໂນມັດ — ຕອນນັ້ນການລົບ
// ໃບຮັບເຂົ້າ / ໃບສົ່ງຄືນ ບໍ່ໄດ້ແກ້ຕົ້ນທຶນ ຈຶ່ງມີຄ່າຄ້າງທີ່ບໍ່ກົງກັບເອກະສານ
//
// GET  = ເບິ່ງກ່ອນວ່າຈະປ່ຽນຫຍັງແດ່ (dry run — ບໍ່ບັນທຶກ)
// POST = ບັນທຶກຈິງ

async function ensureAll() {
  await ensureOrdersSchema();
  await ensureReturnsSchema();
  await ensureStockAdjustmentsSchema();
  await ensureLaybysSchema();
  await ensurePurchaseReturnsSchema();
  await ensureProductsExtraSchema();
  await ensureCompanyProfileSchema();
}

async function run(productIds, { dryRun }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let ids = productIds;
    if (!ids) {
      const r = await client.query('SELECT id FROM products ORDER BY id');
      ids = r.rows.map(x => x.id);
    }

    const changes = [];
    let scanned = 0;
    for (const pid of ids) {
      const res = await recalcProductCost(client, pid);
      if (!res) continue;
      scanned++;
      if (res.changed) changes.push(res);
    }

    // ເອົາຊື່ສິນຄ້າມາຕິດເພື່ອໃຫ້ອ່ານລາຍງານໄດ້
    if (changes.length > 0) {
      const named = await client.query(
        `SELECT id, product_code, product_name FROM products WHERE id = ANY($1::int[])`,
        [changes.map(c => c.product_id)]
      );
      const byId = new Map(named.rows.map(r => [r.id, r]));
      for (const c of changes) {
        const p = byId.get(c.product_id);
        c.product_code = p?.product_code || null;
        c.product_name = p?.product_name || null;
        c.diff = Math.round((c.after - c.before) * 100) / 100;
      }
      changes.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    }

    if (dryRun) await client.query('ROLLBACK');
    else await client.query('COMMIT');

    return { dry_run: !!dryRun, scanned, changed: changes.length, changes };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export const GET = handle(async (request) => {
  await ensureAll();
  const raw = request.nextUrl.searchParams.get('product_id');
  const pid = Number(raw) > 0 ? [Number(raw)] : null;
  return ok(await run(pid, { dryRun: true }));
});

export const POST = handle(async (request) => {
  await ensureAll();
  const body = await readJson(request).catch(() => ({}));
  const ids = Array.isArray(body?.product_ids) && body.product_ids.length > 0
    ? body.product_ids.map(Number).filter(n => Number.isInteger(n) && n > 0)
    : null;
  return ok(await run(ids, { dryRun: false }));
});
