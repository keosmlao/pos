export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureLaybysSchema, ensureOrdersSchema, ensureCompanyProfileSchema } from '@/lib/migrations';
import { allocateBillNumber } from '@/lib/billNumber';
import { extractActor } from '@/lib/audit';

// Complete a layby and create an order.
// Two flows:
//   A) Item-locked layby (layby_items exist): stock was decremented at creation.
//      The order is built from layby_items at layby.total. POS may collect the
//      remaining balance via body.amount_paid/payments.
//   B) Deposit-only layby (no layby_items): POS supplies body.items. The order
//      total is the sum of POS items; the existing deposit is consumed against
//      it; POS collects (subtotal - deposit) via body.amount_paid. Stock for
//      the POS items is decremented here.
export const POST = handle(async (request, { params }) => {
  await ensureLaybysSchema();
  await ensureOrdersSchema();
  await ensureCompanyProfileSchema();
  const { id } = await params;
  const lid = Number(id);
  if (!Number.isInteger(lid) || lid <= 0) return fail(400, 'Invalid id');

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

    const layItemsRes = await client.query(`SELECT * FROM layby_items WHERE layby_id = $1`, [lid]);
    const isDepositOnly = layItemsRes.rows.length === 0;

    // Build POS-supplied items (only relevant for deposit-only flow)
    const posItems = Array.isArray(body.items) ? body.items
      .map(it => ({
        product_id: Number(it.product_id) || null,
        variant_id: Number(it.variant_id) || null,
        quantity: Math.max(0, Number(it.quantity) || 0),
        price: Math.max(0, Number(it.price) || 0),
      }))
      .filter(it => it.product_id && it.quantity > 0) : [];

    if (isDepositOnly && posItems.length === 0) {
      await client.query('ROLLBACK');
      return fail(400, 'Layby ນີ້ບໍ່ມີສິນຄ້າ — ກະຣຸນາແສກນສິນຄ້າຈາກ POS ກ່ອນປິດ');
    }

    // Compute order total and what still needs to be collected today.
    // For deposit-only: trust POS-supplied order_total (after discounts/promos/points)
    // but cap at posSubtotal to prevent inflation. Fallback to posSubtotal.
    const posSubtotal = posItems.reduce((s, it) => s + it.quantity * it.price, 0);
    const posOrderTotalReq = Number(body.order_total);
    const posOrderTotal = Number.isFinite(posOrderTotalReq) && posOrderTotalReq >= 0
      ? Math.min(posOrderTotalReq, posSubtotal)
      : posSubtotal;
    const posDiscount = Math.max(0, Math.min(posSubtotal, Number(body.discount) || 0));
    const orderTotal = isDepositOnly ? posOrderTotal : Number(layby.total) || 0;
    const orderDiscount = isDepositOnly ? posDiscount : (Number(layby.discount) || 0);
    // For deposit-only laybys, deposit can be used across multiple sales until
    // the available credit (paid - credit_used) is exhausted.
    const existingPaid = Number(layby.paid) || 0;
    const creditUsedSoFar = Number(layby.credit_used) || 0;
    const availableCredit = isDepositOnly
      ? Math.max(0, existingPaid - creditUsedSoFar)
      : existingPaid;
    const depositApplied = Math.min(availableCredit, orderTotal);
    const balanceToCollect = Math.max(0, orderTotal - depositApplied);

    const finalPaymentAmount = Math.max(0, Number(body.amount_paid) || 0);
    const finalPaymentMethod = String(body.payment_method || 'cash');
    const finalPaymentsJson = Array.isArray(body.payments) ? body.payments.filter(p => Number(p.amount) > 0) : null;
    const changeAmount = Math.max(0, Number(body.change_amount) || 0);

    // If there is a balance to collect today, validate and record it.
    if (balanceToCollect > 0) {
      const lakReceived = finalPaymentsJson && finalPaymentsJson.length > 0
        ? finalPaymentsJson.reduce((s, p) => s + (Number(p.amount_lak) || Number(p.amount) * (Number(p.rate) || 1)), 0)
        : finalPaymentAmount;
      if (lakReceived + 0.5 < balanceToCollect) {
        await client.query('ROLLBACK');
        return fail(400, `ຈຳນວນເງິນບໍ່ພຽງພໍ — ຍັງຄ້າງ ${balanceToCollect} ₭`);
      }
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
          [lid, balanceToCollect, finalPaymentMethod, body.note || 'POS ປິດ Layby', actor.username || null]
        );
      }
    }

    if (isDepositOnly) {
      // Track this use; layby stays open until all deposit is consumed.
      const newCreditUsed = creditUsedSoFar + depositApplied;
      await client.query(
        `UPDATE laybys SET credit_used = $1, updated_at = NOW() WHERE id = $2`,
        [newCreditUsed, lid]
      );
      layby = { ...layby, credit_used: newCreditUsed };
    } else {
      // Item-locked: reconcile total/paid/balance so the layby is fully paid before completion
      const newLaybyPaid = depositApplied + balanceToCollect;
      if (newLaybyPaid !== Number(layby.paid) || Number(layby.balance) !== 0 || Number(layby.total) !== orderTotal) {
        await client.query(
          `UPDATE laybys SET total = $1, paid = $2, balance = 0, updated_at = NOW() WHERE id = $3`,
          [orderTotal, newLaybyPaid, lid]
        );
        layby = { ...layby, total: orderTotal, paid: newLaybyPaid, balance: 0 };
      }
    }

    const settingsRes = await client.query(
      `SELECT bill_number_template, bill_number_prefix, bill_number_seq_digits,
              bill_number_seq_reset, bill_number_start FROM company_profile WHERE id = 1`
    );
    const billNumber = await allocateBillNumber(client, settingsRes.rows[0] || {});

    // Order's payment_method label
    const orderPaymentMethod = balanceToCollect > 0
      ? ((finalPaymentsJson && finalPaymentsJson.length > 1) ? 'mixed' : finalPaymentMethod)
      : 'mixed';

    const orderRes = await client.query(
      `INSERT INTO orders (total, payment_method, amount_paid, change_amount, discount,
                           note, customer_name, customer_phone, credit_status, credit_paid,
                           member_id, bill_number, branch_id, payments, created_by_username)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'none', $3, $9, $10, $11, $12, $13) RETURNING *`,
      [
        orderTotal, orderPaymentMethod, orderTotal, changeAmount, orderDiscount,
        layby.note ? `Layby ${layby.layby_number} · ${layby.note}` : `Layby ${layby.layby_number}`,
        layby.customer_name, layby.customer_phone,
        layby.member_id, billNumber, layby.branch_id,
        finalPaymentsJson && finalPaymentsJson.length > 0 ? JSON.stringify(finalPaymentsJson) : null,
        actor.username || null,
      ]
    );
    const order = orderRes.rows[0];

    // Insert order items (from layby for item-locked; from POS for deposit-only)
    const itemsForOrder = isDepositOnly ? posItems : layItemsRes.rows;
    for (const it of itemsForOrder) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, quantity, price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, it.product_id, it.variant_id || null, it.quantity, it.price]
      );
      // Deposit-only: decrement stock now (item-locked already decremented at creation)
      if (isDepositOnly) {
        if (it.variant_id) {
          await client.query(`UPDATE product_variants SET qty_on_hand = qty_on_hand - $1 WHERE id = $2`, [it.quantity, it.variant_id]);
        } else {
          await client.query(`UPDATE products SET qty_on_hand = qty_on_hand - $1 WHERE id = $2`, [it.quantity, it.product_id]);
        }
      }
    }

    if (isDepositOnly) {
      // Only complete when the deposit is fully consumed; otherwise stay open
      const totalCreditUsed = Number(layby.credit_used) || 0;
      const remaining = Math.max(0, Number(layby.paid) - totalCreditUsed);
      if (remaining <= 0) {
        await client.query(
          `UPDATE laybys SET status = 'completed', completed_at = NOW(), completed_order_id = $1, updated_at = NOW()
           WHERE id = $2`,
          [order.id, lid]
        );
      } else {
        await client.query(`UPDATE laybys SET updated_at = NOW() WHERE id = $1`, [lid]);
      }
    } else {
      await client.query(
        `UPDATE laybys SET status = 'completed', completed_at = NOW(), completed_order_id = $1, updated_at = NOW()
         WHERE id = $2`,
        [order.id, lid]
      );
    }

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
