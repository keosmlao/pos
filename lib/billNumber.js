const RESET_OPTIONS = new Set(['never', 'daily', 'monthly', 'yearly']);

export const BILL_NUMBER_DEFAULTS = {
  bill_number_template: '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}',
  bill_number_prefix: 'INV',
  bill_number_seq_digits: 5,
  bill_number_seq_reset: 'monthly',
  bill_number_start: 1,
};

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

/**
 * Atomically allocate the next sequence number for a period and return the rendered bill number.
 * Must be called inside an active transaction (the `client` must already have BEGIN issued).
 */
export async function allocateBillNumber(client, settings, date = new Date()) {
  const reset = RESET_OPTIONS.has(settings.bill_number_seq_reset)
    ? settings.bill_number_seq_reset
    : BILL_NUMBER_DEFAULTS.bill_number_seq_reset;
  const prefix = settings.bill_number_prefix ?? BILL_NUMBER_DEFAULTS.bill_number_prefix;
  const template = settings.bill_number_template || BILL_NUMBER_DEFAULTS.bill_number_template;
  const digits = Math.max(1, parseInt(settings.bill_number_seq_digits, 10) || BILL_NUMBER_DEFAULTS.bill_number_seq_digits);
  const start = Math.max(1, parseInt(settings.bill_number_start, 10) || 1);

  const periodKey = getPeriodKey(reset, date);

  const upsert = await client.query(
    `INSERT INTO bill_number_sequences (period_key, current_seq, updated_at)
     VALUES ($1, GREATEST($2, 1), NOW())
     ON CONFLICT (period_key) DO UPDATE
       SET current_seq = GREATEST(bill_number_sequences.current_seq + 1, EXCLUDED.current_seq),
           updated_at = NOW()
     RETURNING current_seq`,
    [periodKey, start]
  );
  const seq = Number(upsert.rows[0].current_seq);

  const vars = buildBillVars({ prefix, seq, digits, date });
  return renderBillNumber(template, vars);
}

export function previewBillNumber(settings, seq = null) {
  const prefix = settings.bill_number_prefix ?? BILL_NUMBER_DEFAULTS.bill_number_prefix;
  const template = settings.bill_number_template || BILL_NUMBER_DEFAULTS.bill_number_template;
  const digits = Math.max(1, parseInt(settings.bill_number_seq_digits, 10) || BILL_NUMBER_DEFAULTS.bill_number_seq_digits);
  const start = Math.max(1, parseInt(settings.bill_number_start, 10) || 1);
  const vars = buildBillVars({ prefix, seq: seq ?? start, digits });
  return renderBillNumber(template, vars);
}
