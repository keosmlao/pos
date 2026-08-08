// ຄຳນວນຕົ້ນທຶນສິນຄ້າຄືນຈາກເອກະສານຈິງ (recalculate from source documents)
//
// ເປັນຫຍັງຕ້ອງມີ:
//   ເມື່ອກ່ອນ products.cost_price ຖືກຂຽນທັບດ້ວຍ "ລາຄາຊື້ຄັ້ງລ່າສຸດ" ຕອນຮັບເຂົ້າ
//   ເທົ່ານັ້ນ — ລົບບິນຊື້ · ສົ່ງຄືນຜູ້ສະໜອງ · ລົບບິນຂາຍ ບໍ່ໄດ້ແຕະຕົ້ນທຶນເລີຍ
//   ຈຶ່ງເຫຼືອຄ່າຄ້າງທີ່ບໍ່ກົງກັບເອກະສານທີ່ຍັງເຫຼືອຢູ່
//
// ວິທີ: ໄລ່ການເຄື່ອນໄຫວທັງໝົດຂອງສິນຄ້າຕາມລຳດັບເວລາ ແລ້ວຮັກສາໄວ້ 2 ຢ່າງພ້ອມກັນ
//   1) ຖົວສະເລ່ຍເຄື່ອນທີ່ (moving average) — ຈຳນວນ + ມູນຄ່າຄົງເຫຼືອ
//   2) ຄິວ layer ແບບ FIFO — ແຕ່ລະ layer ຈື່ຈຳນວນ ແລະ ຕົ້ນທຶນຕໍ່ໜ່ວຍ
// ແລ້ວຄ່ອຍເລືອກຄຳຕອບຕາມວິທີຄິດຕົ້ນທຶນຂອງສິນຄ້ານັ້ນ (AVG / FIFO / LIFO / LAST)
//
// ຕົ້ນທຶນຕໍ່ໜ່ວຍມາຈາກໃສ:
//   ຊື້ເຂົ້າ / ສົ່ງຄືນຜູ້ສະໜອງ → ລາຄາໃນເອກະສານນັ້ນ (ຄ່າຈິງ)
//   ຮັບຄືນຈາກລູກຄ້າ           → ຕົ້ນທຶນ snapshot ຂອງບິນຂາຍເດີມ (ຄ່າຈິງ)
//   ປັບປຸງ / ນັບ / ຝາກຂາຍ      → ບໍ່ມີບັນທຶກ → ໃຊ້ຕົ້ນທຶນສະເລ່ຍ ณ ຕອນນັ້ນ
//     (ບໍ່ໃຊ້ products.cost_price ເພາະຈະວົນກັບຄ່າທີ່ກຳລັງຈະຄຳນວນ)

import { MOVEMENTS_CTE } from '@/lib/stockMovementSql';
import { DEFAULT_COSTING_METHOD, VALID_COSTING } from '@/lib/costingMethods';

// ເອກະສານທີ່ "ຮູ້ຕົ້ນທຶນຈິງ" — ນອກນັ້ນໃຊ້ຕົ້ນທຶນສະເລ່ຍປັດຈຸບັນແທນ
const KNOWN_COST_TYPES = new Set(['purchase', 'purchase_return', 'return']);

const EPS = 1e-9;

/**
 * ໄລ່ການເຄື່ອນໄຫວ ແລ້ວສົ່ງຄືນຕົ້ນທຶນທຸກວິທີ
 *
 * @param {Array}  rows      ແຖວຈາກ mv_run ຮຽງຕາມເວລາແລ້ວ
 * @param {object} opening   { qty, cost } ຍອດຍົກມາທີ່ບໍ່ມີເອກະສານ (ເຊັ່ນ ຕັ້ງ
 *                           ຈຳນວນຕອນສ້າງສິນຄ້າ ຫຼື ນຳເຂົ້າ CSV) — ຖ້າບໍ່ໃສ່
 *                           ຈະເລີ່ມຈາກສູນ ແລ້ວການຂາຍຊ່ວງຕົ້ນຈະຕິດລົບ
 */
