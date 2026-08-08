// ກົດເກນ "ຊ່ວງເວລາ" ຂອງແຕ້ມສະສົມ — ໃຊ້ຮ່ວມກັນທັງ server (API) ແລະ client (POS)
//
// ມີ 3 ເງື່ອນໄຂ:
//   1. points_earn_start / points_earn_end  → ບິນທີ່ຂາຍນອກຊ່ວງນີ້ ບໍ່ໄດ້ແຕ້ມ
//   2. points_redeem_deadline               → ໃຊ້ແຕ້ມໄດ້ບໍ່ເກີນວັນນີ້ (ທັງລະບົບ)
//   3. members.points_expires_at            → ວັນໝົດອາຍຸແຕ້ມລາຍບຸກຄົນ (ຈາກ points_lifetime_months)
//
// ວັນທີທຸກອັນເປັນ string 'YYYY-MM-DD' ເພື່ອບໍ່ໃຫ້ timezone ມາລົບກວນ — API ຕ້ອງ
// SELECT ດ້ວຍ to_char(...) ບໍ່ແມ່ນສົ່ງ Date object ດິບໆອອກມາ.

export const LOYALTY_DATE_FIELDS = ['points_earn_start', 'points_earn_end', 'points_redeem_deadline'];

/** ປ່ຽນຄ່າໃດກໍ່ຕາມເປັນ 'YYYY-MM-DD' ຫຼື null (ວ່າງ = ບໍ່ຈຳກັດ) */
export function toDateOnly(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const p2 = n => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${p2(value.getMonth() + 1)}-${p2(value.getDate())}`;
  }
  const text = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

/** ວັນທີມື້ນີ້ຕາມເວລາເຄື່ອງ (ບໍ່ໃຊ້ toISOString ເພາະມັນເປັນ UTC ແລ້ວເລື່ອນວັນ) */
export function todayLocal(now = new Date()) {
  const p2 = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`;
}

export const fmtLaoDate = (value) => {
  const d = toDateOnly(value);
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

/**
 * ບິນທີ່ຂາຍ "ມື້ນີ້" ໄດ້ແຕ້ມບໍ?
 * @returns {{ open: boolean, reason: string }}
 */
export function earnWindowState(settings = {}, today = todayLocal()) {
  if (settings.loyalty_enabled === false) {
    return { open: false, reason: 'ລະບົບແຕ້ມສະສົມຖືກປິດຢູ່' };
  }
  const start = toDateOnly(settings.points_earn_start);
  const end = toDateOnly(settings.points_earn_end);
  if (start && today < start) {
    return { open: false, reason: `ຍັງບໍ່ເລີ່ມນັບແຕ້ມ — ເລີ່ມ ${fmtLaoDate(start)}` };
  }
  if (end && today > end) {
    return { open: false, reason: `ໝົດຊ່ວງນັບແຕ້ມແລ້ວ — ສິ້ນສຸດ ${fmtLaoDate(end)}` };
  }
  return { open: true, reason: '' };
}

/**
 * ລູກຄ້າໃຊ້ແຕ້ມໄດ້ບໍ ໃນມື້ນີ້
 * @param {object} settings          ຄ່າຈາກ company_profile
 * @param {object} member            { points, points_expires_at } — ສົ່ງ null ໄດ້ຖ້າຍັງບໍ່ເລືອກລູກຄ້າ
 * @returns {{ open: boolean, reason: string, deadline: string|null }}
 */
export function redeemWindowState(settings = {}, member = null, today = todayLocal()) {
  const globalDeadline = toDateOnly(settings.points_redeem_deadline);
  const memberExpiry = member ? toDateOnly(member.points_expires_at) : null;
  // ວັນສຸດທ້າຍທີ່ໃຊ້ໄດ້ຈິງ = ອັນທີ່ມາຮອດກ່ອນ
  const deadline = [globalDeadline, memberExpiry].filter(Boolean).sort()[0] || null;

  if (settings.loyalty_enabled === false) {
    return { open: false, reason: 'ລະບົບແຕ້ມສະສົມຖືກປິດຢູ່', deadline };
  }
  if (!(Number(settings.points_redeem_value) > 0)) {
    return { open: false, reason: 'ຍັງບໍ່ໄດ້ຕັ້ງມູນຄ່າແຕ້ມ (ໃຊ້ແຕ້ມບໍ່ໄດ້)', deadline };
  }
  if (globalDeadline && today > globalDeadline) {
    return { open: false, reason: `ໝົດກຳນົດໃຊ້ແຕ້ມແລ້ວ — ບໍ່ເກີນ ${fmtLaoDate(globalDeadline)}`, deadline };
  }
  if (memberExpiry && today > memberExpiry) {
    return { open: false, reason: `ແຕ້ມຂອງລູກຄ້າໝົດອາຍຸແລ້ວ (${fmtLaoDate(memberExpiry)})`, deadline };
  }
  return { open: true, reason: '', deadline };
}
