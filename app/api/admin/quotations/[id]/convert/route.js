export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureQuotationsSchema, ensureOrdersSchema, ensureMembersSchema, ensureCompanyProfileSchema } from '@/lib/migrations';
import { allocateBillNumber } from '@/lib/billNumber';

/**
 * Convert a quotation into a credit order (ບິນຂາຍຕິດໜີ້).
 * POST body: { credit_due_date: 'YYYY-MM-DD', note? }
 */
export const POST = handle(async (request, { params }) => {
  await ensureQuotationsSchema();
  await ensureOrdersSchema();
  await ensureMembersSchema();
  await ensureCompanyProfileSchema();

  const { id } = await params;
  const qid = Number(id);
  if (!Number.isInteger(qid) || qid <= 0) return fail(400, 'Invalid id');

  const body = await readJson(request);
  const dueDate = body.credit_due_date ? String(body.credit_due_date).slice(0, 10) : null;
  if (!dueDate) return fail(400, 'credit_due_date is required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const qres = await client.query('SELECT * FROM quotations WHERE id = $1 FOR UPDATE', [qid]);
    if (qres.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'Quotation not found');
    }
    const quotation = qres.rows[0];
    if (quotation.status === 'converted' || quotation.converted_order_id) {
      await client.query('ROLLBACK');
      return fail(400, 'Already converted to order');
    }

    const itemsRes = await client.query(
      `SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY id`,
      [qid]
    );
    const items = itemsRes.rows;
    if (items.length === 0) {
      await client.query('ROLLBACK');
      return fail(400, 'Quotation has no items');
    }

    // Validate items have product_id (only DB products can be sold; ad-hoc lines need a product)
    const missing = items.filter(it => !it.product_id);
    if (missing.length > 0) {
      await client.query('ROLLBACK');
      return fail(400, `Some items do not have product_id. Map them to products first.`);
    }

    // Check stock and get product info
    const productIds = items.map(it => Number(it.product_id));
    const prodRes = await client.query(
      `SELECT id, product_name, qty_on_hand FROM products WHERE id = ANY($1::int[]) FOR UPDATE`,
      [productIds]
    );
    const prodMap = new Map(prodRes.rows.map(p => [Number(p.id), p]));
    for (const it of items) {
      const p = prodMap.get(Number(it.product_id));
      if (!p) {
        await client.query('ROLLBACK');
        return fail(400, `Product not found: ${it.product_id}`);
      }
      if (Number(p.qty_on_hand) < Number(it.quantity)) {
        await client.query('ROLLBACK');
        return fail(400, `Insufficient stock for ${p.product_name}`);
      }
    }

    // Validate member if linked
    let member = null;
    if (quotation.member_id) {
      const m = await client.query('SELECT * FROM members WHERE id = $1', [quotation.member_id]);
      if (m.rowCount > 0) member = m.rows[0];
    }

    const total = Number(quotation.total) || 0;
    const discount = Number(quotation.discount) || 0;
    const customerName = quotation.customer_name || member?.name || '';
    if (!customerName) {
      await client.query('ROLLBACK');
      return fail(400, 'Customer name required for credit order');
    }

    // Allocate bill number
    const settingsRes = await client.query(
      `SELECT bill_number_template, bill_number_prefix, bill_number_seq_digits,
              bill_number_seq_reset, bill_number_start,
              loyalty_enabled, points_per_amount,
              tier_silver_threshold, tier_gold_threshold, tier_platinum_threshold
       FROM company_profile WHERE id = 1`
    );
    const settings = settingsRes.rows[0] || {};
    const billNumber = await allocateBillNumber(client, settings);

    const loyaltyEnabled = settings.loyalty_enabled !== false;
    const perAmount = Math.max(1, Number(settings.points_per_amount) || 10000);
    const pointsEarned = (member && loyaltyEnabled) ? Math.floor(total / perAmount) : 0;

    // Create the credit order (carry VAT fields from quotation)
    const orderRes = await client.query(
      `INSERT INTO orders (
        total, payment_method, amount_paid, change_amount, discount, note, payments,
        customer_name, customer_phone, credit_due_date, credit_status, credit_paid,
        member_id, member_points_earned, member_points_used, member_points_discount, bill_number,
        subtotal, vat_rate, vat_mode, vat_amount
      ) VALUES ($1, 'credit', 0, 0, $2, $3, NULL, $4, $5, $6, 'outstanding', 0, $7, $8, 0, 0, $9,
                $10, $11, $12, $13) RETURNING *`,
      [
        total, discount,
        body.note?.trim() || quotation.note || null,
        customerName,
        quotation.customer_phone || member?.phone || null,
        dueDate,
        member?.id || null,
        pointsEarned,
        billNumber,
        Number(quotation.subtotal) || 0,
        Number(quotation.vat_rate) || 0,
        quotation.vat_mode || null,
        Number(quotation.vat_amount) || 0,
      ]
    );
    const order = orderRes.rows[0];

    // Create order items + decrement stock
    for (const it of items) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [order.id, it.product_id, it.quantity, it.price]
      );
      await client.query(
        'UPDATE products SET qty_on_hand = qty_on_hand - $1 WHERE id = $2',
        [it.quantity, it.product_id]
      );
    }

    if (member) {
      const silverT = Number(settings.tier_silver_threshold) || 5000000;
      const goldT = Number(settings.tier_gold_threshold) || 20000000;
      const platinumT = Number(settings.tier_platinum_threshold) || 50000000;
      await client.query(
        `UPDATE members SET
           points = GREATEST(0, points + $1),
           total_spent = total_spent + $2,
           tier = CASE
             WHEN total_spent + $2 >= $4 THEN 'platinum'
             WHEN total_spent + $2 >= $5 THEN 'gold'
             WHEN total_spent + $2 >= $6 THEN 'silver'
             ELSE tier
           END,
           updated_at = NOW()
         WHERE id = $3`,
        [pointsEarned, total, member.id, platinumT, goldT, silverT]
      );
    }

    // Mark quotation as converted
    await client.query(
      `UPDATE quotations SET status = 'converted', converted_order_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [order.id, qid]
    );

    await client.query('COMMIT');
    return ok({
      message: 'Quotation converted to credit order',
      quotation_id: qid,
      order,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
