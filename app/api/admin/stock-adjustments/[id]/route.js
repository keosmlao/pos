export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureStockAdjustmentsSchema } from '@/lib/migrations';
import { extractActor } from '@/lib/audit';
import { recalcProductCosts } from '@/lib/productCost';

export const PUT = handle(async (request, { params }) => {
  await ensureStockAdjustmentsSchema();
  const { id } = await params;
  const adjustmentId = Number(id);
  if (!Number.isInteger(adjustmentId) || adjustmentId <= 0) return fail(400, 'Invalid id');

  const body = await readJson(request);
  const action = String(body.action || '').trim();
  if (!['approve', 'reject'].includes(action)) return fail(400, 'Invalid action');

  const actor = extractActor(request);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const adjRes = await client.query(
      `SELECT * FROM stock_adjustments WHERE id = $1 FOR UPDATE`,
      [adjustmentId]
    );
    if (adjRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'Not found');
    }
    const adj = adjRes.rows[0];
    const docNumber = adj.adjustment_number || null;
    const docRes = docNumber
      ? await client.query(`SELECT * FROM stock_adjustments WHERE adjustment_number = $1 FOR UPDATE`, [docNumber])
      : adjRes;
    const rows = docRes.rows;
    if (rows.some((row) => row.status !== 'pending')) {
      await client.query('ROLLBACK');
      return fail(400, 'Document is not pending');
    }

    if (action === 'reject') {
      const result = await client.query(
        `UPDATE stock_adjustments
         SET status = 'rejected', rejected_by = $1, rejected_at = NOW(), rejection_note = $2
         WHERE ${docNumber ? 'adjustment_number = $3' : 'id = $3'}
         RETURNING *`,
        [actor.username || null, String(body.rejection_note || '').trim() || null, docNumber || adjustmentId]
      );
      await client.query('COMMIT');
      return ok({ adjustment_number: docNumber, count: result.rowCount, items: result.rows });
    }

    for (const row of rows) {
      if (row.variant_id) {
        await client.query(
          `UPDATE product_variants SET qty_on_hand = $1, updated_at = NOW()
           WHERE id = $2 AND product_id = $3`,
          [row.qty_after, row.variant_id, row.product_id]
        );
      } else {
        await client.query(
          `UPDATE products SET qty_on_hand = $1 WHERE id = $2`,
          [row.qty_after, row.product_id]
        );
      }
    }

    const result = await client.query(
      `UPDATE stock_adjustments
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE ${docNumber ? 'adjustment_number = $2' : 'id = $2'}
       RETURNING *`,
      [actor.username || null, docNumber || adjustmentId]
    );
    // ປັບປຸງສະຕັອກເຮັດໃຫ້ຈຳນວນຄົງເຫຼືອປ່ຽນ → ນ້ຳໜັກຂອງໃບຮັບເຂົ້າຫຼັງຈາກນັ້ນປ່ຽນຕາມ
    await recalcProductCosts(client, rows.map(r => r.product_id));
    await client.query('COMMIT');
    return ok({ adjustment_number: docNumber, count: result.rowCount, items: result.rows });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

// ລົບໃບປັບປຸງສະຕັອກ (ລົບທັງໃບ ຕາມ adjustment_number)
//
// ໃບທີ່ "ອະນຸມັດແລ້ວ" ໄດ້ປັບຈຳນວນສິນຄ້າໄປແລ້ວ → ຕ້ອງຄືນສະຕັອກກ່ອນລົບ
// ຄືນແບບ "ລົບ delta ອອກ" (ບໍ່ແມ່ນຕັ້ງກັບເປັນ qty_before) ເພື່ອບໍ່ໃຫ້ລຶບ
// ການເຄື່ອນໄຫວອື່ນທີ່ເກີດຫຼັງຈາກນັ້ນຖິ້ມ
export const DELETE = handle(async (request, { params }) => {
  await ensureStockAdjustmentsSchema();
  const { id } = await params;
  const adjustmentId = Number(id);
  if (!Number.isInteger(adjustmentId) || adjustmentId <= 0) return fail(400, 'Invalid id');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const adjRes = await client.query(`SELECT * FROM stock_adjustments WHERE id = $1 FOR UPDATE`, [adjustmentId]);
    if (adjRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'ບໍ່ພົບໃບປັບປຸງນີ້');
    }
    const docNumber = adjRes.rows[0].adjustment_number || null;
    const docRes = docNumber
      ? await client.query(`SELECT * FROM stock_adjustments WHERE adjustment_number = $1 FOR UPDATE`, [docNumber])
      : adjRes;
    const rows = docRes.rows;
    const wasApproved = rows.some(r => r.status === 'approved' || !r.status);

    if (wasApproved) {
      // ລວມ delta ຕໍ່ສິນຄ້າ/ຕົວເລືອກກ່ອນ — ໃບດຽວອາດມີສິນຄ້າຊ້ຳກັນ
      const totals = new Map();
      for (const r of rows) {
        const key = r.variant_id ? `v:${r.variant_id}` : `p:${r.product_id}`;
        const prev = totals.get(key) || { variantId: r.variant_id || null, productId: r.product_id, delta: 0 };
        prev.delta += Number(r.delta) || 0;
        totals.set(key, prev);
      }

      for (const t of totals.values()) {
        const cur = t.variantId
          ? await client.query(
              `SELECT v.qty_on_hand, p.product_name FROM product_variants v
                 JOIN products p ON p.id = v.product_id
                WHERE v.id = $1 FOR UPDATE OF v`, [t.variantId])
          : await client.query(
              `SELECT qty_on_hand, product_name FROM products WHERE id = $1 FOR UPDATE`, [t.productId]);

        if (cur.rowCount === 0) {
          await client.query('ROLLBACK');
          return fail(400, 'ບໍ່ພົບສິນຄ້າຂອງໃບນີ້ແລ້ວ — ລົບບໍ່ໄດ້');
        }

        const next = (Number(cur.rows[0].qty_on_hand) || 0) - t.delta;
        if (next < 0) {
          await client.query('ROLLBACK');
          return fail(400,
            `ຄືນສະຕັອກບໍ່ໄດ້: "${cur.rows[0].product_name}" ຈະເຫຼືອ ${next} (ຕິດລົບ) ` +
            `— ມີການເຄື່ອນໄຫວຫຼັງຈາກໃບນີ້ແລ້ວ ໃຫ້ສ້າງໃບປັບປຸງໃໝ່ແທນການລົບ`);
        }

        if (t.variantId) {
          await client.query(
            `UPDATE product_variants SET qty_on_hand = $1, updated_at = NOW() WHERE id = $2`,
            [next, t.variantId]);
        } else {
          await client.query(`UPDATE products SET qty_on_hand = $1 WHERE id = $2`, [next, t.productId]);
        }
      }
    }

    const del = await client.query(
      `DELETE FROM stock_adjustments WHERE ${docNumber ? 'adjustment_number = $1' : 'id = $1'} RETURNING id`,
      [docNumber || adjustmentId]
    );

    // ຈຳນວນຄົງເຫຼືອປ່ຽນ → ຕົ້ນທຶນຖົວສະເລ່ຍປ່ຽນຕາມ (ຄືກັບຕອນອະນຸມັດ)
    if (wasApproved) await recalcProductCosts(client, rows.map(r => r.product_id));

    await client.query('COMMIT');
    return ok({
      deleted: del.rowCount,
      adjustment_number: docNumber,
      stock_reverted: wasApproved,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
