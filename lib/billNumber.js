const RESET_OPTIONS = new Set(['never', 'daily', 'monthly', 'yearly']);

export const BILL_NUMBER_DEFAULTS = {
  bill_number_template: '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}',
  bill_number_prefix: 'INV',
  bill_number_seq_digits: 5,
  bill_number_seq_reset: 'monthly',
  bill_number_start: 1,
};

export const RETURN_NUMBER_DEFAULTS = {
  return_number_template: '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}',
  return_number_prefix: 'RET',
  return_number_seq_digits: 4,
  return_number_seq_reset: 'monthly',
  return_number_start: 1,
};

export const QUOTATION_NUMBER_DEFAULTS = {
  quotation_number_template: '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}',
  quotation_number_prefix: 'QT',
  quotation_number_seq_digits: 4,
  quotation_number_seq_reset: 'monthly',
  quotation_number_start: 1,
};

export const PURCHASE_NUMBER_DEFAULTS = {
  purchase_number_template: '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}',
  purchase_number_prefix: 'PO',
  purchase_number_seq_digits: 4,
  purchase_number_seq_reset: 'monthly',
  purchase_number_start: 1,
};

export const SUPPLIER_PAYMENT_NUMBER_DEFAULTS = {
  supplier_payment_number_template: '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}',
  supplier_payment_number_prefix: 'SPAY',
  supplier_payment_number_seq_digits: 4,
  supplier_payment_number_seq_reset: 'monthly',
  supplier_payment_number_start: 1,
};

export const CUSTOMER_PAYMENT_NUMBER_DEFAULTS = {
  customer_payment_number_template: '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}',
  customer_payment_number_prefix: 'CRP',
  customer_payment_number_seq_digits: 4,
  customer_payment_number_seq_reset: 'monthly',
  customer_payment_number_start: 1,
};

export const STOCK_ADJUSTMENT_NUMBER_DEFAULTS = {
  stock_adjustment_number_template: '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}',
  stock_adjustment_number_prefix: 'ADJ',
  stock_adjustment_number_seq_digits: 4,
  stock_adjustment_number_seq_reset: 'monthly',
  stock_adjustment_number_start: 1,
};

export const DOCUMENT_NUMBER_TYPES = [
  {
    key: 'bill',
    label: 'ໃບບິນຂາຍ',
    title: 'ເລກບິນຂາຍ (Invoice)',
    subtitle: 'ໃຊ້ສຳລັບບິນຂາຍສິນຄ້າຈາກ POS',
    defaults: BILL_NUMBER_DEFAULTS,
  },
  {
    key: 'return',
    label: 'ໃບຄືນເຄື່ອງ',
    title: 'ເລກບິນຮັບຄືນ (Return)',
    subtitle: 'ໃຊ້ສຳລັບເອກະສານຮັບຄືນ/ຄືນເງິນ',
    defaults: RETURN_NUMBER_DEFAULTS,
  },
  {
    key: 'quotation',
    label: 'ໃບສະເໜີລາຄາ',
    title: 'ເລກໃບສະເໜີລາຄາ (Quotation)',
    subtitle: 'ໃຊ້ສຳລັບເອກະສານສະເໜີລາຄາກ່ອນຂາຍ',
    defaults: QUOTATION_NUMBER_DEFAULTS,
  },
  {
    key: 'purchase',
    label: 'ໃບສັ່ງຊື້',
    title: 'ເລກໃບສັ່ງຊື້ / ບິນຊື້',
    subtitle: 'ໃຊ້ສຳລັບເອກະສານຊື້ສິນຄ້າຈາກຜູ້ສະໜອງ',
    defaults: PURCHASE_NUMBER_DEFAULTS,
  },
  {
    key: 'supplier_payment',
    label: 'ຊຳລະໜີ້ຜູ້ສະໜອງ',
    title: 'ເລກໃບຮັບຊຳລະໜີ້ຜູ້ສະໜອງ',
    subtitle: 'ໃຊ້ສຳລັບເອກະສານຈ່າຍຊຳລະໜີ້ບິນຊື້',
    defaults: SUPPLIER_PAYMENT_NUMBER_DEFAULTS,
  },
  {
    key: 'customer_payment',
    label: 'ຮັບຊຳລະໜີ້ລູກຄ້າ',
    title: 'ເລກໃບຮັບຊຳລະໜີ້ລູກຄ້າ',
    subtitle: 'ໃຊ້ສຳລັບເອກະສານຮັບເງິນຈາກບິນຕິດໜີ້',
    defaults: CUSTOMER_PAYMENT_NUMBER_DEFAULTS,
  },
  {
    key: 'stock_adjustment',
    label: 'ໃບຂໍປັບສະຕັອກ',
    title: 'ເລກໃບຂໍປັບປຸງສະຕັອກ',
    subtitle: 'ໃຊ້ສຳລັບເອກະສານຂໍອະນຸມັດປັບຈຳນວນສິນຄ້າ',
    defaults: STOCK_ADJUSTMENT_NUMBER_DEFAULTS,
  },
];

