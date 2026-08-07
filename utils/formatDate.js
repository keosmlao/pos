// ຮູບແບບວັນທີມາດຕະຖານຂອງລະບົບ: DD-MM-YYYY (ເຊັ່ນ 07-08-2026)
// ໃຊ້ບ່ອນທີ່ "ສະແດງ" ວັນທີເທົ່ານັ້ນ — ຄ່າທີ່ສົ່ງໃຫ້ API ແລະ input[type=date]
// ຍັງເປັນ YYYY-MM-DD ຕາມມາດຕະຖານເດີມ

const pad = (n) => String(n).padStart(2, '0');

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// 07-08-2026
export function formatDate(value, fallback = '—') {
  const date = toDate(value);
  if (!date) return fallback;
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

// 07-08-2026 14:30
export function formatDateTime(value, fallback = '—') {
  const date = toDate(value);
  if (!date) return fallback;
  return `${formatDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 14:30
export function formatTime(value, fallback = '—') {
  const date = toDate(value);
  if (!date) return fallback;
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 14:30:05 (ໂມງເດີນຢູ່ໜ້າຈໍລູກຄ້າ)
export function formatClock(value, fallback = '—') {
  const date = toDate(value);
  if (!date) return fallback;
  return `${formatTime(date)}:${pad(date.getSeconds())}`;
}

// 07-08 (ໃຊ້ໃນກຣາຟ/ຕາຕະລາງທີ່ບ່ອນແຄບ)
export function formatDayMonth(value, fallback = '—') {
  const date = toDate(value);
  if (!date) return fallback;
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}`;
}
