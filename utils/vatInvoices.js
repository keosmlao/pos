'use client';

// ຕົວຊ່ວຍທີ່ໃຊ້ຮ່ວມກັນລະຫວ່າງ "ສົ່ງຂໍ້ມູນບິນອາກອນ" ແລະ "ລາຍງານອອກບິນອາກອນ"
// ເກັບໄວ້ບ່ອນດຽວ ເພື່ອໃຫ້ສອງໜ້າສະແດງຕົວເລກ ແລະ TIN ຄືກັນສະເໝີ

import { orderVatBreakdown } from '@/lib/vat';

// TIN ຫຼັກຂອງ "ລູກຄ້າທົ່ວໄປ" — ບິນທີ່ບໍ່ມີ TIN ຕ້ອງສົ່ງເລກນີ້ແທນ (ຂໍ້ກຳນົດ TAXRIS)
export const DEFAULT_TIN = '999999999999';

export const STATUS_PENDING = 'pending';
export const STATUS_SENT = 'sent';

export const STATUS_LABEL = {
  [STATUS_PENDING]: 'ຍັງບໍ່ໄດ້ສົ່ງ',
  [STATUS_SENT]: 'ສົ່ງແລ້ວ',
};

export const STATUS_FILTERS = [
  { key: 'all', label: 'ທັງໝົດ' },
  { key: STATUS_PENDING, label: STATUS_LABEL[STATUS_PENDING] },
  { key: STATUS_SENT, label: STATUS_LABEL[STATUS_SENT] },
];

export const QUICK_RANGES = [
  { key: 'today', label: 'ມື້ນີ້' },
  { key: '7d', label: '7 ວັນ' },
  { key: 'month', label: 'ເດືອນນີ້' },
  { key: 'last_month', label: 'ເດືອນແລ້ວ' },
  { key: 'quarter', label: 'ໄຕມາດນີ້' },
  { key: 'ytd', label: 'ປີນີ້' },
];

// ວັນທີແບບ local — ຫ້າມໃຊ້ toISOString() ເພາະມັນປ່ຽນເປັນ UTC ແລ້ວວັນເລື່ອນ 1 ວັນ (ລາວ = UTC+7)
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function getRange(key) {
  const today = new Date();
  if (key === 'today') return { from: iso(today), to: iso(today) };
  if (key === '7d') { const from = new Date(today); from.setDate(today.getDate() - 6); return { from: iso(from), to: iso(today) }; }
  if (key === 'month') { const from = new Date(today.getFullYear(), today.getMonth(), 1); return { from: iso(from), to: iso(today) }; }
  if (key === 'last_month') { const from = new Date(today.getFullYear(), today.getMonth() - 1, 1); const to = new Date(today.getFullYear(), today.getMonth(), 0); return { from: iso(from), to: iso(to) }; }
  if (key === 'quarter') { const q = Math.floor(today.getMonth() / 3); const from = new Date(today.getFullYear(), q * 3, 1); return { from: iso(from), to: iso(today) }; }
  if (key === 'ytd') { const from = new Date(today.getFullYear(), 0, 1); return { from: iso(from), to: iso(today) }; }
  return { from: iso(today), to: iso(today) };
}

/** ວັນທີແບບ DDMMYYYY (ຮູບແບບທີ່ TAXRIS ຕ້ອງການ) — ເປັນຂໍ້ຄວາມ ຈຶ່ງບໍ່ເສຍເລກ 0 ຂ້າງໜ້າ */
export function taxrisDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const p2 = n => String(n).padStart(2, '0');
  return `${p2(d.getDate())}${p2(d.getMonth() + 1)}${d.getFullYear()}`;
}

/** ເລກທີບິນແບບ TAXRIS — ຕັດຂີດອອກ (INV-202608-00007 → INV20260800007) */
export function taxrisBillNumber(row) {
  const raw = row?.bill_number || `#${row?.id ?? ''}`;
  return String(raw).replace(/[^A-Za-z0-9]/g, '');
}

/** TIN ທີ່ຈະສົ່ງອອກ — ວ່າງ/NULL ໃຫ້ໃຊ້ຄ່າຫຼັກ 999999999999 */
export function taxrisTin(row) {
  const tin = String(row?.customer_tax_id || '').trim();
  return tin || DEFAULT_TIN;
}

/**
 * ແປງແຖວດິບຈາກ API ເປັນແຖວທີ່ພ້ອມສະແດງ/ສົ່ງອອກ
 * ໃຊ້ orderVatBreakdown() ອັນດຽວກັບໃບບິນ ຈຶ່ງໝັ້ນໃຈວ່າຕົວເລກຕົງກັນ
 */
export function buildVatInvoiceLines(rows, vatLabel) {
  return (rows || []).map((row, i) => {
    const b = orderVatBreakdown(row, { label: vatLabel, itemsSum: Number(row.items_sum) || 0 });
    return {
      no: i + 1,
      row,
      b,
      id: row.id,
      date: row.created_at,
      billNumber: row.bill_number || `#${row.id}`,
      customerName: row.customer_name || 'ລູກຄ້າທົ່ວໄປ',
      tin: String(row.customer_tax_id || '').trim(),
      description: row.item_names || '',
      itemsGross: b.itemsGross,
      discount: b.discount,
      beforeVat: b.beforeVat,
      vatAmount: b.vatAmount,
      systemTotal: b.systemTotal,
      status: row.tax_submitted_at ? STATUS_SENT : STATUS_PENDING,
      submittedAt: row.tax_submitted_at || null,
    };
  });
}

export function sumVatInvoiceLines(lines) {
  return (lines || []).reduce((t, l) => ({
    itemsGross: t.itemsGross + l.itemsGross,
    discount: t.discount + l.discount,
    beforeVat: t.beforeVat + l.beforeVat,
    vatAmount: t.vatAmount + l.vatAmount,
    systemTotal: t.systemTotal + l.systemTotal,
  }), { itemsGross: 0, discount: 0, beforeVat: 0, vatAmount: 0, systemTotal: 0 });
}
