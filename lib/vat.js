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
