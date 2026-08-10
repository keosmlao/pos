// ຕົວຊ່ວຍອ່ານບິນ pending ຈາກຜູ້ສະໜອງ (SML) — ໃຊ້ຮ່ວມກັນລະຫວ່າງ
//   ໜ້າ "ລະບົບຊື້ເຂົ້າ" (ຕາລາງລາຍລະອຽດໃນບິນ pending)
//   ໜ້າ "ສ້າງໃບຮັບເຂົ້າ"  (ແປງແຖວບິນ → ແຖວສິນຄ້າ)
// ເກັບໄວ້ບ່ອນດຽວ ຈຶ່ງລຽງລຳດັບ ແລະ ອ່ານຄ່າຄືກັນທັງສອງບ່ອນ

// ຊື່ຖັນເລກແຖວທີ່ຜູ້ສະໜອງອາດສົ່ງມາ — SML ໃຊ້ line_number
const LINE_KEYS = ['line_number', 'line_num', 'line_no', 'lineno', 'seq', 'seq_no', 'line', 'order_no', 'sort_order'];

/**
 * ເລກແຖວຂອງລາຍການ — ບໍ່ພົບຈະຄືນຄ່າສູງສຸດ ເພື່ອໃຫ້ຕົກໄປທ້າຍສຸດ
 * ໝາຍເຫດ: SML ເລີ່ມນັບແຕ່ 0 (0, 1, 2, ...) ຈຶ່ງຕ້ອງຮັບ 0 ນຳ
 * ບໍ່ໃຊ້ Number() ກັບຄ່າຫວ່າງ ເພາະ Number(null) ແລະ Number('') ໃຫ້ 0 ຄືກັນ
 */
export function invoiceLineNo(item) {
  for (const k of LINE_KEYS) {
    const raw = item?.[k];
    if (raw === null || raw === undefined || raw === '') continue;
    const v = Number(raw);
    if (Number.isFinite(v) && v >= 0) return v;
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * ລຽງລາຍການໃນບິນຕາມ line_number ຈາກນ້ອຍຫານ້ອຍ (asc) ຄືກັບຊຸດຂໍ້ມູນທີ່ຜູ້ສະໜອງສົ່ງມາ
 * ລາຍການທີ່ບໍ່ມີເລກແຖວ ຈະຮັກສາລຳດັບເດີມໄວ້ທ້າຍສຸດ
 */
export function sortInvoiceItems(items) {
  return (Array.isArray(items) ? items : [])
    .map((it, idx) => ({ it, idx, lineNo: invoiceLineNo(it) }))
    .sort((a, b) => (a.lineNo - b.lineNo) || (a.idx - b.idx))
    .map(x => x.it);
}

/** ລະຫັດສິນຄ້າຂອງແຖວບິນ */
export function invoiceItemCode(item) {
  return String(item?.item_code || '').trim();
}
