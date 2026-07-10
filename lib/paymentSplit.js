// ແຍກຍອດເງິນ ສົດ/ໂອນ ຂອງບິນ — ໃຊ້ຮ່ວມກັນລະຫວ່າງລາຍງານຮັບເງິນແຄັດເຊຍ
// (app/api/admin/cashier-receipts) ແລະ ສະຫຼຸບປະຈຳວັນ (app/api/orders/today-receipts)
// ເພື່ອບໍ່ໃຫ້ສອງລາຍງານຄິດເລກຕ່າງກັນ

// Classify a payment_method string as 'cash' or 'transfer'.
// Anything other than literal cash is treated as non-cash (bank/QR/cheque).
export function isCashMethod(method) {
  const m = String(method || '').toLowerCase();
  return m === 'cash' || m === '' || m === 'ສົດ';
}

export function splitByMethod(amount, method) {
  const n = Number(amount) || 0;
  if (n === 0) return { cash: 0, transfer: 0 };
  return isCashMethod(method) ? { cash: n, transfer: 0 } : { cash: 0, transfer: n };
}

// For an order with multi-currency `payments` JSONB, split the LAK-equivalent
// totals between cash and transfer. `change_amount` (always LAK) is netted off
// the cash side.
export function splitOrderPayments(order) {
  const payments = Array.isArray(order.payments) ? order.payments
    : (typeof order.payments === 'string' ? (() => { try { return JSON.parse(order.payments); } catch { return []; } })() : []);
  const change = Math.max(0, Number(order.change_amount) || 0);

  if (!payments || payments.length === 0) {
    const total = Math.max(0, (Number(order.amount_paid) || Number(order.total) || 0) - change);
    // ບິນ 'mixed' ເກົ່າທີ່ບໍ່ມີລາຍລະອຽດ tender: ບໍ່ຮູ້ສັດສ່ວນ ນັບເປັນເງິນສົດ
    if (String(order.payment_method).toLowerCase() === 'mixed') return { cash: total, transfer: 0 };
    return splitByMethod(total, order.payment_method);
  }

  let cash = 0;
  let transfer = 0;
  for (const p of payments) {
    const rate = Number(p.rate) || 1;
    const amount = Number(p.amount) || 0;
    const amountLak = Number(p.amount_lak) || amount * rate;
    if (amountLak <= 0) continue;
    // ແຍກຕາມວິທີຊຳລະຂອງແຕ່ລະ tender — ສະກຸນເງິນບໍ່ກ່ຽວ (ໂອນເປັນເງິນຕ່າງປະເທດກໍຄືໂອນ)
    const method = p.method || order.payment_method;
    if (isCashMethod(method)) cash += amountLak;
    else transfer += amountLak;
  }
  if (change > 0 && cash > 0) cash = Math.max(0, cash - change);
  return { cash, transfer };
}