export function walkCost(rows, opening = null) {
  const openQty = Math.max(0, Number(opening?.qty) || 0);
  const openCost = Math.max(0, Number(opening?.cost) || 0);

  let qty = openQty;                 // ຈຳນວນຄົງເຫຼືອ
  let value = openQty * openCost;    // ມູນຄ່າຄົງເຫຼືອ (ສຳລັບຖົວສະເລ່ຍ)
  let lastPurchaseCost = null;
  let firstPurchaseCost = null;
  const layers = [];                 // [{ qty, cost }] ຮຽງເກົ່າ → ໃໝ່
  if (openQty > EPS && openCost > EPS) layers.push({ qty: openQty, cost: openCost });

  for (const r of rows) {
    const qIn = Number(r.qty_in) || 0;
    const qOut = Number(r.qty_out) || 0;
    const avgBefore = qty > EPS ? value / qty : 0;
    const stated = Number(r.unit_cost) || 0;
    const known = KNOWN_COST_TYPES.has(r.doc_type) && stated > 0;
    const unitCost = known ? stated : avgBefore;

    if (qIn > EPS) {
      qty += qIn;
      value += qIn * unitCost;
      layers.push({ qty: qIn, cost: unitCost });
      if (r.doc_type === 'purchase') {
        lastPurchaseCost = stated > 0 ? stated : unitCost;
        if (firstPurchaseCost === null) firstPurchaseCost = lastPurchaseCost;
      }
    }

    if (qOut > EPS) {
      // ຂາຍ / ປັບປຸງ → ຕັດອອກຕາມຕົ້ນທຶນສະເລ່ຍ ณ ຕອນນັ້ນ
      // ສົ່ງຄືນຜູ້ສະໜອງ → ຕັດອອກຕາມລາຄາຊື້ຈິງຂອງໃບນັ້ນ (ກັບລາຍການເດີມ)
      //   ບໍ່ດັ່ງນັ້ນສົ່ງຄືນຂອງແພງແລ້ວ ຂອງຖືກທີ່ຍັງເຫຼືອຈະຖືກຕີມູນຄ່າສູງເກີນຈິງ
      const isSupplierReturn = r.doc_type === 'purchase_return' && stated > 0;
      const outCost = isSupplierReturn ? stated : avgBefore;

      qty -= qOut;
      value -= qOut * outCost;
      if (qty <= EPS) { qty = Math.max(0, qty); value = 0; }
      if (value < 0) value = 0;

      // FIFO: ສົ່ງຄືນຜູ້ສະໜອງກິນ layer ທີ່ລາຄາກົງກັນກ່ອນ (ໃໝ່ → ເກົ່າ)
      // ນອກນັ້ນກິນຈາກ layer ເກົ່າສຸດຕາມຫຼັກ FIFO
      let remain = qOut;
      if (isSupplierReturn) {
        for (let i = layers.length - 1; i >= 0 && remain > EPS; i--) {
          if (Math.abs(layers[i].cost - stated) > 0.005) continue;
          const take = Math.min(layers[i].qty, remain);
          layers[i].qty -= take;
          remain -= take;
          if (layers[i].qty <= EPS) layers.splice(i, 1);
        }
      }
      while (remain > EPS && layers.length > 0) {
        const layer = layers[0];
        const take = Math.min(layer.qty, remain);
        layer.qty -= take;
        remain -= take;
        if (layer.qty <= EPS) layers.shift();
      }
    }
  }

  const liveLayers = layers.filter(l => l.qty > EPS);
  return {
    qty,
    value,
    avg: qty > EPS ? value / qty : null,
    fifo: liveLayers.length > 0 ? liveLayers[0].cost : null,
    lifo: liveLayers.length > 0 ? liveLayers[liveLayers.length - 1].cost : null,
    last: lastPurchaseCost,
    first: firstPurchaseCost,
  };
}

/** ວິທີຄິດຕົ້ນທຶນທີ່ຮ້ານຕັ້ງເປັນຄ່າເລີ່ມຕົ້ນ */
async function companyDefaultMethod(client) {
  try {
    const r = await client.query('SELECT default_costing_method FROM company_profile WHERE id = 1');
    const m = String(r.rows[0]?.default_costing_method || '').toUpperCase();
    return VALID_COSTING.has(m) ? m : DEFAULT_COSTING_METHOD;
  } catch {
    return DEFAULT_COSTING_METHOD;
  }
}

