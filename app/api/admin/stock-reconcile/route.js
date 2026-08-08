export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { fail, handle, ok, readJson } from '@/lib/api';
import {
  ensureOrdersSchema, ensureReturnsSchema, ensureStockAdjustmentsSchema,
  ensureLaybysSchema, ensurePurchaseReturnsSchema, ensureCompanyProfileSchema,
} from '@/lib/migrations';
import { allocateDocumentNumber } from '@/lib/billNumber';
import { extractActor, logAudit } from '@/lib/audit';
import { recalcProductCosts } from '@/lib/productCost';

// ກວດຄວາມສົມດຸນສະຕັອກ
//
// ຄວາມຈິງທີ່ຄວນເປັນ:  qty_on_hand = Σ ການເຄື່ອນໄຫວທີ່ມີເອກະສານ
// ຖ້າບໍ່ຕົງ ແປວ່າມີການປ່ຽນສະຕັອກທີ່ບໍ່ມີເອກະສານ (ພິມຍອດຕອນສ້າງສິນຄ້າ, ນຳເຂົ້າ CSV,
// ແກ້ຈຳນວນໃນໜ້າຈັດການສິນຄ້າ) — ເອີ້ນວ່າ "ຍອດຍົກມາ"
//
// ວິທີແກ້ 2 ທາງ ເລືອກໄດ້ລາຍລາຍການ:
//   trust_stock — ຂອງໃນສາງຖືກ  → ອອກໃບປັບປຸງ "ຍອດຍົກມາ" +ສ່ວນຕ່າງ ລົງວັນທີກ່ອນເອກະສານ
//                                  ທຳອິດ ສະຕັອກບໍ່ປ່ຽນ ບັດສາງກາຍເປັນສົມດຸນ
//   trust_docs  — ເອກະສານຖືກ    → ຍອດຍົກມານັ້ນເປັນການພິມຜິດ ລົບອອກ ໂດຍຕັ້ງ
//                                  qty_on_hand = ຍອດຕາມເອກະສານ ແລະ ບັນທຶກໄວ້ໃນ audit log
//                                  (ບໍ່ອອກໃບປັບປຸງ ເພາະມັນບໍ່ແມ່ນການເຄື່ອນໄຫວຂອງຈິງ)

const MISMATCH_SQL = `
WITH doc AS (
  SELECT product_id, SUM(n) AS net, MIN(first_at) AS first_at FROM (
    SELECT oi.product_id, -SUM(oi.quantity) AS n, MIN(o.created_at) AS first_at
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE NOT EXISTS (SELECT 1 FROM laybys l JOIN layby_items li ON li.layby_id = l.id
                        WHERE l.completed_order_id = o.id)
      GROUP BY oi.product_id
    UNION ALL
    SELECT ri.product_id, SUM(ri.quantity), MIN(r.created_at)
      FROM return_items ri JOIN returns r ON r.id = ri.return_id GROUP BY ri.product_id
    UNION ALL
    SELECT pi.product_id, SUM(pi.quantity), MIN(pu.created_at)
      FROM purchase_items pi JOIN purchases pu ON pu.id = pi.purchase_id GROUP BY pi.product_id
    UNION ALL
    SELECT pri.product_id, -SUM(pri.quantity), MIN(pr.created_at)
      FROM purchase_return_items pri JOIN purchase_returns pr ON pr.id = pri.purchase_return_id
      GROUP BY pri.product_id
    UNION ALL
    SELECT sa.product_id, SUM(COALESCE(sa.delta, 0)), MIN(COALESCE(sa.approved_at, sa.created_at))
      FROM stock_adjustments sa
      WHERE (sa.status = 'approved' OR sa.status IS NULL) AND COALESCE(sa.delta, 0) <> 0
      GROUP BY sa.product_id
    UNION ALL
    SELECT li.product_id, -SUM(li.quantity), MIN(l.created_at)
      FROM layby_items li JOIN laybys l ON l.id = li.layby_id GROUP BY li.product_id
    UNION ALL
    SELECT li.product_id, SUM(li.quantity), MIN(COALESCE(l.cancelled_at, l.updated_at, l.created_at))
      FROM layby_items li JOIN laybys l ON l.id = li.layby_id
      WHERE l.status = 'cancelled' GROUP BY li.product_id
  ) x GROUP BY product_id
)
SELECT p.id AS product_id, p.product_code, p.product_name, COALESCE(p.unit, '') AS unit,
       COALESCE(p.qty_on_hand, 0)::float AS stock_qty,
       COALESCE(doc.net, 0)::float AS doc_qty,
       (COALESCE(p.qty_on_hand, 0) - COALESCE(doc.net, 0))::float AS diff,
       to_char(COALESCE(doc.first_at, p.created_at), 'YYYY-MM-DD HH24:MI') AS first_doc_at,
       to_char(p.created_at, 'YYYY-MM-DD HH24:MI') AS product_created_at,
       (doc.product_id IS NULL) AS no_documents
FROM products p
LEFT JOIN doc ON doc.product_id = p.id
WHERE COALESCE(p.qty_on_hand, 0) <> COALESCE(doc.net, 0)
  AND ($1::int IS NULL OR p.id = $1::int)
ORDER BY ABS(COALESCE(p.qty_on_hand, 0) - COALESCE(doc.net, 0)) DESC, p.product_code
`;

