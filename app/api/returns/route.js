export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { fail, handle, ok, readJson } from '@/lib/api';
import { ensureReturnsSchema, ensureCompanyProfileSchema } from '@/lib/migrations';
import { allocateReturnNumber } from '@/lib/billNumber';
import { applyRounding, ROUNDING_MODES } from '@/lib/rounding';

// ຂັ້ນປັດເສດທີ່ອະນຸຍາດ — 100 = ປັດ 2 ຫຼັກ, 1,000 = 3 ຫຼັກ, 10,000 = 4 ຫຼັກ
const ALLOWED_ROUNDING_STEPS = new Set([0, 10, 50, 100, 500, 1000, 5000, 10000]);

export const GET = handle(async () => {
  await ensureReturnsSchema();
  const result = await pool.query(`
    SELECT r.*,
      o.bill_number,
      o.created_at AS order_created_at,
      o.customer_name,
      o.customer_phone,
      COALESCE(json_agg(json_build_object(
        'id', ri.id,
        'product_id', ri.product_id,
        'product_name', p.product_name,
        'quantity', ri.quantity,
        'price', ri.price,
        'amount', ri.amount
      ) ORDER BY ri.id) FILTER (WHERE ri.id IS NOT NULL), '[]') AS items
    FROM returns r
    JOIN orders o ON o.id = r.order_id
    LEFT JOIN return_items ri ON ri.return_id = r.id
    LEFT JOIN products p ON p.id = ri.product_id
    GROUP BY r.id, o.id
    ORDER BY r.created_at DESC
    LIMIT 300
  `);
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensureReturnsSchema();
  await ensureCompanyProfileSchema();
  const body = await readJson(request);
  const orderId = Number(body.order_id);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!Number.isInteger(orderId) || orderId <= 0) return fail(400, 'order_id is required');
  if (items.length === 0) return fail(400, 'items is required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderRes = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (orderRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'Order not found');
    }

    const ids = items.map(it => Number(it.order_item_id)).filter(id => Number.isInteger(id) && id > 0);
    if (ids.length === 0) {
      await client.query('ROLLBACK');
      return fail(400, 'No valid items');
    }

    const orderItemsRes = await client.query(
      `SELECT
         id AS order_item_id,
         product_id,
         quantity::float AS sold_qty,
         price::float AS price
       FROM order_items
       WHERE order_id = $1 AND id = ANY($2::int[])
       FOR UPDATE`,
      [orderId, ids]
    );
    const returnedRes = await client.query(
      `SELECT order_item_id, COALESCE(SUM(quantity), 0)::float AS returned_qty
       FROM return_items
       WHERE order_item_id = ANY($1::int[])
       GROUP BY order_item_id`,
      [ids]
    );
    const returnedById = new Map(returnedRes.rows.map(r => [Number(r.order_item_id), Number(r.returned_qty) || 0]));
    const byId = new Map(orderItemsRes.rows.map(r => [
      Number(r.order_item_id),
      { ...r, returned_qty: returnedById.get(Number(r.order_item_id)) || 0 }
    ]));

    const normalized = [];
    for (const item of items) {
      const orderItemId = Number(item.order_item_id);
      const qty = Math.max(0, Number(item.quantity) || 0);
      if (!orderItemId || qty <= 0) continue;
      const row = byId.get(orderItemId);
      if (!row) {
        await client.query('ROLLBACK');
        return fail(400, 'Invalid order item');
      }
      const returnable = Math.max(0, Number(row.sold_qty) - Number(row.returned_qty));
      if (qty > returnable) {
        await client.query('ROLLBACK');
        return fail(400, `Return quantity exceeds sold quantity for item ${orderItemId}`);
      }
      normalized.push({
        order_item_id: orderItemId,
        product_id: Number(row.product_id),
        quantity: qty,
        price: Number(row.price) || 0,
        gross: qty * (Number(row.price) || 0),
      });
    }
    if (normalized.length === 0) {
      await client.query('ROLLBACK');
      return fail(400, 'No return quantity');
    }

    // ── ຄືນເງິນຕາມທີ່ລູກຄ້າຈ່າຍຈິງ ບໍ່ແມ່ນລາຄາປ້າຍ ──────────────────────────
    // ບິນທີ່ມີສ່ວນຫຼຸດ / ໃຊ້ແຕ້ມ / VAT / ປັດເສດ ຈະຈ່າຍໜ້ອຍກວ່າມູນຄ່າສິນຄ້າ
    // ຈຶ່ງຕ້ອງປັນສ່ວນລົງແຕ່ລະລາຍການ ບໍ່ດັ່ງນັ້ນຈະຄືນເງິນເກີນ
    const grossRes = await client.query(
      `SELECT COALESCE(SUM(quantity * price), 0)::numeric AS gross FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const orderGross = Number(grossRes.rows[0]?.gross) || 0;
    const orderTotal = Number(orderRes.rows[0].total) || 0;
    const netRatio = orderGross > 0 ? orderTotal / orderGross : 1;

    for (const it of normalized) {
      it.net_price = (Number(it.price) || 0) * netRatio;
      it.amount = it.gross * netRatio;
    }
    const grossAmount = normalized.reduce((s, it) => s + it.gross, 0);
    const netAmount = Math.round(normalized.reduce((s, it) => s + it.amount, 0));
    const extraDeduction = Math.max(0, Math.min(netAmount, Math.round(Number(body.extra_deduction) || 0)));
    const afterDeduction = Math.max(0, netAmount - extraDeduction);

    // ປັດເສດຍອດຄືນເງິນ ບໍ່ໃຫ້ອອກມາເປັນຈຳນວນທີ່ຈ່າຍຍາກ
    const reqStep = Math.round(Number(body.rounding_step) || 0);
    const roundingStep = ALLOWED_ROUNDING_STEPS.has(reqStep) ? reqStep : 0;
    const roundingMode = ROUNDING_MODES.includes(String(body.rounding_mode)) ? String(body.rounding_mode) : 'none';
    const { rounded, adjustment } = applyRounding(afterDeduction, {
      rounding_mode: roundingMode, rounding_step: roundingStep,
    });
    const refundAmount = Math.max(0, Math.round(rounded));
    const roundingAdjustment = refundAmount - afterDeduction;
    const discountAmount = Math.max(0, Math.round(grossAmount) - netAmount);

    const settingsRes = await client.query(
      `SELECT return_number_template, return_number_prefix, return_number_seq_digits,
              return_number_seq_reset, return_number_start
       FROM company_profile WHERE id = 1`
    );
    const settings = settingsRes.rows[0] || {};
    const returnNumber = await allocateReturnNumber(client, settings);

    // ── ຫັກ/ຄືນແຕ້ມສະສົມຕາມສັດສ່ວນມູນຄ່າທີ່ຄືນ ────────────────────────────────
    // ຄິດແບບ "ຍອດສະສົມ" ບໍ່ແມ່ນຄິດແຍກແຕ່ລະໃບ — ຄືນຄົບ 100% ຈຶ່ງຫັກແຕ້ມຄົບພໍດີ
    // ບໍ່ເຫຼືອເສດຈາກການປັດເລກ.
    const order = orderRes.rows[0];
    const memberId = Number(order.member_id) || null;
    const earnedTotal = Math.max(0, Number(order.member_points_earned) || 0);
    const usedTotal = Math.max(0, Number(order.member_points_used) || 0);

    let pointsReverted = 0;   // ແຕ້ມທີ່ໄດ້ຮັບຕອນຂາຍ → ຫັກຄືນ
    let pointsRestored = 0;   // ແຕ້ມທີ່ລູກຄ້າໃຊ້ໄປ → ຄືນໃຫ້
    if (memberId && orderGross > 0 && (earnedTotal > 0 || usedTotal > 0)) {
      const priorRes = await client.query(
        `SELECT COALESCE(SUM(GREATEST(gross_amount, refund_amount)), 0)::float AS returned_gross,
                COALESCE(SUM(member_points_reverted), 0)::int AS reverted,
                COALESCE(SUM(member_points_restored), 0)::int AS restored
         FROM returns WHERE order_id = $1`,
        [orderId]
      );
      const prior = priorRes.rows[0] || { returned_gross: 0, reverted: 0, restored: 0 };
      // ອີງຕາມມູນຄ່າສິນຄ້າ (gross) ບໍ່ແມ່ນເງິນທີ່ຄືນ — ເງິນອາດຖືກຫັກເພີ່ມ
      const cumRatio = Math.min(1, (Number(prior.returned_gross) + grossAmount) / orderGross);
      const targetReverted = Math.min(earnedTotal, Math.round(earnedTotal * cumRatio));
      const targetRestored = Math.min(usedTotal, Math.round(usedTotal * cumRatio));
      pointsReverted = Math.max(0, targetReverted - Number(prior.reverted));
      pointsRestored = Math.max(0, targetRestored - Number(prior.restored));
    }

    const retRes = await client.query(
      `INSERT INTO returns (return_number, order_id, refund_amount, refund_method, note, created_by,
                            member_id, member_points_reverted, member_points_restored,
                            gross_amount, discount_amount, extra_deduction,
                            rounding_adjustment, rounding_step, rounding_mode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        returnNumber,
        orderId,
        refundAmount,
        String(body.refund_method || 'cash'),
        String(body.note || '').trim() || null,
        String(body.created_by || '').trim() || null,
        memberId,
        pointsReverted,
        pointsRestored,
        Math.round(grossAmount),
        discountAmount,
        extraDeduction,
        roundingAdjustment,
        roundingStep,
        roundingStep > 0 ? roundingMode : null,
      ]
    );
    const ret = retRes.rows[0];

    if (memberId && (pointsReverted !== 0 || pointsRestored !== 0 || refundAmount > 0)) {
      await client.query(
        `UPDATE members
         SET points = GREATEST(0, points + $1),
             total_spent = GREATEST(0, total_spent - $2),
             updated_at = NOW()
         WHERE id = $3`,
        [pointsRestored - pointsReverted, refundAmount, memberId]
      );
    }

    for (const item of normalized) {
      await client.query(
        `INSERT INTO return_items (return_id, order_item_id, product_id, quantity, price, net_price, amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ret.id, item.order_item_id, item.product_id, item.quantity, item.price, item.net_price, item.amount]
      );
      await client.query('UPDATE products SET qty_on_hand = qty_on_hand + $1 WHERE id = $2', [item.quantity, item.product_id]);
    }

    const itemsRes = await client.query(
      `SELECT ri.*, p.product_name
       FROM return_items ri LEFT JOIN products p ON p.id = ri.product_id
       WHERE ri.return_id = $1 ORDER BY ri.id`,
      [ret.id]
    );

    await client.query('COMMIT');
    return ok({ ...ret, items: itemsRes.rows });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
