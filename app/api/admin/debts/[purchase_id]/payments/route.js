export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson } from '@/lib/api';
import { ensureCompanyProfileSchema } from '@/lib/migrations';
import { allocateDocumentNumber } from '@/lib/billNumber';
import { extractActor } from '@/lib/audit';
import { publishEvent } from '@/lib/appEvents';

export const GET = handle(async (_request, { params }) => {
  const { purchase_id } = await params;
  const result = await pool.query(
    'SELECT * FROM debt_payments WHERE purchase_id = $1 ORDER BY created_at DESC',
    [purchase_id]
  );
  return ok(result.rows);
});

export const POST = handle(async (request, { params }) => {
  await ensureCompanyProfileSchema();
  const { purchase_id } = await params;
  const { amount, note, payment_number, payment_date, bill_number, currency, exchange_rate, payment_method, attachment } = await readJson(request);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const amountInLAK = currency && currency !== 'LAK' && exchange_rate
      ? amount * exchange_rate
      : amount;
    let resolvedPaymentNumber = String(payment_number || '').trim() || null;
    if (!resolvedPaymentNumber) {
      const settingsRes = await client.query('SELECT * FROM company_profile WHERE id = 1');
      resolvedPaymentNumber = await allocateDocumentNumber(client, 'supplier_payment', settingsRes.rows[0] || {});
    }

    const paymentResult = await client.query(
      `INSERT INTO debt_payments (purchase_id, amount, note, payment_number, payment_date, bill_number, currency, exchange_rate, payment_method, attachment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [purchase_id, amountInLAK, note, resolvedPaymentNumber, payment_date || null, bill_number, currency || 'LAK', exchange_rate || 1, payment_method || 'cash', attachment]
    );

    await client.query(
      'UPDATE purchases SET paid = paid + $1 WHERE id = $2',
      [amountInLAK, purchase_id]
    );

    const purchase = await client.query('SELECT total, paid FROM purchases WHERE id = $1', [purchase_id]);
    if (purchase.rows.length > 0 && purchase.rows[0].paid >= purchase.rows[0].total) {
      await client.query("UPDATE purchases SET status = 'paid' WHERE id = $1", [purchase_id]);
    }

    await client.query('COMMIT');
    const payment = paymentResult.rows[0];
    const supplierRes = await pool.query(
      `SELECT s.name FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = $1`,
      [purchase_id]
    );
    const supplierName = supplierRes.rows[0]?.name || null;
    const actor = extractActor(request);
    publishEvent({
      type: 'debt.supplier_payment',
      title: 'ມີໃບຊຳລະໜີ້ຜູ້ສະໜອງໃໝ່',
      body: `${resolvedPaymentNumber || '#' + payment.id} · ${supplierName || 'ຜູ້ສະໜອງ'} · ${Number(amountInLAK).toLocaleString('en-US')} ກີບ`,
      data: { payment_id: payment.id, payment_number: resolvedPaymentNumber, purchase_id: Number(purchase_id), supplier_name: supplierName, amount: Number(amountInLAK), currency: currency || 'LAK' },
      actor: actor.username,
    }).catch(() => {});
    return ok(payment);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
