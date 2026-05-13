export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureCompanyProfileSchema, ensureCustomerDebtPaymentsSchema } from '@/lib/migrations';
import { allocateDocumentNumber } from '@/lib/billNumber';
import { extractActor } from '@/lib/audit';
import { publishEvent } from '@/lib/appEvents';

export const GET = handle(async (request, { params }) => {
  await ensureCustomerDebtPaymentsSchema();
  const { order_id } = await params;
  const orderId = Number(order_id);
  if (!Number.isInteger(orderId) || orderId <= 0) return fail(400, 'Invalid order id');

  const result = await pool.query(
    `SELECT * FROM customer_debt_payments WHERE order_id = $1 ORDER BY payment_date DESC, id DESC`,
    [orderId]
  );
  return ok(result.rows);
});

export const POST = handle(async (request, { params }) => {
  await ensureCustomerDebtPaymentsSchema();
  await ensureCompanyProfileSchema();
  const { order_id } = await params;
  const orderId = Number(order_id);
  if (!Number.isInteger(orderId) || orderId <= 0) return fail(400, 'Invalid order id');

  const body = await readJson(request);
  const amount = Math.max(0, Number(body.amount) || 0);
  if (amount <= 0) return fail(400, 'amount is required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query(
      `SELECT id, total, COALESCE(credit_paid, amount_paid, 0) AS paid
       FROM orders
       WHERE id = $1 AND payment_method = 'credit'
       FOR UPDATE`,
      [orderId]
    );
    if (orderRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'Credit order not found');
    }

    const order = orderRes.rows[0];
    const remaining = Math.max(0, Number(order.total) - Number(order.paid));
    if (remaining <= 0) {
      await client.query('ROLLBACK');
      return fail(400, 'Order is already paid');
    }
    const payAmount = Math.min(amount, remaining);
    let paymentNumber = String(body.payment_number || '').trim();
    if (!paymentNumber) {
      const settingsRes = await client.query('SELECT * FROM company_profile WHERE id = 1');
      paymentNumber = await allocateDocumentNumber(client, 'customer_payment', settingsRes.rows[0] || {});
    }
    const paymentDate = body.payment_date ? String(body.payment_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const paymentMethod = String(body.payment_method || 'cash');
    const note = String(body.note || '').trim() || null;

    const payRes = await client.query(
      `INSERT INTO customer_debt_payments (order_id, payment_number, payment_date, amount, payment_method, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [orderId, paymentNumber, paymentDate, payAmount, paymentMethod, note]
    );

    const newPaid = Number(order.paid) + payAmount;
    const newStatus = newPaid >= Number(order.total) ? 'paid' : 'partial';
    await client.query(
      `UPDATE orders
       SET credit_paid = $1,
           amount_paid = $1,
           credit_status = $2,
           change_amount = 0
       WHERE id = $3`,
      [newPaid, newStatus, orderId]
    );

    await client.query('COMMIT');
    const payment = payRes.rows[0];
    const billRes = await pool.query(
      `SELECT o.bill_number, m.name AS member_name
       FROM orders o LEFT JOIN members m ON m.id = o.member_id
       WHERE o.id = $1`,
      [orderId]
    );
    const bill = billRes.rows[0] || {};
    const actor = extractActor(request);
    publishEvent({
      type: 'debt.customer_payment',
      title: 'ມີໃບຊຳລະໜີ້ລູກຄ້າໃໝ່',
      body: `${paymentNumber || '#' + payment.id} · ${bill.member_name || bill.bill_number || 'ລູກຄ້າ'} · ${Number(payAmount).toLocaleString('en-US')} ກີບ`,
      data: { payment_id: payment.id, payment_number: paymentNumber, order_id: orderId, bill_number: bill.bill_number, member_name: bill.member_name, amount: payAmount },
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
