export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureCashTransactionsSchema } from '@/lib/migrations';

const VALID_TYPES = new Set(['income', 'expense']);
const VALID_METHODS = new Set(['cash', 'transfer', 'qr', 'cheque']);

export const PUT = handle(async (request, { params }) => {
  await ensureCashTransactionsSchema();
  const { id } = await params;
  const txnId = Number(id);
  if (!Number.isInteger(txnId) || txnId <= 0) return fail(400, 'Invalid id');

  const body = await readJson(request);
  const txnType = String(body.txn_type || '').toLowerCase();
  if (!VALID_TYPES.has(txnType)) return fail(400, 'txn_type must be income or expense');
  const amount = Math.max(0, Number(body.amount) || 0);
  if (amount <= 0) return fail(400, 'amount must be > 0');
  const currency = String(body.currency || 'LAK').toUpperCase();
  const rate = Math.max(0, Number(body.exchange_rate) || 1) || 1;
  const amountLak = Number(body.amount_lak) || amount * rate;
  const method = VALID_METHODS.has(body.payment_method) ? body.payment_method : 'cash';
  const account = String(body.account || (method === 'cash' ? 'CASH' : '')).trim() || 'CASH';
  const txnDate = body.txn_date ? String(body.txn_date).slice(0, 10) : new Date().toISOString().slice(0, 10);

  const result = await pool.query(
    `UPDATE cash_transactions SET
       txn_type = $1, category = $2, description = $3, amount = $4, currency = $5,
       exchange_rate = $6, amount_lak = $7, account = $8, payment_method = $9,
       note = $10, attachment = $11, txn_date = $12, updated_at = NOW()
     WHERE id = $13
     RETURNING *`,
    [
      txnType,
      String(body.category || '').trim() || null,
      String(body.description || '').trim() || null,
      amount, currency, rate, amountLak, account, method,
      String(body.note || '').trim() || null,
      body.attachment || null,
      txnDate,
      txnId,
    ]
  );
  if (result.rowCount === 0) return fail(404, 'Not found');
  return ok(result.rows[0]);
});

export const DELETE = handle(async (_request, { params }) => {
  await ensureCashTransactionsSchema();
  const { id } = await params;
  const txnId = Number(id);
  if (!Number.isInteger(txnId) || txnId <= 0) return fail(400, 'Invalid id');
  const result = await pool.query('DELETE FROM cash_transactions WHERE id = $1 RETURNING *', [txnId]);
  if (result.rowCount === 0) return fail(404, 'Not found');
  return ok({ message: 'Deleted', id: txnId });
});
