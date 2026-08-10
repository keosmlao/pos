// ເຂົ້າລະຫັດ CODE 128 — ໃຊ້ສ້າງ ແລະ ກວດບາໂຄດສິນຄ້າ
//
// ບໍ່ອີງ library ພາຍນອກ ຈຶ່ງໃຊ້ໄດ້ຕອນອອຟລາຍ (ໜ້າພິມປ້າຍລາຄາໃຊ້ CDN ຢູ່)
// ອ້າງອີງ: ISO/IEC 15417 — 107 ຮູບແບບ, checksum mod 103

// ຄວາມກວ້າງແຖບ/ຊ່ອງ 6 ຕົວຕໍ່ 1 ຕົວອັກສອນ (ອັນສຸດທ້າຍ = STOP ມີ 7 ຕົວ)
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
];

const START_B = 104;
const START_C = 105;
const STOP = 106;

/** ຕົວອັກສອນທີ່ CODE 128 (Code B) ຮັບໄດ້ — ASCII 32-126 */
export function isCode128Encodable(value) {
  const s = String(value ?? '');
  if (!s) return false;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) return false;
  }
  return true;
}

const isAllDigits = (s) => /^\d+$/.test(s);

/**
 * ແປງຂໍ້ຄວາມ → ລຳດັບຄ່າ CODE 128 (ລວມ start + checksum + stop)
 * ໃຊ້ Code C ເມື່ອເປັນຕົວເລກລ້ວນ ແລະ ຄວາມຍາວເປັນເລກຄູ່ (ແຖບສັ້ນກວ່າ)
 * ນອກນັ້ນໃຊ້ Code B
 */
export function code128Values(value) {
  const s = String(value ?? '');
  if (!isCode128Encodable(s)) throw new Error('ຄ່ານີ້ເຂົ້າລະຫັດ CODE 128 ບໍ່ໄດ້');

  const useC = isAllDigits(s) && s.length % 2 === 0;
  const start = useC ? START_C : START_B;
  const data = [];

  if (useC) {
    for (let i = 0; i < s.length; i += 2) data.push(Number(s.slice(i, i + 2)));
  } else {
    for (const ch of s) data.push(ch.charCodeAt(0) - 32);
  }

  // checksum = (start + Σ ຄ່າ × ຕຳແໜ່ງ) mod 103
  let sum = start;
  data.forEach((v, i) => { sum += v * (i + 1); });
  const check = sum % 103;

  return { codeSet: useC ? 'C' : 'B', values: [start, ...data, check, STOP], check };
}

/** ແປງເປັນສະຕຣິງ 0/1 ຕໍ່ 1 module (1 = ແຖບດຳ) */
export function code128Bits(value) {
  const { values } = code128Values(value);
  let bits = '';
  for (const v of values) {
    const pattern = PATTERNS[v];
    let dark = true;
    for (const w of pattern) {
      bits += (dark ? '1' : '0').repeat(Number(w));
      dark = !dark;
    }
  }
  return bits;
}

/**
 * SVG ຂອງບາໂຄດ — ຝັງໃນໜ້າຈໍ ຫຼື ພິມໄດ້ເລີຍ ບໍ່ຕ້ອງໂຫຼດ library
 * @param {string} value
 * @param {{moduleWidth?: number, height?: number, quietZone?: number, showText?: boolean, fontSize?: number}} [opts]
 */
export function code128Svg(value, opts = {}) {
  const {
    moduleWidth = 2, height = 60, quietZone = 10, showText = true, fontSize = 12,
  } = opts;
  const bits = code128Bits(value);
  const textH = showText ? fontSize + 4 : 0;
  const width = bits.length * moduleWidth + quietZone * 2;
  const totalH = height + textH;

  let rects = '';
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === '1') {
      let run = 1;
      while (i + run < bits.length && bits[i + run] === '1') run++;
      rects += `<rect x="${quietZone + i * moduleWidth}" y="0" width="${run * moduleWidth}" height="${height}" fill="#000"/>`;
      i += run;
    } else i++;
  }

  const text = showText
    ? `<text x="${width / 2}" y="${totalH - 2}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="#000">${escapeXml(value)}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}">` +
    `<rect width="${width}" height="${totalH}" fill="#fff"/>${rects}${text}</svg>`;
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[c]));
}

// ── ສ້າງເລກບາໂຄດ ─────────────────────────────────────────────────────────

export const BARCODE_PREFIX_RE = /^[0-9A-Za-z]{0,8}$/;

