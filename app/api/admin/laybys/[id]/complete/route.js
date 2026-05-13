export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureLaybysSchema, ensureOrdersSchema, ensureCompanyProfileSchema } from '@/lib/migrations';
import { allocateBillNumber } from '@/lib/billNumber';
import { extractActor } from '@/lib/audit';

// Complete a layby: optionally collect remaining balance via POS, then create an
// order, mark layby completed. Stock already decremented at layby creation.
export const POST = handle(async (request, { params }) => {
  await ensureLaybysSchema();
  await ensureOrdersSchema();
  await ensureCompanyProfileSchema();
  const { id } = await params;
  const lid = Number(id);
  if (!Number.isInteger(lid) || lid <= 0) return fail(400, 'Invalid id');

  // Body is optional. POS sends final payment details so we can collect the
  // remaining balance in one call. From the admin layby page, body may be empty
  // because the balance is already 0.
  let body = {};
  try { body = (await readJson(request)) || {}; } catch { body = {}; }

  const actor = extractActor(request);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lRes = await client.query(`SELECT * FROM laybys WHERE id = $1 FOR UPDATE`, [lid]);
    if (lRes.rowCount === 0) { await client.query('ROLLBACK'); return fail(404, 'Not found'); }
    let layby = lRes.rows[0];
    if (layby.status !== 'open') { await client.query('ROLLBACK'); return fail(400, `Layby ${layby.status}`); }

    const balanceBefore = Number(layby.balance) || 0;
    const finalPaymentAmount = Math.max(0, Number(body.amount_paid) || 0);
    const finalPaymentMethod = String(body.payment_method || 'cash');
    const finalPaymentsJson = Array.isArray(body.payments) ? body.payments.filter(p => Number(p.amount) > 0) : null;
    const changeAmount = Math.max(0, Number(body.change_amount) || 0);

    // If balance remains, require enough payment to cover it (LAK terms).
    if (balanceBefore > 0) {
      const lakReceived = finalPaymentsJson && finalPaymentsJson.length > 0
        ? finalPaymentsJson.reduce((s, p) => s + (Number(p.amount_lak) || Number(p.amount) * (Number(p.rate) || 1)), 0)
        : finalPaymentAmount;
      if (lakReceived + 0.5 < balanceBefore) {
        await client.query('ROLLBACK');
        return fail(400, `ຈຳນວນເງິນບໍ່ພຽງພໍ — ຍັງຄ້າງ ${balanceBefore} ₭`);
      }
      // Record the final payment(s) on the layby
      if (finalPaymentsJson && finalPaymentsJson.length > 0) {
        for (const p of finalPaymentsJson) {
          const lakAmt = Number(p.amount_lak) || Number(p.amount) * (Number(p.rate) || 1);
          if (lakAmt <= 0) continue;
          await client.query(
            `INSERT INTO layby_payments (layby_id, amount, payment_method, payment_date, note, created_by)
             VALUES ($1, $2, $3, CURRENT_DATE, $4, $5)`,
            [lid, lakAmt, p.currency ? `cash_${String(p.currency).toLowerCase()}` : finalPaymentMethod, body.note || 'POS ປິດ Layby', actor.username || null]
          );
        }
      } else {
        await client.query(
          `INSERT INTO layby_payments (layby_id, amount, payment_method, payment_date, note, created_by)
           VALUES ($1, $2, $3, CURRENT_DATE, $4, $5)`,
          [lid, balanceBefore, finalPaymentMethod, body.note || 'POS ປິດ Layby', actor.username || null]
        );
      }
      const newPaid = Number(layby.paid) + balanceBefore;
      await client.query(
        `UPDATE laybys SET paid = $1, balance = 0, updated_at = NOW() WHERE id = $2`,
        [newPaid, lid]
      );
      // Refresh in-memory copy
      layby = { ...layby, paid: newPaid, balance: 0 };
    }

    const itemsRes = await client.query(`SELECT * FROM layby_items WHERE layby_id = $1`, [lid]);
    const settingsRes = await client.query(
      `SELECT bill_number_template, bill_number_prefix, bill_number_seq_digits,
              bill_number_seq_reset, bill_number_start FROM company_profile WHERE id = 1`
    );
    const billNumber = await allocateBillNumber(client, settingsRes.rows[0] || {});

    // Choose order's payment_method label.
    // - If POS recorded a final payment, use that method (or 'mixed' for multi-currency).
    // - If balance was already 0 (admin closed), keep legacy 'mixed' label.
    let orderPaymentMethod;
    if (balanceBefore > 0) {
      orderPaymentMethod = (finalPaymentsJson && finalPaymentsJson.length > 1)
        ? 'mixed'
        : finalPaymentMethod;
    } else {
      orderPaymentMethod = 'mixed';
    }

    const orderRes = await client.query(
      `INSERT INTO orders (total, payment_method, amount_paid, change_amount, discount,
                           note, customer_name, customer_phone, credit_status, credit_paid,
                           member_id, bill_number, branch_id, payments, created_by_username)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'none', $3, $9, $10, $11, $12, $13) RETURNING *`,
      [
        layby.total, orderPaymentMethod, layby.total, changeAmount, layby.discount,
        layby.note ? `Layby ${layby.layby_number} · ${layby.note}` : `Layby ${layby.layby_number}`,
        layby.customer_name, layby.customer_phone,
        layby.member_id, billNumber, layby.branch_id,
        finalPaymentsJson && finalPaymentsJson.length > 0 ? JSON.stringify(finalPaymentsJson) : null,
        actor.username || null,
      ]
    );
    const order = orderRes.rows[0];

    for (const it of itemsRes.rows) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, quantity, price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, it.product_id, it.variant_id, it.quantity, it.price]
      );
    }

    await client.query(
      `UPDATE laybys SET status = 'completed', completed_at = NOW(), completed_order_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [order.id, lid]
    );

    // Fetch items with product info for the receipt
    const orderItemsRes = await client.query(
      `SELECT oi.*, p.product_name AS name, p.product_code AS code, p.unit, v.variant_name
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN product_variants v ON v.id = oi.variant_id
       WHERE oi.order_id = $1 ORDER BY oi.id`,
      [order.id]
    );

    await client.query('COMMIT');
    return ok({ order_id: order.id, bill_number: billNumber, order: { ...order, items: orderItemsRes.rows } });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
