export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import {
  ensureOrdersSchema,
  ensureReturnsSchema,
  ensureCustomerDebtPaymentsSchema,
  ensureLaybysSchema,
} from '@/lib/migrations';
import { splitByMethod, splitOrderPayments } from '@/lib/paymentSplit';

const emptyRow = {
  cash_sale_cash: 0, cash_sale_transfer: 0,
  credit_sale: 0,
  refund_cash: 0, refund_transfer: 0,
  customer_down_cash: 0, customer_down_transfer: 0,
};

export const GET = handle(async (request) => {
  await ensureOrdersSchema();
  await ensureReturnsSchema();
  await ensureCustomerDebtPaymentsSchema();
  await ensureLaybysSchema();

  const { from, to, cashier, branch_id } = getQuery(request);
  const today = new Date().toISOString().slice(0, 10);
  const start = from || today;
  const end = to || today;
  const cashierFilter = cashier ? String(cashier).trim() : null;
  const branchFilter = branch_id ? Number(branch_id) || null : null;

  const rows = [];

  // 1. Sales (orders) — cash sale or credit sale
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

  // 2. Customer debt payments → contribute to "customer down" column
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
      doc_type_label: 'ຊຳລະໜີ້',
      customer_name: r.customer_name || '',
      cashier: r.created_by_username || '',
      ref_number: r.bill_number || null,
      customer_down_cash: cash,
      customer_down_transfer: transfer,
    });
  }

  // 3. Layby payments → also "customer down"
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
      customer_down_cash: cash,
      customer_down_transfer: transfer,
    });
  }

  // 4. Returns/refunds — split by refund_method
  const retRes = await pool.query(
    `SELECT r.id, r.return_number, r.created_at, r.refund_amount, r.refund_method,
            o.bill_number, o.customer_name, o.created_by_username
       FROM returns r
       LEFT JOIN orders o ON o.id = r.order_id
      WHERE DATE(r.created_at) BETWEEN $1 AND $2
        AND ($3::text IS NULL OR o.created_by_username = $3)`,
    [start, end, cashierFilter]
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
      cashier: r.created_by_username || '',
      ref_number: r.bill_number || null,
      refund_cash: cash,
      refund_transfer: transfer,
    });
  }

  // Sort by date asc (oldest first), matching the printed report layout
  rows.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Totals
  const totals = rows.reduce((acc, r) => {
    acc.cash_sale_cash         += Number(r.cash_sale_cash)         || 0;
    acc.cash_sale_transfer     += Number(r.cash_sale_transfer)     || 0;
    acc.credit_sale            += Number(r.credit_sale)            || 0;
    acc.refund_cash            += Number(r.refund_cash)            || 0;
    acc.refund_transfer        += Number(r.refund_transfer)        || 0;
    acc.customer_down_cash     += Number(r.customer_down_cash)     || 0;
    acc.customer_down_transfer += Number(r.customer_down_transfer) || 0;
    return acc;
  }, {
    cash_sale_cash: 0, cash_sale_transfer: 0,
    credit_sale: 0,
    refund_cash: 0, refund_transfer: 0,
    customer_down_cash: 0, customer_down_transfer: 0,
  });

  // Total received = cash_sale + customer_down − refund (per cash / transfer)
  totals.total_received_cash =
    totals.cash_sale_cash + totals.customer_down_cash - totals.refund_cash;
  totals.total_received_transfer =
    totals.cash_sale_transfer + totals.customer_down_transfer - totals.refund_transfer;
  totals.grand_total_received =
    totals.total_received_cash + totals.total_received_transfer;

  // Distinct cashier list across the period
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
