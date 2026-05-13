export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { ensureCashTransactionsSchema, ensureOrdersSchema, ensureReturnsSchema, ensureCustomerDebtPaymentsSchema } from '@/lib/migrations';

// Derive a default account label from payment_method when no specific account is stored
function accountFromMethod(method) {
  switch (String(method || '').toLowerCase()) {
    case 'cash': return 'CASH';
    case 'transfer': return 'BANK';
    case 'qr': return 'QR';
    case 'cheque': return 'CHEQUE';
    case 'store_credit': return 'STORE_CREDIT';
    default: return 'OTHER';
  }
}

export const GET = handle(async (request) => {
  await ensureCashTransactionsSchema();
  await ensureOrdersSchema();
  await ensureReturnsSchema();
  await ensureCustomerDebtPaymentsSchema();

  const { from, to, currency, account } = getQuery(request);
  const today = new Date().toISOString().slice(0, 10);
  const start = from || new Date(new Date().setDate(1)).toISOString().slice(0, 10);
  const end = to || today;
  const curFilter = currency ? String(currency).toUpperCase() : null;

  const transactions = [];

  // 1. Sales (orders) — non-credit; explode multi-currency payments.
  // Inflow is the bill total (= net cash kept). Change given back to the
  // customer (change_amount, always in LAK) is deducted from LAK payment lines
  // so the cash flow reflects only what stayed in the drawer.
  const ordersRes = await pool.query(
    `SELECT id, bill_number, created_at, payment_method, amount_paid, change_amount, total, payments, customer_name
     FROM orders
     WHERE payment_method <> 'credit'
       AND DATE(created_at) BETWEEN $1 AND $2
     ORDER BY created_at ASC`,
    [start, end]
  );
  for (const o of ordersRes.rows) {
    const payments = Array.isArray(o.payments) ? o.payments
      : (typeof o.payments === 'string' ? (() => { try { return JSON.parse(o.payments); } catch { return []; } })() : []);
    const change = Math.max(0, Number(o.change_amount) || 0);
    if (payments && payments.length > 0) {
      // Subtract change from LAK lines (change is always returned in LAK)
      let remainingChange = change;
      const adjusted = payments.map(p => {
        const cur = String(p.currency || 'LAK').toUpperCase();
        const rate = Number(p.rate) || 1;
        const amount = Number(p.amount) || 0;
        const amountLak = Number(p.amount_lak) || amount * rate;
        return { ...p, currency: cur, rate, amount, amount_lak: amountLak };
      });
      for (let i = adjusted.length - 1; i >= 0 && remainingChange > 0; i--) {
        if (adjusted[i].currency !== 'LAK') continue;
        const take = Math.min(remainingChange, adjusted[i].amount_lak);
        adjusted[i].amount -= take; // rate = 1 for LAK
        adjusted[i].amount_lak -= take;
        remainingChange -= take;
      }
      for (const p of adjusted) {
        if ((Number(p.amount) || 0) <= 0) continue;
        transactions.push({
          source: 'sale',
          source_id: o.id,
          source_label: o.bill_number || `#${o.id}`,
          date: o.created_at,
          txn_type: 'income',
          description: `ຂາຍ${o.customer_name ? ` · ${o.customer_name}` : ''}`,
          amount: p.amount,
          currency: p.currency,
          exchange_rate: p.rate,
          amount_lak: p.amount_lak,
          payment_method: o.payment_method,
          account: accountFromMethod(o.payment_method),
        });
      }
    } else {
      const amount = Math.max(0, (Number(o.amount_paid) || Number(o.total) || 0) - change);
      if (amount > 0) {
        transactions.push({
          source: 'sale',
          source_id: o.id,
          source_label: o.bill_number || `#${o.id}`,
          date: o.created_at,
          txn_type: 'income',
          description: `ຂາຍ${o.customer_name ? ` · ${o.customer_name}` : ''}`,
          amount, currency: 'LAK', exchange_rate: 1, amount_lak: amount,
          payment_method: o.payment_method,
          account: accountFromMethod(o.payment_method),
        });
      }
    }
  }

  // 2. Customer debt payments — inflow
  const cdpRes = await pool.query(
    `SELECT cdp.id, cdp.payment_number, cdp.payment_date, cdp.created_at, cdp.amount, cdp.payment_method,
            o.bill_number, o.customer_name
     FROM customer_debt_payments cdp
     LEFT JOIN orders o ON o.id = cdp.order_id
     WHERE COALESCE(cdp.payment_date, cdp.created_at::date) BETWEEN $1 AND $2`,
    [start, end]
  );
  for (const r of cdpRes.rows) {
    const amount = Number(r.amount) || 0;
    if (amount <= 0) continue;
    transactions.push({
      source: 'customer_debt_payment',
      source_id: r.id,
      source_label: r.payment_number || `#${r.id}`,
      ref: r.bill_number || null,
      date: r.payment_date || r.created_at,
      txn_type: 'income',
      description: `ຮັບຊຳລະຈາກລູກໜີ້${r.customer_name ? ` · ${r.customer_name}` : ''}`,
      amount, currency: 'LAK', exchange_rate: 1, amount_lak: amount,
      payment_method: r.payment_method || 'cash',
      account: accountFromMethod(r.payment_method),
    });
  }

  // 3. Supplier debt payments — outflow
  const sdpRes = await pool.query(
    `SELECT dp.id, dp.payment_number, dp.payment_date, dp.created_at, dp.amount, dp.payment_method,
            dp.currency, dp.exchange_rate, p.ref_number, s.name AS supplier_name
     FROM debt_payments dp
     LEFT JOIN purchases p ON p.id = dp.purchase_id
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE COALESCE(dp.payment_date, dp.created_at::date) BETWEEN $1 AND $2`,
    [start, end]
  );
  for (const r of sdpRes.rows) {
    const amount = Number(r.amount) || 0;
    if (amount <= 0) continue;
    const cur = String(r.currency || 'LAK').toUpperCase();
    const rate = Number(r.exchange_rate) || 1;
    transactions.push({
      source: 'supplier_debt_payment',
      source_id: r.id,
      source_label: r.payment_number || `#${r.id}`,
      ref: r.ref_number || null,
      date: r.payment_date || r.created_at,
      txn_type: 'expense',
      description: `ຊຳລະໃຫ້ເຈົ້າໜີ້${r.supplier_name ? ` · ${r.supplier_name}` : ''}`,
      amount, currency: cur, exchange_rate: rate, amount_lak: amount * rate,
      payment_method: r.payment_method || 'cash',
      account: accountFromMethod(r.payment_method),
    });
  }

  // 4. Returns — outflow (refund)
  const retRes = await pool.query(
    `SELECT r.id, r.return_number, r.created_at, r.refund_amount, r.refund_method,
            o.bill_number, o.customer_name
     FROM returns r
     LEFT JOIN orders o ON o.id = r.order_id
     WHERE DATE(r.created_at) BETWEEN $1 AND $2`,
    [start, end]
  );
  for (const r of retRes.rows) {
    const amount = Number(r.refund_amount) || 0;
    if (amount <= 0) continue;
    transactions.push({
      source: 'return',
      source_id: r.id,
      source_label: r.return_number || `#${r.id}`,
      ref: r.bill_number || null,
      date: r.created_at,
      txn_type: 'expense',
      description: `ຄືນເງິນ${r.customer_name ? ` · ${r.customer_name}` : ''}`,
      amount, currency: 'LAK', exchange_rate: 1, amount_lak: amount,
      payment_method: r.refund_method || 'cash',
      account: accountFromMethod(r.refund_method),
    });
  }

  // 5. Cash transactions (manual income/expense)
  const ctxnRes = await pool.query(
    `SELECT * FROM cash_transactions WHERE txn_date BETWEEN $1 AND $2`,
    [start, end]
  );
  for (const r of ctxnRes.rows) {
    transactions.push({
      source: 'manual',
      source_id: r.id,
      source_label: r.category || (r.txn_type === 'income' ? 'ລາຍຮັບ' : 'ລາຍຈ່າຍ'),
      date: r.txn_date || r.created_at,
      txn_type: r.txn_type,
      description: r.description || '',
      amount: Number(r.amount) || 0,
      currency: r.currency || 'LAK',
      exchange_rate: Number(r.exchange_rate) || 1,
      amount_lak: Number(r.amount_lak) || 0,
      payment_method: r.payment_method || 'cash',
      account: r.account || 'CASH',
      note: r.note,
      category: r.category,
    });
  }

  // Filter
  let filtered = transactions;
  if (curFilter) filtered = filtered.filter(t => String(t.currency).toUpperCase() === curFilter);
  if (account) filtered = filtered.filter(t => t.account === account);

  // Sort by date desc
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Aggregates
  const sumLAK = (arr) => arr.reduce((s, t) => s + (Number(t.amount_lak) || 0), 0);
  const inflows = filtered.filter(t => t.txn_type === 'income');
  const outflows = filtered.filter(t => t.txn_type === 'expense');

  const byAccountMap = new Map();
  const byCurrencyMap = new Map();
  const bySourceMap = new Map();
  for (const t of filtered) {
    // By account
    const a = byAccountMap.get(t.account) || { account: t.account, inflow: 0, outflow: 0, count: 0 };
    if (t.txn_type === 'income') a.inflow += Number(t.amount_lak) || 0;
    else a.outflow += Number(t.amount_lak) || 0;
    a.count += 1;
    byAccountMap.set(t.account, a);
    // By currency
    const c = byCurrencyMap.get(t.currency) || { currency: t.currency, inflow: 0, outflow: 0, count: 0 };
    if (t.txn_type === 'income') c.inflow += Number(t.amount) || 0;
    else c.outflow += Number(t.amount) || 0;
    c.count += 1;
    byCurrencyMap.set(t.currency, c);
    // By source
    const s = bySourceMap.get(t.source) || { source: t.source, inflow: 0, outflow: 0, count: 0 };
    if (t.txn_type === 'income') s.inflow += Number(t.amount_lak) || 0;
    else s.outflow += Number(t.amount_lak) || 0;
    s.count += 1;
    bySourceMap.set(t.source, s);
  }

  return ok({
    period: { from: start, to: end },
    filters: { currency: curFilter, account: account || null },
    totals: {
      inflow: sumLAK(inflows),
      outflow: sumLAK(outflows),
      net: sumLAK(inflows) - sumLAK(outflows),
      count: filtered.length,
    },
    by_account: [...byAccountMap.values()].sort((a, b) => (b.inflow - b.outflow) - (a.inflow - a.outflow)),
    by_currency: [...byCurrencyMap.values()].sort((a, b) => b.inflow - a.inflow),
    by_source: [...bySourceMap.values()].sort((a, b) => (b.inflow + b.outflow) - (a.inflow + a.outflow)),
    transactions: filtered,
  });
});
