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
  itemsGross: 'ລວມມູນຄ່າສິນຄ້າ',
  discount: 'ສ່ວນຫຼຸດ',
  beforeVat: 'ມູນຄ່າກ່ອນ ອມພ',
  systemTotal: 'ລວມທັງໝົດ',
  rounding: 'ປັດເສດ',
  grandTotal: 'ລວມທັງໝົດ',
  grandTotalPayable: 'ລວມທັງໝົດທີ່ຊຳລະ',
  grandTotalDue: 'ລວມທັງໝົດທີ່ຕ້ອງຊຳລະ',   // ບິນຕິດໜີ້ — ຍັງບໍ່ທັນຈ່າຍ
  paymentDetail: 'ລາຍລະອຽດການຮັບເງິນ',
  change: 'ທອນ',
};

/** ຕົວຢ່າງ: "ອມພ VAT 10%" */
export function vatLineLabel({ label, rate } = {}) {
  const base = String(label || 'VAT').trim() || 'VAT';
  // ບໍ່ຕື່ມ "ອມພ" ຊ້ຳ ຖ້າຜູ້ໃຊ້ຕັ້ງປ້າຍເປັນພາສາລາວຢູ່ແລ້ວ
  const prefixed = /ອມພ|ພາສີມູນຄ່າເພີ່ມ/.test(base) ? base : `ອມພ ${base}`;
  return `${prefixed} ${round2(Math.max(0, Number(rate) || 0))}%`;
}

/**
 * ແຍກຍອດຈາກແຖວ order ທີ່ບັນທຶກໄວ້ ເພື່ອສະແດງໃນບິນ — ຕາມລຳດັບທີ່ພິມອອກ:
 *   ລວມມູນຄ່າສິນຄ້າ       → itemsGross    (ຜົນລວມແຖວໃນຕາລາງສິນຄ້າ)
 *   ສ່ວນຫຼຸດ              → discount      (ລວມທຸກປະເພດ)
 *   ມູນຄ່າກ່ອນ ອມພ        → beforeVat
 *   ອມພ (VAT)            → vatAmount
 *   ລວມທັງໝົດ            → systemTotal   (beforeVat + vatAmount · ຍັງບໍ່ປັດເສດ)
 *   ປັດເສດ               → rounding      (+/− · 0 = ບໍ່ໄດ້ປັດ)
 *   ລວມທັງໝົດທີ່ຊຳລະ      → total         (ຍອດຈິງທີ່ລູກຄ້າຈ່າຍ · ບິນຕິດໜີ້ = "ທີ່ຕ້ອງຊຳລະ")
 * @param {object} order ແຖວ order (subtotal = ຍອດກ່ອນ ອມພ ທີ່ບັນທຶກໄວ້)
 * @param {{label?: string, itemsSum?: number}} [opts] itemsSum = ຜົນລວມຈາກຕາລາງສິນຄ້າຈິງ
 */
export function orderVatBreakdown(order, { label, itemsSum } = {}) {
  const vatAmount = Math.max(0, Number(order?.vat_amount) || 0);
  const rate = Math.max(0, Number(order?.vat_rate) || 0);
  const discountRaw = Math.max(0, Number(order?.discount) || 0);
  const total = Math.max(0, Number(order?.total) || 0);
  const storedBase = Math.max(0, Number(order?.subtotal) || 0);
  const mode = order?.vat_mode === 'inclusive' ? 'inclusive' : 'exclusive';
  const hasVat = vatAmount > 0 && rate > 0;
  const isCredit = order?.payment_method === 'credit';

  // ຍອດຕາມລະບົບ = ກ່ອນ ອມພ + ອມພ (ຍັງບໍ່ທັນປັດເສດ).
  // ບິນເກົ່າ/ບິນທີ່ບໍ່ໄດ້ບັນທຶກ subtotal ໄວ້ → ຖືວ່າຍອດຈິງຄືຍອດຕາມລະບົບ (ບໍ່ມີປັດເສດ).
  const hasStoredBase = storedBase > 0 || vatAmount > 0;
  const systemTotal = hasStoredBase ? round2(storedBase + vatAmount) : total;
  const beforeVat = round2(systemTotal - vatAmount);
  const rounding = round2(total - systemTotal);

  // ຍອດສຸດທິຫຼັງຫຼຸດ ຕາມທີ່ລາຄາສິນຄ້າຖືກຕັ້ງໄວ້:
  //   ແຍກນອກ → ລາຄາຍັງບໍ່ລວມ ອມພ ຈຶ່ງທຽບກັບ beforeVat
  //   ລວມໃນ  → ລາຄາລວມ ອມພ ແລ້ວ ຈຶ່ງທຽບກັບ systemTotal
  const netDisplay = mode === 'inclusive' ? systemTotal : beforeVat;

  const sum = Number(itemsSum);
  const itemsGross = Number.isFinite(sum) && sum > 0
    ? round2(sum)
    : round2(netDisplay + discountRaw);

  // ໃຫ້ຄໍລຳບວກລົງຕົວສະເໝີ: ລວມມູນຄ່າສິນຄ້າ − ສ່ວນຫຼຸດ = ຍອດສຸດທິ
  const discount = round2(itemsGross - netDisplay);

  return {
    hasVat,
    mode,
    rate,
    itemsGross,
    discount,                                   // ສ່ວນຫຼຸດລວມທຸກປະເພດ (ຫຼຸດມື + ໂປຣໂມຊັນ + ຄູປອງ + ແຕ້ມ)
    discountRaw,                                // ສ່ວນຫຼຸດຕາມທີ່ບັນທຶກໃນ DB
    beforeVat,
    vatAmount,
    systemTotal,                                // ຍອດຕາມລະບົບ (ກ່ອນປັດເສດ)
    rounding,                                   // ປັດເສດ (+/−) · 0 = ບໍ່ໄດ້ປັດ
    hasRounding: rounding !== 0,
    total,                                      // ຍອດທີ່ຊຳລະຈິງ
    grandTotalLabel: rounding === 0
      ? VAT_LABELS.grandTotal
      : (isCredit ? VAT_LABELS.grandTotalDue : VAT_LABELS.grandTotalPayable),
    isVatInclusive: mode === 'inclusive',
    vatLabelText: hasVat ? vatLineLabel({ label, rate }) : '',
  };
}

/** ຂໍ້ຄວາມສ່ວນຫຼຸດ/ປັດເສດໃນໃບບິນ — ຫຼຸດລົງ = −X · ເພີ່ມຂຶ້ນ = +X · ບໍ່ມີ = 0 */
export function discountSign(value) {
  const v = Number(value) || 0;
  return v > 0 ? '−' : v < 0 ? '+' : '';
}

/** ປັດເສດ: ປັດຂຶ້ນ = +X · ປັດລົງ = −X (ເຄື່ອງໝາຍກົງກັນຂ້າມກັບສ່ວນຫຼຸດ) */
export function roundingSign(value) {
  const v = Number(value) || 0;
  return v > 0 ? '+' : v < 0 ? '−' : '';
}