/** ເລືອກຄ່າຕາມວິທີ ພ້ອມ fallback ເປັນຂັ້ນ */
export function pickCost(method, walked) {
  const order = {
    AVG: ['avg', 'last', 'fifo', 'lifo'],
    FIFO: ['fifo', 'avg', 'last'],
    LIFO: ['lifo', 'last', 'avg'],
    LAST: ['last', 'avg', 'fifo'],
  }[method] || ['avg', 'last', 'fifo'];

  for (const key of order) {
    const v = walked[key];
    if (v != null && Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

/**
 * ຄຳນວນຕົ້ນທຶນຄືນ ແລ້ວບັນທຶກລົງ products.cost_price
 *
 * ບໍ່ຂຽນທັບເມື່ອຄຳນວນບໍ່ໄດ້ (ບໍ່ມີເອກະສານເລີຍ) — ຮັກສາຄ່າທີ່ຕັ້ງດ້ວຍມືໄວ້
 *
 * @param {object} client  pg client ທີ່ຢູ່ໃນ transaction ດຽວກັນກັບຜູ້ເອີ້ນ
 * @param {number} productId
 * @returns {Promise<{product_id:number, method:string, before:number, after:number|null, changed:boolean}|null>}
 */
export async function recalcProductCost(client, productId) {
  const pid = Number(productId);
  if (!Number.isInteger(pid) || pid <= 0) return null;

  const prodRes = await client.query(
    'SELECT id, cost_price, costing_method, COALESCE(qty_on_hand, 0)::float AS qty_on_hand FROM products WHERE id = $1',
    [pid]);
  const product = prodRes.rows[0];
  if (!product) return null;

  const own = String(product.costing_method || '').toUpperCase();
  const method = VALID_COSTING.has(own) ? own : await companyDefaultMethod(client);

  const mvRes = await client.query(
    `WITH ${MOVEMENTS_CTE}
     SELECT doc_type, qty_in::float, qty_out::float, unit_cost::float
     FROM mv_run
     ORDER BY doc_at, doc_type, ref_id`,
    [pid, null]
  );

  // ຍອດຍົກມາທີ່ບໍ່ມີເອກະສານ = ສະຕັອກປັດຈຸບັນ − ຜົນລວມສຸດທິຂອງທຸກເອກະສານ
  // (ວິທີນັບຖອຍຫຼັງອັນດຽວກັບໜ້າ "ການເຄື່ອນໄຫວສິນຄ້າ" ຈຶ່ງໃຫ້ຄ່າກົງກັນ)
  const totalNet = mvRes.rows.reduce(
    (s, r) => s + (Number(r.qty_in) || 0) - (Number(r.qty_out) || 0), 0);
  const openQty = (Number(product.qty_on_hand) || 0) - totalNet;
  // ຕົ້ນທຶນຍອດຍົກມາບໍ່ມີບ່ອນອ້າງອີງ → ໃຊ້ຕົ້ນທຶນທີ່ບັນທຶກໄວ້ຢູ່ແລ້ວ
  const walked = walkCost(mvRes.rows, { qty: openQty, cost: Number(product.cost_price) || 0 });
  const after = pickCost(method, walked);
  const before = Number(product.cost_price) || 0;

  // ບໍ່ມີເອກະສານໃຫ້ອີງ → ຢ່າລົບຄ່າທີ່ຄົນຕັ້ງໄວ້
  if (after == null) {
    return { product_id: pid, method, before, after: null, changed: false };
  }

  const rounded = Math.round(after * 100) / 100;
  if (Math.abs(rounded - before) < 0.005) {
    return { product_id: pid, method, before, after: rounded, changed: false };
  }

  await client.query('UPDATE products SET cost_price = $1 WHERE id = $2', [rounded, pid]);
  return { product_id: pid, method, before, after: rounded, changed: true };
}

/** ຄຳນວນຄືນຫຼາຍສິນຄ້າ (ຕັດຄ່າຊ້ຳ ແລະ ຄ່າບໍ່ຖືກຕ້ອງອອກ) */
export async function recalcProductCosts(client, productIds) {
  const unique = [...new Set((productIds || []).map(Number).filter(n => Number.isInteger(n) && n > 0))];
  const results = [];
  for (const pid of unique) {
    const r = await recalcProductCost(client, pid);
    if (r) results.push(r);
  }
  return results;
}