export const DOCUMENT_NUMBER_DEFAULTS = DOCUMENT_NUMBER_TYPES.reduce(
  (acc, type) => ({ ...acc, ...type.defaults }),
  {}
);

function pad(n, d) {
  const s = String(Math.max(0, parseInt(n, 10) || 0));
  return s.length >= d ? s : '0'.repeat(d - s.length) + s;
}

export function getPeriodKey(reset, date = new Date()) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1, 2);
  const d = pad(date.getDate(), 2);
  switch (reset) {
    case 'daily':
      return `${y}${m}${d}`;
    case 'monthly':
      return `${y}${m}`;
    case 'yearly':
      return `${y}`;
    default:
      return 'all';
  }
}

export function renderBillNumber(template, vars) {
  let out = template || BILL_NUMBER_DEFAULTS.bill_number_template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value));
  }
  return out;
}

export function buildBillVars({ prefix, seq, digits, date = new Date() }) {
  return {
    prefix: prefix ?? '',
    YYYY: date.getFullYear(),
    YY: String(date.getFullYear()).slice(-2),
    MM: pad(date.getMonth() + 1, 2),
    DD: pad(date.getDate(), 2),
    seq: pad(seq, Math.max(1, parseInt(digits, 10) || 1)),
  };
}

async function allocateNumber(client, scope, { template, prefix, digits, reset, start }, date = new Date()) {
  const usedReset = RESET_OPTIONS.has(reset) ? reset : 'monthly';
  const basePeriod = getPeriodKey(usedReset, date);
  // Keep 'bill' scope without prefix for backward compat with existing bill_number_sequences rows
  const periodKey = scope === 'bill' ? basePeriod : `${scope}:${basePeriod}`;
  const startN = Math.max(1, parseInt(start, 10) || 1);
  const digitsN = Math.max(1, parseInt(digits, 10) || 4);

  const upsert = await client.query(
    `INSERT INTO bill_number_sequences (period_key, current_seq, updated_at)
     VALUES ($1, GREATEST($2, 1), NOW())
     ON CONFLICT (period_key) DO UPDATE
       SET current_seq = GREATEST(bill_number_sequences.current_seq + 1, EXCLUDED.current_seq),
           updated_at = NOW()
     RETURNING current_seq`,
    [periodKey, startN]
  );
  const seq = Number(upsert.rows[0].current_seq);

  const vars = buildBillVars({ prefix: prefix ?? '', seq, digits: digitsN, date });
  return renderBillNumber(template, vars);
}

function getTypeDefaults(type) {
  const config = DOCUMENT_NUMBER_TYPES.find(t => t.key === type);
  return config?.defaults || BILL_NUMBER_DEFAULTS;
}

function getNumberSettings(type, settings = {}) {
  const defaults = getTypeDefaults(type);
  const base = `${type}_number`;
  return {
    template: settings[`${base}_template`] || defaults[`${base}_template`],
    prefix: settings[`${base}_prefix`] ?? defaults[`${base}_prefix`],
    digits: settings[`${base}_seq_digits`] || defaults[`${base}_seq_digits`],
    reset: settings[`${base}_seq_reset`] || defaults[`${base}_seq_reset`],
    start: settings[`${base}_start`] || defaults[`${base}_start`],
  };
}

/**
 * Atomically allocate the next sequence number for a period and return the rendered bill number.
 * Must be called inside an active transaction (the `client` must already have BEGIN issued).
 */
