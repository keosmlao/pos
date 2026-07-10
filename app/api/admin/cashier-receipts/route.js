export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import {
  ensureOrdersSchema,
  ensureReturnsSchema,
  ensureCustomerDebtPaymentsSchema,
  ensureLaybysSchema,
  ensureCashTransactionsSchema,
} from '@/lib/migrations';

// Classify a payment_method string as 'cash' or 'transfer'.
// Anything other than literal cash is treated as non-cash (bank/QR/cheque).
function isCashMethod(method) {
  const m = String(method || '').toLowerCase();
  return m === 'cash' || m === '' || m === 'ສົດ';
}

function splitByMethod(amount, method) {
  const n = Number(amount) || 0;
  if (n === 0) return { cash: 0, transfer: 0 };
  return isCashMethod(method) ? { cash: n, transfer: 0 } : { cash: 0, transfer: n };
}

// For an order with multi-currency `payments` JSONB, split the LAK-equivalent
// totals between cash and transfer. `change_amount` (always LAK) is netted off
// the cash side.
function splitOrderPayments(order) {
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

const emptyRow = {
  cash_sale_cash: 0, cash_sale_transfer: 0,
  credit_sale: 0,
  refund_cash: 0, refund_transfer: 0,
  debt_payment_cash: 0, debt_payment_transfer: 0,
  layby_cash: 0, layby_transfer: 0,
  other: 0, other_cash: 0, other_transfer: 0,
};

export const GET = handle(async (request) => {
  await ensureOrdersSchema();
  await ensureReturnsSchema();
  await ensureCustomerDebtPaymentsSchema();
  await ensureLaybysSchema();
  await ensureCashTransactionsSchema();

  const { from, to, cashier, branch_id } = getQuery(request);
  const today = new Date().toISOString().slice(0, 10);
  const start = from || today;
  const end = to || today;
  const cashierFilter = cashier ? String(cashier).trim() : null;
  const branchFilter = branch_id ? Number(branch_id) || null : null;

  const rows = [];

  // 1. Sales (orders)
  const ordersRes = await pool.query(
    `SELECT id, bill_number, created_at, payment_method, amount_paid, change_amount, total,
            payments, customer_name, credit_status, created_by_username, branch_id
       FROM orders
      WHERE DATE(created_at) BETWEEN $1 AND $2
        AND ($3::text IS NULL OR created_by_username = $3)
        AND ($4::int IS NULL OR branch_id = $4)
      ORDER BY created_at ASC`,
    [start, end, cashierFilter, branchFilter]
  );
  for (const o of ordersRes.rows) {
    const isCredit = o.payment_method === 'credit' || o.credit_status === 'outstanding' || o.credit_status === 'partial';
    if (isCredit) {
      rows.push({
        ...emptyRow,
        date: o.created_at,
        doc_number: o.bill_number || `INV-${o.id}`,
        doc_type: 'credit_sale',
        doc_type_label: 'ບິນຂາຍຄິດໜີ້',
        customer_name: o.customer_name || '',
        cashier: o.created_by_username || '',
        credit_sale: Number(o.total) || 0,
      });
    } else {
      const { cash, transfer } = splitOrderPayments(o);
      rows.push({
        ...emptyRow,
        date: o.created_at,
        doc_number: o.bill_number || `INV-${o.id}`,
        doc_type: 'cash_sale',
        doc_type_label: 'ບິນຂາຍສົດ',
        customer_name: o.customer_name || '',
        cashier: o.created_by_username || '',
        cash_sale_cash: cash,
        cash_sale_transfer: transfer,
      });
    }
  }

  // 2. Customer debt payments
  // (customer_debt_payments has no created_by column — fall back to the
  // original order's cashier, joined via orders.)
  const cdpRes = await pool.query(
    `SELECT cdp.id, cdp.payment_number, cdp.payment_date, cdp.created_at, cdp.amount,
            cdp.payment_method, o.bill_number, o.customer_name, o.created_by_username
       FROM customer_debt_payments cdp
       LEFT JOIN orders o ON o.id = cdp.order_id
      WHERE COALESCE(cdp.payment_date, cdp.created_at::date) BETWEEN $1 AND $2
        AND ($3::text IS NULL OR o.created_by_username = $3)`,
    [start, end, cashierFilter]
  );
  for (const r of cdpRes.rows) {
    const { cash, transfer } = splitByMethod(Number(r.amount) || 0, r.payment_method);
    if (cash <= 0 && transfer <= 0) continue;
    rows.push({
      ...emptyRow,
      date: r.payment_date || r.created_at,
      doc_number: r.payment_number || `RCP-${r.id}`,
      doc_type: 'debt_payment',
      doc_type_label: 'ຮັບຊຳລະໜີ້',
      customer_name: r.customer_name || '',
      cashier: r.created_by_username || '',
      ref_number: r.bill_number || null,
      debt_payment_cash: cash,
      debt_payment_transfer: transfer,
    });
  }

  // 3. Layby payments
  const lpRes = await pool.query(
    `SELECT lp.id, lp.layby_id, lp.amount, lp.payment_method, lp.payment_date, lp.created_at,
            lp.created_by, l.layby_number, l.customer_name
       FROM layby_payments lp
       LEFT JOIN laybys l ON l.id = lp.layby_id
      WHERE COALESCE(lp.payment_date, lp.created_at::date) BETWEEN $1 AND $2
        AND ($3::text IS NULL OR lp.created_by = $3)`,
    [start, end, cashierFilter]
  );
  for (const r of lpRes.rows) {
    const { cash, transfer } = splitByMethod(Number(r.amount) || 0, r.payment_method);
    if (cash <= 0 && transfer <= 0) continue;
    rows.push({
      ...emptyRow,
      date: r.payment_date || r.created_at,
      doc_number: r.layby_number ? `${r.layby_number}-#${r.id}` : `LBY-${r.layby_id}-${r.id}`,
      doc_type: 'layby_payment',
      doc_type_label: 'ດາວ໌ນ/ຊຳລະຈອງ',
      customer_name: r.customer_name || '',
      cashier: r.created_by || '',
      layby_cash: cash,
      layby_transfer: transfer,
    });
  }

  // 4. Returns/refunds → own columns, split cash/transfer by refund_method
  const retRes = await pool.query(
    `SELECT r.id, r.return_number, r.created_at, r.refund_amount, r.refund_method,
            o.bill_number, o.customer_name
       FROM returns r
       LEFT JOIN orders o ON o.id = r.order_id
      WHERE DATE(r.created_at) BETWEEN $1 AND $2`,
    [start, end]
  );
  for (const r of retRes.rows) {
    const amt = Number(r.refund_amount) || 0;
    if (amt <= 0) continue;
    const { cash, transfer } = splitByMethod(amt, r.refund_method);
    rows.push({
      ...emptyRow,
      date: r.created_at,
      doc_number: r.return_number || `RET-${r.id}`,
      doc_type: 'refund',
      doc_type_label: 'ຮັບຄືນສິນຄ້າ',
      customer_name: r.customer_name || '',
      cashier: '',
      ref_number: r.bill_number || null,
      refund_cash: cash,
      refund_transfer: transfer,
    });
  }

  // 5. Manual cash transactions → "other"
  const ctxRes = await pool.query(
    `SELECT id, txn_type, description, amount_lak, amount, currency, payment_method,
            txn_date, created_at, created_by, category
       FROM cash_transactions
      WHERE txn_date BETWEEN $1 AND $2
        AND ($3::text IS NULL OR created_by = $3)`,
    [start, end, cashierFilter]
  );
  for (const r of ctxRes.rows) {
    const amt = Number(r.amount_lak) || Number(r.amount) || 0;
    if (amt === 0) continue;
    const signed = r.txn_type === 'expense' ? -Math.abs(amt) : Math.abs(amt);
    const isCash = isCashMethod(r.payment_method);
    rows.push({
      ...emptyRow,
      date: r.txn_date || r.created_at,
      doc_number: `TX-${r.id}`,
      doc_type: r.txn_type === 'expense' ? 'manual_expense' : 'manual_income',
      doc_type_label: r.txn_type === 'expense' ? (r.category || 'ລາຍຈ່າຍ') : (r.category || 'ລາຍຮັບ'),
      customer_name: r.description || '',
      cashier: r.created_by || '',
      other: signed,
      other_cash: isCash ? signed : 0,
      other_transfer: isCash ? 0 : signed,
    });
  }

  // Sort by date asc (oldest first), matching the report layout
  rows.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Totals
  const totals = rows.reduce((acc, r) => {
    acc.cash_sale_cash       += Number(r.cash_sale_cash)       || 0;
    acc.cash_sale_transfer   += Number(r.cash_sale_transfer)   || 0;
    acc.credit_sale          += Number(r.credit_sale)          || 0;
    acc.refund_cash          += Number(r.refund_cash)          || 0;
    acc.refund_transfer      += Number(r.refund_transfer)      || 0;
    acc.debt_payment_cash    += Number(r.debt_payment_cash)    || 0;
    acc.debt_payment_transfer += Number(r.debt_payment_transfer) || 0;
    acc.layby_cash           += Number(r.layby_cash)           || 0;
    acc.layby_transfer       += Number(r.layby_transfer)       || 0;
    acc.other                += Number(r.other)                || 0;
    acc.other_cash           += Number(r.other_cash)           || 0;
    acc.other_transfer       += Number(r.other_transfer)       || 0;
    return acc;
  }, {
    cash_sale_cash: 0, cash_sale_transfer: 0, credit_sale: 0,
    refund_cash: 0, refund_transfer: 0,
    debt_payment_cash: 0, debt_payment_transfer: 0,
    layby_cash: 0, layby_transfer: 0,
    other: 0, other_cash: 0, other_transfer: 0,
  });

  // Net money received = sales + debt payments + layby + manual income/expense − refunds, per method
  totals.total_cash_in     = totals.cash_sale_cash     + totals.debt_payment_cash     + totals.layby_cash     + totals.other_cash     - totals.refund_cash;
  totals.total_transfer_in = totals.cash_sale_transfer + totals.debt_payment_transfer + totals.layby_transfer + totals.other_transfer - totals.refund_transfer;
  totals.grand_total_received = totals.total_cash_in + totals.total_transfer_in;

  // Distinct cashier list (across all sources in the period)
  const cashierSet = new Set();
  for (const r of rows) {
    if (r.cashier) cashierSet.add(r.cashier);
  }
  const cashiers = [...cashierSet].sort();

  return ok({
    period: { from: start, to: end },
    filters: { cashier: cashierFilter, branch_id: branchFilter },
    rows,
    totals,
    cashiers,
  });
});
