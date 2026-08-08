export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import {
  ensureOrdersSchema, ensureReturnsSchema, ensureStockAdjustmentsSchema,
  ensureLaybysSchema, ensurePurchaseReturnsSchema,
} from '@/lib/migrations';
import { MOVEMENTS_CTE, DOC_TYPES } from '@/lib/stockMovementSql';

// ບັດສາງມູນຄ່າ — ການເຄື່ອນໄຫວສິນຄ້າພ້ອມຕົ້ນທຶນ
//
// ຈຳນວນຄົງເຫຼືອ: ນັບຖອຍຫຼັງຈາກ products.qty_on_hand (ຄືກັບໜ້າການເຄື່ອນໄຫວສິນຄ້າ)
// ຕົ້ນທຶນສະເລ່ຍ: ຄິດແບບ "ຖົວສະເລ່ຍເຄື່ອນທີ່" (moving average) ໄລ່ໄປໜ້າ
//     ຮັບເຂົ້າ  → ມູນຄ່າ += ຈຳນວນ × ຕົ້ນທຶນໃນເອກະສານ
//     ຈ່າຍອອກ  → ມູນຄ່າ −= ຈຳນວນ × ຕົ້ນທຶນສະເລ່ຍ ณ ຕອນນັ້ນ
//     ຕົ້ນທຶນສະເລ່ຍ = ມູນຄ່າຄົງເຫຼືອ ÷ ຈຳນວນຄົງເຫຼືອ
//
// ໝາຍເຫດ: ຕົ້ນທຶນສະເລ່ຍນີ້ໃຊ້ "ເບິ່ງແນວໂນ້ມ" — ກຳໄລໃນລາຍງານ COGS ຍັງອີງ
// ຕົ້ນທຶນ snapshot ຕອນຂາຍຄືເກົ່າ ບໍ່ໄດ້ປ່ຽນຕາມນີ້

