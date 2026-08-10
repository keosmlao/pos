export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { fail, handle, ok, readJson } from '@/lib/api';
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
//
// ຈຳກັດຂອບເຂດໄດ້ (ບໍ່ລະບຸ = ທັງໝົດ):
//   ?codes=A001,A002   ຫຼື  body { codes: [...] }        — ລະຫັດສິນຄ້າ / ບາໂຄດ
//   ?product_ids=1,2   ຫຼື  body { product_ids: [...] }  — id ໂດຍກົງ (ໃຊ້ຕອນຕິກເລືອກ)

async function ensureAll() {
  await ensureOrdersSchema();
  await ensureReturnsSchema();
  await ensureStockAdjustmentsSchema();
  await ensureLaybysSchema();
  await ensurePurchaseReturnsSchema();
  await ensureProductsExtraSchema();
  await ensureCompanyProfileSchema();
}

// ແຍກຄ່າທີ່ຜູ້ໃຊ້ພິມມາ — ຮັບທັງ comma, ຍະຫວ່າງ ແລະ ຂຶ້ນແຖວໃໝ່
function splitTokens(value) {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean);
  return String(value || '').split(/[,\s]+/).map(v => v.trim()).filter(Boolean);
}

// ແປງ id + ລະຫັດ → ລາຍການ id ທີ່ຈະກວດ · null = ທັງໝົດ
// ຄືນ notFound ນຳ ເພື່ອໃຫ້ໜ້າຈໍບອກໄດ້ວ່າລະຫັດໃດພິມຜິດ
async function resolveScope({ ids, codes }) {
  const wantIds = splitTokens(ids).map(Number).filter(n => Number.isInteger(n) && n > 0);
  const wantCodes = splitTokens(codes);
  if (!wantIds.length && !wantCodes.length) return { ids: null, notFound: [] };

  const upper = wantCodes.map(c => c.toUpperCase());
  const res = await pool.query(
    `SELECT id, product_code, barcode FROM products
     WHERE id = ANY($1::int[])
        OR UPPER(TRIM(COALESCE(product_code, ''))) = ANY($2::text[])
        OR UPPER(TRIM(COALESCE(barcode, ''))) = ANY($2::text[])
     ORDER BY id`,
    [wantIds, upper]
  );

  const matched = new Set();
  for (const r of res.rows) {
    matched.add(String(r.product_code || '').trim().toUpperCase());
    matched.add(String(r.barcode || '').trim().toUpperCase());
  }
  const foundIds = new Set(res.rows.map(r => r.id));
  const notFound = [
    ...wantCodes.filter(c => !matched.has(c.toUpperCase())),
    ...wantIds.filter(id => !foundIds.has(id)).map(id => `#${id}`),
  ];

  return { ids: res.rows.map(r => r.id), notFound };
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
  const q = request.nextUrl.searchParams;
  const scope = await resolveScope({
    // product_id (ຄຳດຽວ) ຍັງຮອງຮັບຢູ່ ເພື່ອບໍ່ໃຫ້ບ່ອນທີ່ເອີ້ນຢູ່ແລ້ວພັງ
    ids: q.get('product_ids') || q.get('product_id') || '',
    codes: q.get('codes') || '',
  });
  // ລະບຸມາແຕ່ບໍ່ພົບຈັກລາຍການ → ຢ່າໄປກວດທັງໝົດແທນ
  if (scope.ids && scope.ids.length === 0) {
    return ok({ dry_run: true, scanned: 0, changed: 0, changes: [], not_found: scope.notFound });
  }
  return ok({ ...(await run(scope.ids, { dryRun: true })), not_found: scope.notFound });
});

export const POST = handle(async (request) => {
  await ensureAll();
  const body = await readJson(request).catch(() => ({}));
  const scope = await resolveScope({ ids: body?.product_ids || '', codes: body?.codes || '' });
  if (scope.ids && scope.ids.length === 0) {
    return fail(400, 'ບໍ່ພົບສິນຄ້າຕາມລະຫັດທີ່ລະບຸ');
  }
  return ok({ ...(await run(scope.ids, { dryRun: false })), not_found: scope.notFound });
});
