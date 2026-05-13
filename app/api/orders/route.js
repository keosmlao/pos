export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureMembersSchema, ensureOrdersSchema, ensureCompanyProfileSchema, ensureProductVariantsSchema, ensureBranchesSchema } from '@/lib/migrations';
import { allocateBillNumber } from '@/lib/billNumber';
import { normalizeVatSettings, applyVat } from '@/lib/vat';
import { applyRounding } from '@/lib/rounding';
import { extractActor, logAudit } from '@/lib/audit';

export const GET = handle(async () => {
  await ensureOrdersSchema();
  await ensureMembersSchema();
  const result = await pool.query(`
    SELECT o.*,
      json_agg(json_build_object(
        'id', oi.id,
        'product_id', oi.product_id,
        'quantity', oi.quantity,
        'price', oi.price,
        'product_name', p.product_name
      )) as items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.id
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT 50
  `);
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureOrdersSchema();
  await ensureMembersSchema();
  await ensureCompanyProfileSchema();
  await ensureProductVariantsSchema();
  await ensureBranchesSchema();
  const client = await pool.connect();
  try {
    let {
      total,
      payment_method,
      amount_paid,
      change_amount,
      items,
      discount,
      note,
      payments,
      customer_name,
      customer_phone,
      credit_due_date,
      member_id,
      points_used,
      applied_promo_ids,
      branch_id,
    } = await readJson(request);
    if (!Array.isArray(items) || items.length === 0) {
      return fail(400, 'items is required');
    }
    const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);
    const disc = Math.max(0, Number(discount) || 0);
    const netAfterDiscount = Math.max(0, subtotal - disc);

    await client.query('BEGIN');

    const settingsRes = await client.query(
      `SELECT loyalty_enabled, points_per_amount, points_redeem_value, min_points_to_redeem,
              tier_silver_threshold, tier_gold_threshold, tier_platinum_threshold,
              bill_number_template, bill_number_prefix, bill_number_seq_digits,
              bill_number_seq_reset, bill_number_start,
              vat_enabled, vat_rate, vat_mode, vat_label,
              rounding_mode, rounding_step,
              points_lifetime_months
       FROM company_profile WHERE id = 1`
    );
    const settings = settingsRes.rows[0] || {};
    const vat = normalizeVatSettings(settings);
    const { subtotalExVat, vatAmount, total: vatTotal } = applyVat(netAfterDiscount, vat);
    // Apply bill rounding on the VAT-inclusive total.
    const { rounded: roundedTotal } = applyRounding(vatTotal, settings);
    // When VAT/rounding is enabled, server is authoritative.
    const settingsActive = vat.enabled || (settings.rounding_mode && settings.rounding_mode !== 'none' && Number(settings.rounding_step) > 0);
    if (settingsActive) {
      total = roundedTotal;
    } else if (total == null || !isFinite(Number(total))) {
      total = roundedTotal;
    }
    const totalNum = Math.max(0, Number(total) || 0);

    let paymentsNorm = null;
    let paymentsSumLAK = 0;
    if (Array.isArray(payments) && payments.length > 0) {
      paymentsNorm = payments
        .map((p) => {
          const currency = String(p.currency || 'LAK').toUpperCase();
          const amount = Math.max(0, Number(p.amount) || 0);
          const rate = Math.max(0, Number(p.rate) || 1);
          const amount_lak = Math.max(0, Number(p.amount_lak) || amount * rate);
          return { currency, amount, rate, amount_lak };
        })
        .filter((p) => p.amount > 0);
      paymentsSumLAK = paymentsNorm.reduce((s, p) => s + p.amount_lak, 0);
    }
    const isCredit = payment_method === 'credit';
    const paidNum = isCredit ? 0 : (paymentsSumLAK > 0 ? paymentsSumLAK : Math.max(0, Number(amount_paid) || totalNum));
    const changeNum = isCredit ? 0 : (change_amount != null ? Math.max(0, Number(change_amount) || 0) : Math.max(0, paidNum - totalNum));
    const methodFinal =
      isCredit ? 'credit' :
      payment_method ||
      (paymentsNorm && paymentsNorm.length > 1
        ? 'mixed'
        : paymentsNorm?.[0]?.currency === 'LAK'
        ? 'cash'
        : 'cash');
    const customerName = String(customer_name || '').trim();
    const dueDate = credit_due_date ? String(credit_due_date).slice(0, 10) : null;
    const memberId = Number(member_id) || null;

    let member = null;
    if (memberId) {
      const memberRes = await client.query(`SELECT * FROM members WHERE id = $1 AND active IS NOT FALSE`, [memberId]);
      if (memberRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return fail(400, 'Invalid member_id');
      }
      member = memberRes.rows[0];
    }
    const finalCustomerName = customerName || member?.name || '';
    if (isCredit && !finalCustomerName) {
      await client.query('ROLLBACK');
      return fail(400, 'customer_name is required for credit order');
    }
    if (isCredit && !dueDate) {
      await client.query('ROLLBACK');
      return fail(400, 'credit_due_date is required for credit order');
    }

    // Enforce member credit limit when this is a credit order
    if (isCredit && member && Number(member.credit_limit) > 0) {
      const outstandingRes = await client.query(
        `SELECT COALESCE(SUM(GREATEST(total - COALESCE(credit_paid, 0), 0)), 0) AS outstanding
         FROM orders WHERE member_id = $1 AND credit_status IN ('outstanding', 'partial')`,
        [member.id]
      );
      const outstanding = Number(outstandingRes.rows[0].outstanding) || 0;
      const limit = Number(member.credit_limit) || 0;
      if (outstanding + totalNum > limit) {
        await client.query('ROLLBACK');
        return fail(400, `ເກີນວົງເງິນຕິດໜີ້ — ຍອດເຫຼືອ ${(limit - outstanding).toLocaleString()} ₭ (ວົງເງິນ ${limit.toLocaleString()} ₭)`);
      }
    }

    let resolvedBranchId = Number(branch_id) || null;
    if (!resolvedBranchId) {
      const defRes = await client.query(`SELECT id FROM branches WHERE is_default = TRUE LIMIT 1`);
      resolvedBranchId = defRes.rows[0]?.id || null;
    }

    const billNumber = await allocateBillNumber(client, settings);
    const loyaltyEnabled = settings.loyalty_enabled !== false;
    const perAmount = Math.max(1, Number(settings.points_per_amount) || 10000);
    const redeemValue = Math.max(0, Number(settings.points_redeem_value) || 0);
    const minRedeem = Math.max(0, Number(settings.min_points_to_redeem) || 0);
    const silverT = Number(settings.tier_silver_threshold) || 5000000;
    const goldT = Number(settings.tier_gold_threshold) || 20000000;
    const platinumT = Number(settings.tier_platinum_threshold) || 50000000;

    let pointsUsedNum = Math.max(0, parseInt(points_used, 10) || 0);
    if (pointsUsedNum > 0) {
      if (!loyaltyEnabled || redeemValue <= 0) {
        await client.query('ROLLBACK');
        return fail(400, 'Points redemption is disabled');
      }
      if (!member) {
        await client.query('ROLLBACK');
        return fail(400, 'points_used requires a member');
      }
      if (pointsUsedNum > (Number(member.points) || 0)) {
        await client.query('ROLLBACK');
        return fail(400, 'Insufficient member points');
      }
      if (pointsUsedNum < minRedeem) {
        await client.query('ROLLBACK');
        return fail(400, `Minimum points to redeem is ${minRedeem}`);
      }
    }
    const pointsDiscount = pointsUsedNum * redeemValue;
    const pointsEarned = (member && loyaltyEnabled) ? Math.floor(totalNum / perAmount) : 0;

    const orderResult = await client.query(
      `INSERT INTO orders (
        total, payment_method, amount_paid, change_amount, discount, note, payments,
        customer_name, customer_phone, credit_due_date, credit_status, credit_paid,
        member_id, member_points_earned, member_points_used, member_points_discount, bill_number,
        subtotal, vat_rate, vat_mode, vat_amount, branch_id,
        created_by_user_id, created_by_username
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                $18, $19, $20, $21, $22, $23, $24) RETURNING *`,
      [
        totalNum,
        methodFinal,
        paidNum,
        changeNum,
        disc,
        note || null,
        paymentsNorm ? JSON.stringify(paymentsNorm) : null,
        finalCustomerName || null,
        customer_phone ? String(customer_phone).trim() : (member?.phone || null),
        dueDate,
        isCredit ? 'outstanding' : 'none',
        isCredit ? 0 : paidNum,
        member?.id || null,
        pointsEarned,
        pointsUsedNum,
        pointsDiscount,
        billNumber,
        subtotalExVat,
        vat.enabled ? vat.rate : 0,
        vat.enabled ? vat.mode : null,
        vatAmount,
        resolvedBranchId,
        extractActor(request).user_id || null,
        extractActor(request).username || null,
      ]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      const variantId = item.variant_id ? Number(item.variant_id) : null;
      await client.query(
        'INSERT INTO order_items (order_id, product_id, variant_id, quantity, price) VALUES ($1, $2, $3, $4, $5)',
        [order.id, item.product_id, variantId, item.quantity, item.price]
      );
      if (variantId) {
        await client.query(
          'UPDATE product_variants SET qty_on_hand = qty_on_hand - $1 WHERE id = $2',
          [item.quantity, variantId]
        );
      } else {
        await client.query(
          'UPDATE products SET qty_on_hand = qty_on_hand - $1 WHERE id = $2',
          [item.quantity, item.product_id]
        );
      }
    }

    const promoIds = Array.isArray(applied_promo_ids)
      ? [...new Set(applied_promo_ids.map(Number).filter(Number.isFinite))]
      : [];
    if (promoIds.length > 0) {
      await client.query(
        `UPDATE promotions SET used_count = COALESCE(used_count, 0) + 1
         WHERE id = ANY($1::int[])`,
        [promoIds]
      );
    }

    if (member) {
      const pointsDelta = pointsEarned - pointsUsedNum;
      const lifetimeMonths = Math.max(0, Number(settings.points_lifetime_months) || 0);
      // First zero expired points (if any), then apply delta and refresh expiry
      // when new points are granted.
      if (lifetimeMonths > 0) {
        await client.query(
          `UPDATE members
           SET points = 0
           WHERE id = $1
             AND points_expires_at IS NOT NULL
             AND points_expires_at < CURRENT_DATE`,
          [member.id]
        );
      }
      await client.query(
        `UPDATE members
         SET points = GREATEST(0, points + $1),
             total_spent = total_spent + $2,
             tier = CASE
               WHEN total_spent + $2 >= $4 THEN 'platinum'
               WHEN total_spent + $2 >= $5 THEN 'gold'
               WHEN total_spent + $2 >= $6 THEN 'silver'
               ELSE tier
             END,
             points_expires_at = CASE
               WHEN $7 > 0 AND $1 > 0 THEN (CURRENT_DATE + ($7 || ' months')::interval)::date
               ELSE points_expires_at
             END,
             updated_at = NOW()
         WHERE id = $3`,
        [pointsDelta, totalNum, member.id, platinumT, goldT, silverT, lifetimeMonths]
      );
    }

    const itemsRes = await client.query(
      `SELECT oi.id, oi.product_id, oi.quantity, oi.price, p.product_name AS name
       FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1 ORDER BY oi.id`,
      [order.id]
    );

    await client.query('COMMIT');
    await logAudit(null, {
      actor: extractActor(request),
      action: isCredit ? 'order.create_credit' : 'order.create',
      entity_type: 'order',
      entity_id: order.id,
      summary: `${billNumber} · ${methodFinal} · ${totalNum}`,
      payload: { bill_number: billNumber, total: totalNum, items: items.length, member_id: member?.id || null },
    });
    return ok({ ...order, items: itemsRes.rows });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
