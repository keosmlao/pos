export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { fail, handle, ok, readJson } from '@/lib/api';
import { ensurePurchaseReturnsSchema, ensureCompanyProfileSchema } from '@/lib/migrations';
import { allocateDocumentNumber } from '@/lib/billNumber';
import { publishEvent } from '@/lib/appEvents';

// ສົ່ງເຄື່ອງຄືນໃຫ້ຜູ້ສະໜອງ — ອ້າງອີງບິນຊື້ເຂົ້າ, ຄືນບາງສ່ວນ ຫຼື ເຕັມຈຳນວນ
//
// ມູນຄ່າຄືນ = ຕົ້ນທຶນຕໍ່ໜ່ວຍ × (ຍອດບິນຈິງ ÷ ມູນຄ່າສິນຄ້າລວມ) — ປັນສ່ວນສ່ວນຫຼຸດຂອງ
// ບິນຊື້ລົງແຕ່ລະລາຍການ ບໍ່ດັ່ງນັ້ນຈະຮຽກເງິນຄືນຈາກຜູ້ສະໜອງເກີນຄວາມຈິງ.
//
// ວິທີຮັບເງິນຄືນ (settle_mode):
//   'refund' — ຜູ້ສະໜອງຄືນເງິນ ສົດ / ໂອນ / ທັງສອງຢ່າງ (payments[])
//   'debt'   — ຫັກອອກຈາກໜີ້ທີ່ຍັງຄ້າງຜູ້ສະໜອງ (ບໍ່ມີເງິນເຄື່ອນໄຫວ)

const METHODS = new Set(['cash', 'transfer', 'qr', 'cheque']);

