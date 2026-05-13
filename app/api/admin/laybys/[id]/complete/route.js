export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail } from '@/lib/api';
import { ensureLaybysSchema, ensureOrdersSchema, ensureCompanyProfileSchema } from '@/lib/migrations';
import { allocateBillNumber } from '@/lib/billNumber';

// Complete a layby: create an order, mark layby completed. Stock already
// decremented at layby creation so no further stock change.
export const POST = handle(async (_request, { params }) => {
  await ensureLaybysSchema();
  await ensureOrdersSchema();
  await ensureCompanyProfileSchema();
  const { id } = await params;
  const lid = Number(id);
  if (!Number.isInteger(lid) || lid <= 0) return fail(400, 'Invalid id');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const lRes = await client.query(`SELECT * FROM laybys WHERE id = $1 FOR UPDATE`, [lid]);
    if (lRes.rowCount === 0) { await client.query('ROLLBACK'); return fail(404, 'Not found'); }
    const layby = lRes.rows[0];
    if (layby.status !== 'open') { await client.query('ROLLBACK'); return fail(400, `Layby ${layby.status}`); }
    if (Number(layby.balance) > 0) {
      await client.query('ROLLBACK');
      return fail(400, `ຍັງຄ້າງ ${layby.balance} ₭ — ກະຣຸນາຮັບຊຳລະໃຫ້ຄົບກ່ອນ`);
    }

    const itemsRes = await client.query(`SELECT * FROM layby_items WHERE layby_id = $1`, [lid]);
    const settingsRes = await client.query(
      `SELECT bill_number_template, bill_number_prefix, bill_number_seq_digits,
              bill_number_seq_reset, bill_number_start FROM company_profile WHERE id = 1`
    );
    const billNumber = await allocateBillNumber(client, settingsRes.rows[0] || {});

    // Build order
    const orderRes = await client.query(
      `INSERT INTO orders (total, payment_method, amount_paid, change_amount, discount,
                           note, customer_name, customer_phone, credit_status, credit_paid,
                           member_id, bill_number, branch_id)
       VALUES ($1, 'mixed', $2, 0, $3, $4, $5, $6, 'none', $2, $7, $8, $9) RETURNING *`,
      [
        layby.total, layby.paid, layby.discount,
        layby.note ? `Layby ${layby.layby_number} · ${layby.note}` : `Layby ${layby.layby_number}`,
        layby.customer_name, layby.customer_phone,
        layby.member_id, billNumber, layby.branch_id,
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

    await client.query('COMMIT');
    return ok({ order_id: order.id, bill_number: billNumber });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
