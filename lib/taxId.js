// ເລກປະຈຳຕົວຜູ້ເສຍອາກອນ (TIN) — ໃຊ້ຮ່ວມກັນ: ຟອມສະມາຊິກ ແລະ API
//
// ເກັບເປັນ "ຂໍ້ຄວາມ" (TEXT) ບໍ່ແມ່ນຕົວເລກ ເພາະ:
//   · ເລກ 0 ຂ້າງໜ້າ (ຕົວຢ່າງ 012345678901) ຕ້ອງບໍ່ຫາຍ
//   · ບໍ່ໄດ້ເອົາໄປຄິດໄລ່ ຈຶ່ງບໍ່ຕ້ອງເປັນຕົວເລກ

export const TAX_ID_LENGTH = 12;

/** ເອົາສະເພາະຕົວເລກ ແລະ ຕັດໃຫ້ຍາວສຸດ 12 ຕົວ — ໃຊ້ຕອນພິມໃນຟອມ */
export function digitsOnly(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, TAX_ID_LENGTH);
}

/**
 * ກວດ + ຈັດຮູບແບບ TIN ກ່ອນບັນທຶກ
 * @returns {{ ok: boolean, value: string|null, error?: string }}
 *          ວ່າງ = ບໍ່ໄດ້ປ້ອນ (ອະນຸຍາດ) → value = null
 */
export function normalizeTaxId(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { ok: true, value: null };
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== TAX_ID_LENGTH || digits !== raw.replace(/[\s-]/g, '')) {
    return { ok: false, value: null, error: `ເລກປະຈຳຕົວຜູ້ເສຍອາກອນ (TIN) ຕ້ອງເປັນຕົວເລກ ${TAX_ID_LENGTH} ຕົວພໍດີ` };
  }
  return { ok: true, value: digits };
}