export const GET = handle(async () => {
  await ensurePurchaseReturnsSchema();
  const result = await pool.query(`
    SELECT pr.*,
      p.ref_number, p.sml_doc_no, p.created_at AS purchase_created_at,
      p.total AS purchase_total, p.currency, p.payment_type, p.status AS purchase_status,
      s.name AS supplier_name,
      COALESCE(json_agg(json_build_object(
        'id', pri.id,
        'product_id', pri.product_id,
        'product_name', pd.product_name,
        'product_code', pd.product_code,
        'unit', pd.unit,
        'quantity', pri.quantity,
        'cost_price', pri.cost_price,
        'net_price', pri.net_price,
        'amount', pri.amount
      ) ORDER BY pri.id) FILTER (WHERE pri.id IS NOT NULL), '[]') AS items
    FROM purchase_returns pr
    JOIN purchases p ON p.id = pr.purchase_id
    LEFT JOIN suppliers s ON s.id = COALESCE(pr.supplier_id, p.supplier_id)
    LEFT JOIN purchase_return_items pri ON pri.purchase_return_id = pr.id
    LEFT JOIN products pd ON pd.id = pri.product_id
    GROUP BY pr.id, p.id, s.name
    ORDER BY pr.created_at DESC
    LIMIT 300
  `);
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensurePurchaseReturnsSchema();
  await ensureCompanyProfileSchema();
  const body = await readJson(request);
  const purchaseId = Number(body.purchase_id);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!Number.isInteger(purchaseId) || purchaseId <= 0) return fail(400, 'purchase_id is required');
  if (items.length === 0) return fail(400, 'ກະລຸນາເລືອກສິນຄ້າທີ່ຈະສົ່ງຄືນ');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const purRes = await client.query('SELECT * FROM purchases WHERE id = $1 FOR UPDATE', [purchaseId]);
    if (purRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'ບໍ່ພົບບິນຊື້ເຂົ້າ');
    }
    const purchase = purRes.rows[0];

    const ids = items.map(it => Number(it.purchase_item_id)).filter(id => Number.isInteger(id) && id > 0);
    if (ids.length === 0) {
      await client.query('ROLLBACK');
      return fail(400, 'ລາຍການບໍ່ຖືກຕ້ອງ');
    }

    const lineRes = await client.query(
      `SELECT id AS purchase_item_id, product_id, quantity::float AS bought_qty, cost_price::float AS cost_price
       FROM purchase_items WHERE purchase_id = $1 AND id = ANY($2::int[]) FOR UPDATE`,
      [purchaseId, ids]
    );
    const returnedRes = await client.query(
      `SELECT purchase_item_id, COALESCE(SUM(quantity), 0)::float AS returned_qty
       FROM purchase_return_items WHERE purchase_item_id = ANY($1::int[])
       GROUP BY purchase_item_id`,
      [ids]
    );
    const returnedById = new Map(returnedRes.rows.map(r => [Number(r.purchase_item_id), Number(r.returned_qty) || 0]));
    const byId = new Map(lineRes.rows.map(r => [Number(r.purchase_item_id), r]));

    const normalized = [];
    for (const item of items) {
      const lineId = Number(item.purchase_item_id);
      const qty = Math.max(0, Number(item.quantity) || 0);
      if (!lineId || qty <= 0) continue;
      const row = byId.get(lineId);
      if (!row) {
        await client.query('ROLLBACK');
        return fail(400, 'ລາຍການບໍ່ຢູ່ໃນບິນຊື້ນີ້');
      }
      const returnable = Math.max(0, Number(row.bought_qty) - (returnedById.get(lineId) || 0));
      if (qty > returnable) {
        await client.query('ROLLBACK');
        return fail(400, `ຈຳນວນທີ່ສົ່ງຄືນເກີນຈຳນວນທີ່ຮັບເຂົ້າ (ເຫຼືອຄືນໄດ້ ${returnable})`);
      }
      normalized.push({
        purchase_item_id: lineId,
        product_id: Number(row.product_id),
        quantity: qty,
        cost_price: Number(row.cost_price) || 0,
        gross: qty * (Number(row.cost_price) || 0),
      });
    }
    if (normalized.length === 0) {
      await client.query('ROLLBACK');
      return fail(400, 'ຍັງບໍ່ໄດ້ລະບຸຈຳນວນທີ່ຈະສົ່ງຄືນ');
    }

    // ປັນສ່ວນສ່ວນຫຼຸດຂອງບິນຊື້ລົງແຕ່ລະລາຍການ
    const grossRes = await client.query(
      `SELECT COALESCE(SUM(quantity * cost_price), 0)::numeric AS gross FROM purchase_items WHERE purchase_id = $1`,
      [purchaseId]
    );
    const purchaseGross = Number(grossRes.rows[0]?.gross) || 0;
    const purchaseTotal = Number(purchase.total) || 0;
    const netRatio = purchaseGross > 0 ? purchaseTotal / purchaseGross : 1;

    for (const it of normalized) {
      it.net_price = it.cost_price * netRatio;
      it.amount = it.gross * netRatio;
    }
    const grossAmount = Math.round(normalized.reduce((s, it) => s + it.gross, 0));
    const refundAmount = Math.max(0, Math.round(normalized.reduce((s, it) => s + it.amount, 0)));
    const discountAmount = Math.max(0, grossAmount - refundAmount);

    // ວິທີຮັບເງິນຄືນ
    const settleMode = body.settle_mode === 'debt' ? 'debt' : 'refund';
    let payments = null;
    if (settleMode === 'refund') {
      const raw = Array.isArray(body.payments) ? body.payments : [];
      payments = raw
        .map(p => ({
          method: METHODS.has(String(p.method)) ? String(p.method) : 'cash',
          amount: Math.max(0, Math.round(Number(p.amount) || 0)),
          note: String(p.note || '').trim() || null,
        }))
        .filter(p => p.amount > 0);
      if (payments.length === 0) payments = [{ method: 'cash', amount: refundAmount, note: null }];
      const paid = payments.reduce((s, p) => s + p.amount, 0);
      if (paid !== refundAmount) {
        await client.query('ROLLBACK');
        return fail(400, `ຍອດຮັບຄືນ (${paid.toLocaleString()} ₭) ບໍ່ຕົງກັບຍອດທີ່ຕ້ອງຄືນ (${refundAmount.toLocaleString()} ₭)`);
      }
    }

    // ຕັດສະຕັອກ — ຕ້ອງມີເຫຼືອພໍ ຈຶ່ງສົ່ງຄືນໄດ້
    for (const it of normalized) {
      const upd = await client.query(
        `UPDATE products SET qty_on_hand = qty_on_hand - $1
         WHERE id = $2 AND qty_on_hand >= $1 RETURNING id`,
        [it.quantity, it.product_id]
      );
      if (upd.rowCount === 0) {
        await client.query('ROLLBACK');
        const nameRes = await pool.query('SELECT product_name FROM products WHERE id = $1', [it.product_id]);
        const name = nameRes.rows[0]?.product_name || `#${it.product_id}`;
        return fail(400, `ສະຕັອກບໍ່ພຽງພໍທີ່ຈະສົ່ງຄືນ: ${name}`);
      }
    }

    const settingsRes = await client.query('SELECT * FROM company_profile WHERE id = 1');
    const settings = settingsRes.rows[0] || {};
    const returnNumber = await allocateDocumentNumber(client, 'purchase_return', settings);

    const retRes = await client.query(
      `INSERT INTO purchase_returns (return_number, purchase_id, supplier_id, gross_amount,
                                     discount_amount, refund_amount, settle_mode, payments, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10) RETURNING *`,
      [
        returnNumber, purchaseId, purchase.supplier_id || null,
        grossAmount, discountAmount, refundAmount, settleMode,
        payments ? JSON.stringify(payments) : null,
        String(body.note || '').trim() || null,
        String(body.created_by || '').trim() || null,
      ]
    );
    const ret = retRes.rows[0];

    for (const it of normalized) {
      await client.query(
        `INSERT INTO purchase_return_items (purchase_return_id, purchase_item_id, product_id, quantity, cost_price, net_price, amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ret.id, it.purchase_item_id, it.product_id, it.quantity, it.cost_price, it.net_price, it.amount]
      );
    }

    // ຫັກອອກຈາກໜີ້ຄ້າງ — ຖືເປັນການຊຳລະລ່ວງໜ້າໃສ່ບິນນັ້ນ (ໜ້າໜີ້ຜູ້ສະໜອງຄິດ total − paid)
    if (settleMode === 'debt') {
      await client.query(
        `UPDATE purchases SET paid = LEAST(total, COALESCE(paid, 0) + $1) WHERE id = $2`,
        [refundAmount, purchaseId]
      );
      await client.query(
        `UPDATE purchases SET status = CASE WHEN paid >= total THEN 'paid' WHEN paid > 0 THEN 'partial' ELSE 'pending' END
         WHERE id = $1`,
        [purchaseId]
      );
    }

    const itemsRes = await client.query(
      `SELECT pri.*, p.product_name, p.product_code, p.unit
       FROM purchase_return_items pri LEFT JOIN products p ON p.id = pri.product_id
       WHERE pri.purchase_return_id = $1 ORDER BY pri.id`,
      [ret.id]
    );

    await client.query('COMMIT');

    publishEvent('purchase.return', {
      id: ret.id, return_number: ret.return_number, purchase_id: purchaseId,
      refund_amount: refundAmount, settle_mode: settleMode,
    }).catch(() => {});

    return ok({ ...ret, items: itemsRes.rows });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