export async function allocateBillNumber(client, settings, date = new Date()) {
  return allocateNumber(client, 'bill', {
    template: settings.bill_number_template || BILL_NUMBER_DEFAULTS.bill_number_template,
    prefix: settings.bill_number_prefix ?? BILL_NUMBER_DEFAULTS.bill_number_prefix,
    digits: settings.bill_number_seq_digits || BILL_NUMBER_DEFAULTS.bill_number_seq_digits,
    reset: settings.bill_number_seq_reset || BILL_NUMBER_DEFAULTS.bill_number_seq_reset,
    start: settings.bill_number_start || BILL_NUMBER_DEFAULTS.bill_number_start,
  }, date);
}

export async function allocateReturnNumber(client, settings, date = new Date()) {
  return allocateNumber(client, 'return', {
    template: settings.return_number_template || RETURN_NUMBER_DEFAULTS.return_number_template,
    prefix: settings.return_number_prefix ?? RETURN_NUMBER_DEFAULTS.return_number_prefix,
    digits: settings.return_number_seq_digits || RETURN_NUMBER_DEFAULTS.return_number_seq_digits,
    reset: settings.return_number_seq_reset || RETURN_NUMBER_DEFAULTS.return_number_seq_reset,
    start: settings.return_number_start || RETURN_NUMBER_DEFAULTS.return_number_start,
  }, date);
}

export async function allocateQuotationNumber(client, settings, date = new Date()) {
  return allocateNumber(client, 'quotation', {
    template: settings.quotation_number_template || QUOTATION_NUMBER_DEFAULTS.quotation_number_template,
    prefix: settings.quotation_number_prefix ?? QUOTATION_NUMBER_DEFAULTS.quotation_number_prefix,
    digits: settings.quotation_number_seq_digits || QUOTATION_NUMBER_DEFAULTS.quotation_number_seq_digits,
    reset: settings.quotation_number_seq_reset || QUOTATION_NUMBER_DEFAULTS.quotation_number_seq_reset,
    start: settings.quotation_number_start || QUOTATION_NUMBER_DEFAULTS.quotation_number_start,
  }, date);
}

export async function allocateDocumentNumber(client, type, settings, date = new Date()) {
  return allocateNumber(client, type, getNumberSettings(type, settings), date);
}

export function previewBillNumber(settings, seq = null) {
  const prefix = settings.bill_number_prefix ?? BILL_NUMBER_DEFAULTS.bill_number_prefix;
  const template = settings.bill_number_template || BILL_NUMBER_DEFAULTS.bill_number_template;
  const digits = Math.max(1, parseInt(settings.bill_number_seq_digits, 10) || BILL_NUMBER_DEFAULTS.bill_number_seq_digits);
  const start = Math.max(1, parseInt(settings.bill_number_start, 10) || 1);
  const vars = buildBillVars({ prefix, seq: seq ?? start, digits });
  return renderBillNumber(template, vars);
}

export function previewReturnNumber(settings, seq = null) {
  const prefix = settings.return_number_prefix ?? RETURN_NUMBER_DEFAULTS.return_number_prefix;
  const template = settings.return_number_template || RETURN_NUMBER_DEFAULTS.return_number_template;
  const digits = Math.max(1, parseInt(settings.return_number_seq_digits, 10) || RETURN_NUMBER_DEFAULTS.return_number_seq_digits);
  const start = Math.max(1, parseInt(settings.return_number_start, 10) || 1);
  const vars = buildBillVars({ prefix, seq: seq ?? start, digits });
  return renderBillNumber(template, vars);
}

export function previewQuotationNumber(settings, seq = null) {
  const prefix = settings.quotation_number_prefix ?? QUOTATION_NUMBER_DEFAULTS.quotation_number_prefix;
  const template = settings.quotation_number_template || QUOTATION_NUMBER_DEFAULTS.quotation_number_template;
  const digits = Math.max(1, parseInt(settings.quotation_number_seq_digits, 10) || QUOTATION_NUMBER_DEFAULTS.quotation_number_seq_digits);
  const start = Math.max(1, parseInt(settings.quotation_number_start, 10) || 1);
  const vars = buildBillVars({ prefix, seq: seq ?? start, digits });
  return renderBillNumber(template, vars);
}

export function previewDocumentNumber(type, settings, seq = null) {
  const cfg = getNumberSettings(type, settings);
  const start = Math.max(1, parseInt(cfg.start, 10) || 1);
  const digits = Math.max(1, parseInt(cfg.digits, 10) || 1);
  const vars = buildBillVars({ prefix: cfg.prefix, seq: seq ?? start, digits });
  return renderBillNumber(cfg.template, vars);
}