export const GET = handle(async (request) => {
  await ensureOrdersSchema();
  await ensureReturnsSchema();
  await ensureStockAdjustmentsSchema();
  await ensureLaybysSchema();
  await ensurePurchaseReturnsSchema();

  const { from, to, product_id, search, types, limit } = getQuery(request);
  const productId = Number(product_id) > 0 ? Number(product_id) : null;
  const term = String(search || '').trim().toLowerCase();
  const typeList = String(types || '').split(',').map(t => t.trim()).filter(t => DOC_TYPES[t]);
  const rowLimit = Math.max(50, Math.min(5000, Number(limit) || 2000));

  const params = [productId, term ? `%${term}%` : null];
  const typeFilter = typeList.length > 0 ? new Set(typeList) : null;

  // ດຶງ *ທຸກ* ການເຄື່ອນໄຫວຂອງສິນຄ້າທີ່ເລືອກ (ບໍ່ກັ່ນຕອງວັນທີ) ເພື່ອໄລ່ຕົ້ນທຶນສະເລ່ຍ
  // ໃຫ້ຖືກຕັ້ງແຕ່ຕົ້ນ ແລ້ວຄ່ອຍຕັດສະແດງສະເພາະຊ່ວງທີ່ຂໍ
  const res = await pool.query(
    `WITH ${MOVEMENTS_CTE}
     -- ສົ່ງເປັນຂໍ້ຄວາມຕາມເຂດເວລາເຊີບເວີ — ຖ້າສົ່ງເປັນ timestamp ຈະຖືກແປງເປັນ UTC
     -- ແລ້ວການຕັດຊ່ວງວັນທີ (ແລະ ວັນທີທີ່ສະແດງ) ຈະເລື່ອນໄປໜຶ່ງວັນ
     SELECT to_char(doc_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS doc_at,
            doc_type, doc_no, product_id, product_code, product_name, unit, partner,
            qty_in::float, qty_out::float, unit_cost::float, cost_now::float,
            (qty_on_hand - total_net + cum_net - (qty_in - qty_out))::float AS balance_begin,
            (qty_on_hand - total_net + cum_net)::float AS balance_end
     FROM mv_run
     ORDER BY product_code NULLS LAST, product_id, doc_at, doc_type, ref_id
     LIMIT ${rowLimit}`,
    params
  );

  // ── ໄລ່ຕົ້ນທຶນສະເລ່ຍເຄື່ອນທີ່ຕໍ່ສິນຄ້າ ────────────────────────────────────
  const byProduct = new Map();
  for (const r of res.rows) {
    if (!byProduct.has(r.product_id)) byProduct.set(r.product_id, []);
    byProduct.get(r.product_id).push(r);
  }

  const movements = [];
  const products = [];
  const inWindow = (d) => {
    const day = String(d).slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  };

  for (const [productId2, rows] of byProduct) {
    const first = rows[0];
    // ຍອດຍົກມາ: ຈຳນວນຈາກການນັບຖອຍຫຼັງ · ຕົ້ນທຶນໃຊ້ຂອງເອກະສານທຳອິດ (ຫຼື ຕົ້ນທຶນປັດຈຸບັນ)
    const openQty = Number(first.balance_begin) || 0;
    const seedCost = Number(first.unit_cost) > 0 ? Number(first.unit_cost) : Number(first.cost_now) || 0;
    let qty = openQty;
    let value = openQty * seedCost;

    const shown = [];
    let inQty = 0, inValue = 0, outQty = 0, outValue = 0;
    // ຍອດຍົກມາ / ຍົກໄປ ຄິດຕາມ "ຊ່ວງວັນທີ" ເທົ່ານັ້ນ (ບໍ່ສົນຕົວກອງປະເພດ)
    // ຍົກມາ + ຮັບເຂົ້າ − ຈ່າຍອອກ = ຍົກໄປ ຈຶ່ງລົງຕົວສະເໝີ
    let windowOpenQty = null, windowOpenValue = null;
    let closeQty = openQty, closeValue = openQty * seedCost;

    for (const r of rows) {
      const qIn = Number(r.qty_in) || 0;
      const qOut = Number(r.qty_out) || 0;
      const avgBefore = qty > 0 ? value / qty : (Number(r.unit_cost) || 0);
      const inRange = inWindow(r.doc_at);
      const show = inRange && (!typeFilter || typeFilter.has(r.doc_type));

      if (inRange && windowOpenQty === null) {
        windowOpenQty = qty;
        windowOpenValue = value;
      }

      let valueIn = 0, valueOut = 0, unitCost = Number(r.unit_cost) || 0;
      if (qIn > 0) {
        // ຮັບເຂົ້າ: ຖ້າເອກະສານບໍ່ມີຕົ້ນທຶນ ໃຊ້ຕົ້ນທຶນສະເລ່ຍປັດຈຸບັນ
        if (unitCost <= 0) unitCost = avgBefore;
        valueIn = qIn * unitCost;
        qty += qIn;
        value += valueIn;
      }
      if (qOut > 0) {
        // ຂາຍ / ປັບປຸງ → ຕັດຕາມຕົ້ນທຶນສະເລ່ຍ
        // ສົ່ງຄືນຜູ້ສະໜອງ → ຕັດຕາມລາຄາຊື້ຈິງຂອງໃບນັ້ນ (ກັບລາຍການເດີມ)
        const isSupplierReturn = r.doc_type === 'purchase_return' && unitCost > 0;
        if (!isSupplierReturn) unitCost = avgBefore;
        valueOut = qOut * unitCost;
        qty -= qOut;
        value -= valueOut;
        if (qty <= 0) { qty = Math.max(0, qty); value = 0; }
        if (value < 0) value = 0;
      }
      const avgAfter = qty > 0 ? value / qty : 0;

      if (inRange) {
        inQty += qIn; inValue += valueIn;
        outQty += qOut; outValue += valueOut;
        closeQty = qty; closeValue = value;
      }

      if (show) {
        shown.push({
          doc_at: r.doc_at, doc_type: r.doc_type, doc_no: r.doc_no, partner: r.partner,
          product_id: r.product_id, product_code: r.product_code,
          product_name: r.product_name, unit: r.unit,
          qty_in: qIn, qty_out: qOut,
          unit_cost: unitCost,
          value_in: valueIn, value_out: valueOut,
          balance_qty: qty,
          avg_cost: avgAfter,
          balance_value: value,
        });
      }
    }

    if (shown.length === 0) continue;
    movements.push(...shown);
    const openQ = windowOpenQty ?? 0;
    const openV = windowOpenValue ?? 0;
    products.push({
      product_id: productId2,
      product_code: first.product_code,
      product_name: first.product_name,
      unit: first.unit,
      open_qty: openQ,
      open_value: openV,
      open_cost: openQ > 0 ? openV / openQ : 0,
      in_qty: inQty, in_value: inValue,
      out_qty: outQty, out_value: outValue,
      close_qty: closeQty, close_value: closeValue,
      close_cost: closeQty > 0 ? closeValue / closeQty : 0,
      cost_change: (closeQty > 0 ? closeValue / closeQty : 0) - (openQ > 0 ? openV / openQ : 0),
      movements: shown.length,
    });
  }

  const summary = products.reduce((acc, p) => ({
    products: acc.products + 1,
    in_qty: acc.in_qty + p.in_qty,
    in_value: acc.in_value + p.in_value,
    out_qty: acc.out_qty + p.out_qty,
    out_value: acc.out_value + p.out_value,
    open_value: acc.open_value + p.open_value,
    close_value: acc.close_value + p.close_value,
    movements: acc.movements + p.movements,
  }), { products: 0, in_qty: 0, in_value: 0, out_qty: 0, out_value: 0, open_value: 0, close_value: 0, movements: 0 });

  return ok({
    range: { from: from || null, to: to || null },
    doc_types: DOC_TYPES,
    summary,
    products,
    movements,
    truncated: res.rowCount >= rowLimit,
  });
});
