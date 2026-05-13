export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson, getQuery } from '@/lib/api';
import { ensureCashTransactionsSchema } from '@/lib/migrations';
import { extractActor } from '@/lib/audit';
import { publishEvent } from '@/lib/appEvents';

const VALID_TYPES = new Set(['income', 'expense']);
const VALID_METHODS = new Set(['cash', 'transfer', 'qr', 'cheque']);

export const GET = handle(async (request) => {
  await ensureCashTransactionsSchema();
  const { type, currency, account, from, to, q, limit = '500' } = getQuery(request);
  const lim = Math.max(1, Math.min(2000, parseInt(limit, 10) || 500));

  const where = [];
  const params = [];

  if (type && VALID_TYPES.has(type)) {
    params.push(type);
    where.push(`txn_type = $${params.length}`);
  }
  if (currency) {
    params.push(String(currency).toUpperCase());
    where.push(`currency = $${params.length}`);
  }
  if (account) {
    params.push(account);
    where.push(`account = $${params.length}`);
  }
  if (from) {
    params.push(from);
    where.push(`txn_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`txn_date <= $${params.length}`);
  }
  if (q) {
    params.push(`%${String(q).toLowerCase()}%`);
    const i = params.length;
    where.push(`(LOWER(COALESCE(description,'')) LIKE $${i} OR LOWER(COALESCE(category,'')) LIKE $${i} OR LOWER(COALESCE(note,'')) LIKE $${i})`);
  }

  params.push(lim);
  const result = await pool.query(
    `SELECT * FROM cash_transactions
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY txn_date DESC, created_at DESC, id DESC
     LIMIT $${params.length}`,
    params
  );
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureCashTransactionsSchema();
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
    `INSERT INTO cash_transactions
       (txn_type, category, description, amount, currency, exchange_rate, amount_lak,
        account, payment_method, note, attachment, txn_date, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      txnType,
      String(body.category || '').trim() || null,
      String(body.description || '').trim() || null,
      amount,
      currency,
      rate,
      amountLak,
      account,
      method,
      String(body.note || '').trim() || null,
      body.attachment || null,
      txnDate,
      String(body.created_by || '').trim() || null,
    ]
  );
  const row = result.rows[0];
  const actor = extractActor(request);
  const isIncome = txnType === 'income';
  publishEvent({
    type: isIncome ? 'cash.income' : 'cash.expense',
    title: isIncome ? 'ມີລາຍຮັບເງິນສົດໃໝ່' : 'ມີລາຍຈ່າຍເງິນສົດໃໝ່',
    body: `${row.category || '-'} · ${Number(row.amount).toLocaleString('en-US')} ${row.currency || 'LAK'}${row.description ? ' · ' + row.description : ''}`,
    data: { cash_id: row.id, txn_type: row.txn_type, category: row.category, amount: Number(row.amount), currency: row.currency, account: row.account, method: row.payment_method },
    actor: actor.username,
  }).catch(() => {});
  return ok(row);
});
