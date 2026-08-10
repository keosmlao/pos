// VAT calculation helpers — shared between POS, orders API, receipts, reports.

export const VAT_MODES = ['exclusive', 'inclusive', 'none'];

export function normalizeVatSettings(profile) {
  const enabled = !!profile?.vat_enabled;
  const mode = profile?.vat_mode === 'inclusive' ? 'inclusive' : 'exclusive';
  const rate = Math.max(0, Number(profile?.vat_rate) || 0);
  const label = String(profile?.vat_label || 'VAT').trim() || 'VAT';
  return { enabled: enabled && rate > 0, mode, rate, label };
}

// `net` is the amount after discount (and before VAT for exclusive mode).
// For inclusive mode, `net` already contains VAT.
// Returns { subtotalExVat, vatAmount, total } — all >= 0.
export function applyVat(net, vat) {
  const n = Math.max(0, Number(net) || 0);
  if (!vat?.enabled || !(vat.rate > 0)) {
    return { subtotalExVat: n, vatAmount: 0, total: n };
  }
  const r = vat.rate / 100;
  if (vat.mode === 'inclusive') {
    const ex = n / (1 + r);
    return {
      subtotalExVat: round2(ex),
      vatAmount: round2(n - ex),
      total: round2(n),
    };
  }
  const v = n * r;
  return {
    subtotalExVat: round2(n),
    vatAmount: round2(v),
    total: round2(n + v),
  };
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

// ── ປ້າຍກຳກັບ + ການແຍກຍອດສຳລັບສະແດງ (ໃຊ້ຮ່ວມກັນ: POS, ບິນ 80mm, A5, A4) ──────
// ເກັບໄວ້ບ່ອນດຽວ ເພື່ອໃຫ້ໜ້າຂາຍ ແລະ ບິນທີ່ພິມອອກ ສະແດງຄືກັນສະເໝີ.
export const VAT_LABELS = {
  itemsGross: 'ລວມມູນຄ່າ',
  discount: 'ສ່ວນຫຼຸດ',
  beforeVat: 'ລວມມູນຄ່າກ່ອນ ອມພ',
  grandTotal: 'ລວມທັງໝົດ',
};

/** ຕົວຢ່າງ: "ອມພ VAT 10%" */
export function vatLineLabel({ label, rate } = {}) {
  const base = String(label || 'VAT').trim() || 'VAT';
  // ບໍ່ຕື່ມ "ອມພ" ຊ້ຳ ຖ້າຜູ້ໃຊ້ຕັ້ງປ້າຍເປັນພາສາລາວຢູ່ແລ້ວ
  const prefixed = /ອມພ|ພາສີມູນຄ່າເພີ່ມ/.test(base) ? base : `ອມພ ${base}`;
  return `${prefixed} ${round2(Math.max(0, Number(rate) || 0))}%`;
}

/**
 * ແຍກຍອດຈາກແຖວ order ທີ່ບັນທຶກໄວ້ ເພື່ອສະແດງໃນບິນ.
 *   ລວມມູນຄ່າສິນຄ້າ → itemsGross   (ຜົນລວມແຖວໃນຕາລາງສິນຄ້າ)
 *   ລວມມູນຄ່າກ່ອນ ອມພ → beforeVat
 *   ອມພ (VAT)        → vatAmount   (beforeVat × ອັດຕາ)
 *   ລວມທັງໝົດ        → total       (beforeVat + vatAmount)
 * @param {object} order ແຖວ order (subtotal = ຍອດກ່ອນ ອມພ ທີ່ບັນທຶກໄວ້)
 * @param {{label?: string, itemsSum?: number}} [opts] itemsSum = ຜົນລວມຈາກຕາລາງສິນຄ້າຈິງ
 */
export function orderVatBreakdown(order, { label, itemsSum } = {}) {
  const vatAmountRaw = Math.max(0, Number(order?.vat_amount) || 0);
  const rate = Math.max(0, Number(order?.vat_rate) || 0);
  const discountRaw = Math.max(0, Number(order?.discount) || 0);
  const total = Math.max(0, Number(order?.total) || 0);
  const storedBase = Math.max(0, Number(order?.subtotal) || 0);
  const mode = order?.vat_mode === 'inclusive' ? 'inclusive' : 'exclusive';
  const hasVat = vatAmountRaw > 0 && rate > 0;
  const r = hasVat ? rate / 100 : 0;

  // ຍອດສຸດທິກ່ອນປັດເສດ (ຈາກຄ່າທີ່ບັນທຶກໄວ້) — ໃຊ້ຄິດ "ລວມມູນຄ່າ" ຄືນເມື່ອບໍ່ມີແຖວສິນຄ້າ
  const unroundedNet = storedBase > 0
    ? (mode === 'inclusive' ? storedBase + vatAmountRaw : storedBase)
    : (mode === 'inclusive' ? total : Math.max(0, total - vatAmountRaw));

  const sum = Number(itemsSum);
  const itemsGross = Number.isFinite(sum) && sum > 0
    ? round2(sum)
    : round2(unroundedNet + discountRaw);

  // ── ຄ່າສຳລັບ "ສະແດງ" ─────────────────────────────────────────────────────
  // ອີງຍອດຈິງທີ່ລູກຄ້າຈ່າຍ (total ທີ່ປັດເສດແລ້ວ) ຈຶ່ງບວກລົງຕົວສະເໝີ:
  //   ລວມມູນຄ່າ − ສ່ວນຫຼຸດ = ຍອດສຸດທິ · ກ່ອນ ອມພ + ອມພ = ລວມທັງໝົດ
  // ປັດເສດຖືກພັບເຂົ້າ "ສ່ວນຫຼຸດ" (+/-) ຕາມທີ່ຕ້ອງການສະແດງໃນໃບບິນ
  // ສ່ວນຄ່າດິບໃນ DB ຍັງແຍກຢູ່ຄືເກົ່າ → discountRaw / vatAmountRaw / rounding
  const beforeVat = round2(total / (1 + r));
  const vatAmount = round2(total - beforeVat);
  const netDisplay = mode === 'inclusive' ? total : beforeVat;
  const discount = round2(itemsGross - netDisplay);

  return {
    hasVat,
    mode,
    rate,
    itemsGross,
    discount,                                   // ສ່ວນຫຼຸດທີ່ສະແດງ (ລວມປັດເສດແລ້ວ)
    discountRaw,                                // ສ່ວນຫຼຸດຕາມທີ່ບັນທຶກໃນ DB
    rounding: round2(discount - discountRaw),   // ປັດເສດທີ່ພັບເຂົ້າສ່ວນຫຼຸດ (+/-)
    beforeVat,
    vatAmount,                                  // ອມພ ທີ່ສະແດງ = ກ່ອນ ອມພ × ອັດຕາ
    vatAmountRaw,                               // ອມພ ຕາມທີ່ບັນທຶກໃນ DB
    total,
    isVatInclusive: mode === 'inclusive',
    vatLabelText: hasVat ? vatLineLabel({ label, rate }) : '',
  };
}

/** ຂໍ້ຄວາມສ່ວນຫຼຸດໃນໃບບິນ — ຫຼຸດ = −X · ປັດເສດຂຶ້ນຈົນເກີນ = +X · ບໍ່ມີ = 0 */
export function discountSign(value) {
  const v = Number(value) || 0;
  return v > 0 ? '\u2212' : v < 0 ? '+' : '';
}