async function ensureAll() {
  await ensureOrdersSchema();
  await ensureReturnsSchema();
  await ensureStockAdjustmentsSchema();
  await ensureLaybysSchema();
  await ensurePurchaseReturnsSchema();
  await ensureCompanyProfileSchema();
}

export const GET = handle(async () => {
  await ensureAll();
  const rows = (await pool.query(MISMATCH_SQL, [null])).rows;
  return ok({
    checked_at: new Date().toISOString(),
    total: rows.length,
    surplus: rows.filter(r => r.diff > 0).length,      // ໃນລະບົບຫຼາຍກວ່າເອກະສານ
    shortage: rows.filter(r => r.diff < 0).length,     // ໃນລະບົບໜ້ອຍກວ່າເອກະສານ
    net_diff: rows.reduce((s, r) => s + Number(r.diff), 0),
    items: rows,
  });
});

export const POST = handle(async (request) => {
  await ensureAll();
  const body = await readJson(request).catch(() => ({}));
  const apply = body?.apply === true;
  const decisions = Array.isArray(body?.decisions) ? body.decisions : [];
  if (decisions.length === 0) return fail(400, 'ກະລຸນາເລືອກລາຍການທີ່ຈະແກ້ໄຂ');

  const actor = extractActor(request);
  const wanted = new Map();
  for (const d of decisions) {
    const pid = Number(d?.product_id);
    const mode = d?.mode === 'trust_docs' ? 'trust_docs' : 'trust_stock';
    if (Number.isInteger(pid) && pid > 0) wanted.set(pid, { mode, note: String(d?.note || '').trim() || null });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rows = (await client.query(MISMATCH_SQL, [null])).rows.filter(r => wanted.has(r.product_id));

    const settingsRes = await client.query('SELECT * FROM company_profile WHERE id = 1');
    const settings = settingsRes.rows[0] || {};

    const results = [];
    for (const r of rows) {
      const { mode, note } = wanted.get(r.product_id);
      const diff = Number(r.diff);
      if (!diff) continue;

      if (mode === 'trust_stock') {
        // ອອກໃບປັບປຸງ "ຍອດຍົກມາ" ລົງວັນທີກ່ອນເອກະສານທຳອິດ 1 ນາທີ ເພື່ອໃຫ້ຢູ່ແຖວທຳອິດ
        const adjNumber = apply ? await allocateDocumentNumber(client, 'stock_adjustment', settings) : null;
        if (apply) {
          await client.query(
            `INSERT INTO stock_adjustments
               (product_id, qty_before, qty_after, delta, reason, note, user_id, username,
                adjustment_type, adjustment_number, status, approved_by, approved_at, created_at)
             VALUES ($1, $2, $3, $4, 'correction', $5, $6, $7, 'opening', $8, 'approved', $7,
                     ($9::timestamp - INTERVAL '1 minute'),
                     ($9::timestamp - INTERVAL '1 minute'))`,
            [
              r.product_id, Number(r.doc_qty), Number(r.stock_qty), diff,
              note || 'ຍອດຍົກມາ (ບໍ່ມີເອກະສານ) — ອອກໂດຍການກວດຄວາມສົມດຸນສະຕັອກ',
              actor.user_id || null, actor.username || 'system',
              adjNumber, r.first_doc_at,
            ]
          );
        }
        results.push({
          ...r, mode, action: 'opening_document',
          document: adjNumber, new_stock_qty: Number(r.stock_qty), delta: diff,
        });
      } else {
        // ຍອດຍົກມາເປັນການພິມຜິດ — ຕັ້ງສະຕັອກໃຫ້ຕົງກັບເອກະສານ
        if (apply) {
          await client.query('UPDATE products SET qty_on_hand = $1 WHERE id = $2', [Number(r.doc_qty), r.product_id]);
          await logAudit(client, {
            action: 'stock.reconcile',
            summary: `${r.product_code} · ${Number(r.stock_qty)} → ${Number(r.doc_qty)}`,
            entity_type: 'product',
            entity_id: String(r.product_id),
            actor,
            payload: {
              product_code: r.product_code, product_name: r.product_name,
              qty_before: Number(r.stock_qty), qty_after: Number(r.doc_qty), diff,
              reason: note || 'ຍອດຍົກມາທີ່ບໍ່ມີເອກະສານ — ຖືວ່າພິມຜິດ ຈຶ່ງປັບໃຫ້ຕົງກັບເອກະສານ',
            },
          }).catch(() => {});
        }
        results.push({
          ...r, mode, action: 'set_stock_to_documents',
          document: null, new_stock_qty: Number(r.doc_qty), delta: -diff,
        });
      }
    }

    // ໃບຍອດຍົກມາລົງວັນທີກ່ອນທຸກເອກະສານ → ນ້ຳໜັກຂອງໃບຮັບເຂົ້າທັງໝົດປ່ຽນ
    // ຈຶ່ງຕ້ອງຄຳນວນຕົ້ນທຶນຄືນຫຼັງປັບສະຕັອກທຸກເທື່ອ
    if (apply) await recalcProductCosts(client, results.map(r => r.product_id));

    if (apply) await client.query('COMMIT'); else await client.query('ROLLBACK');

    return ok({
      applied: apply,
      count: results.length,
      results,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
});