/**
 * ສ້າງເລກບາໂຄດໃໝ່ = ຄຳນຳໜ້າ + ຕົວເລກ ໃຫ້ຄົບຄວາມຍາວທີ່ກຳນົດ
 *
 *   mode 'random'     (ຄ່າເລີ່ມຕົ້ນ) ສຸ່ມຕົວເລກ — ເດົາລຳດັບບໍ່ໄດ້
 *   mode 'sequential' ລຽງຕໍ່ກັນ 000001, 000002, ...
 *
 * ຮັບປະກັນວ່າບໍ່ຊ້ຳກັບບາໂຄດເກົ່າ (taken) ແລະ ບໍ່ຊ້ຳກັນເອງ
 *
 * @param {{prefix?: string, totalLength?: number, count: number,
 *          taken?: Set<string>|string[], mode?: 'random'|'sequential',
 *          random?: () => number}} opts
 * @returns {{ values: string[], digits: number, capacity: number, exhausted: boolean, mode: string }}
 */
export function generateBarcodeValues({
  prefix = '', totalLength = 13, count, taken = [],
  mode = 'random', random = Math.random,
}) {
  const pre = String(prefix ?? '').trim();
  const len = Number(totalLength);
  const want = Math.max(0, Number(count) || 0);
  const useRandom = mode !== 'sequential';

  if (!BARCODE_PREFIX_RE.test(pre)) throw new Error('ຄຳນຳໜ້າໃຊ້ໄດ້ແຕ່ຕົວເລກ ຫຼື ຕົວອັກສອນອັງກິດ (ສູງສຸດ 8 ຕົວ)');
  if (!Number.isInteger(len) || len < 4 || len > 48) throw new Error('ຄວາມຍາວຕ້ອງຢູ່ລະຫວ່າງ 4 ຫາ 48 ຕົວ');

  const digits = len - pre.length;
  if (digits < 1) throw new Error('ຄຳນຳໜ້າຍາວເກີນຄວາມຍາວທັງໝົດ');

  const used = new Set(taken);   // ສຳເນົາ — ບໍ່ໄປແກ້ Set ຂອງຜູ້ເອີ້ນ
  const capacity = Math.pow(10, digits);
  const values = [];
  const make = (n) => pre + String(n).padStart(digits, '0');

  if (!useRandom) {
    let n = 1;
    while (values.length < want && n < capacity) {
      const candidate = make(n);
      if (!used.has(candidate)) { values.push(candidate); used.add(candidate); }
      n++;
    }
    return { values, digits, capacity, exhausted: values.length < want, mode: 'sequential' };
  }

  // ພື້ນທີ່ນ້ອຍ → ສ້າງລາຍການທີ່ຫວ່າງທັງໝົດແລ້ວສຸ່ມເລືອກ
  // ແນ່ນອນວ່າໄດ້ຄົບ ແລະ ບໍ່ວົນຊ້ຳຫາເລກທີ່ບໍ່ມີແລ້ວ
  if (capacity <= 100000) {
    const free = [];
    for (let n = 0; n < capacity; n++) {
      const candidate = make(n);
      if (!used.has(candidate)) free.push(candidate);
    }
    // Fisher-Yates ບາງສ່ວນ — ສຸ່ມສະເພາະຈຳນວນທີ່ຕ້ອງການ
    const take = Math.min(want, free.length);
    for (let i = 0; i < take; i++) {
      const j = i + Math.floor(random() * (free.length - i));
      [free[i], free[j]] = [free[j], free[i]];
      values.push(free[i]);
    }
    return { values, digits, capacity, exhausted: values.length < want, mode: 'random' };
  }

  // ພື້ນທີ່ໃຫຍ່ (≥ 1 ລ້ານ) → ສຸ່ມກົງໆ ແລ້ວລອງໃໝ່ຖ້າຊ້ຳ (ໂອກາດຊ້ຳຕ່ຳຫຼາຍ)
  const MAX_TRIES = 200;
  for (let i = 0; i < want; i++) {
    let placed = false;
    for (let tries = 0; tries < MAX_TRIES && !placed; tries++) {
      let suffix = '';
      for (let d = 0; d < digits; d++) suffix += Math.floor(random() * 10);
      const candidate = pre + suffix;
      if (!used.has(candidate)) { values.push(candidate); used.add(candidate); placed = true; }
    }
    if (!placed) break;   // ຫວ່າງບໍ່ພໍແທ້ — ລາຍງານ exhausted ດີກວ່າວົນຕໍ່
  }

  return { values, digits, capacity, exhausted: values.length < want, mode: 'random' };
}
