export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensurePurchaseRequestsSchema, ensureCompanyProfileSchema } from '@/lib/migrations';
import { allocateDocumentNumber } from '@/lib/billNumber';
import { extractActor } from '@/lib/audit';

// Convert an approved Purchase Request into an actual Purchase entry
// (ບີນຊື້ເຂົ້າ) in the `purchases` table — same flow as /admin/purchases POST.
//
// body: { payment_type: 'cash'|'debt', payment_method?, paid?, due_date?, currency?, exchange_rate?, note? }
export const POST = handle(async (request, { params }) => {
  await ensurePurchaseRequestsSchema();
  await ensureCompanyProfileSchema();
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isInteger(pid) || pid <= 0) return fail(400, 'Invalid id');
  const body = await readJson(request);
  const actor = extractActor(request);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prRes = await client.query(`SELECT * FROM purchase_requests WHERE id = $1 FOR UPDATE`, [pid]);
    if (prRes.rowCount === 0) { await client.query('ROLLBACK'); return fail(404, 'Not found'); }
    const pr = prRes.rows[0];
    if (pr.status === 'converted') { await client.query('ROLLBACK'); return fail(400, 'ປ່ຽນແລ້ວ'); }
    if (pr.status !== 'approved') { await client.query('ROLLBACK'); return fail(400, 'ກະຣຸນາອະນຸມັດກ່ອນ'); }

    const itemsRes = await client.query(
      `SELECT pri.*, p.product_name AS db_product_name
       FROM purchase_request_items pri
       LEFT JOIN products p ON p.id = pri.product_id
       WHERE pri.request_id = $1 ORDER BY pri.id`,
      [pid]
    );
    if (itemsRes.rowCount === 0) { await client.query('ROLLBACK'); return fail(400, 'ບໍ່ມີລາຍການ'); }

    const total = Number(pr.total) || 0;
    const paymentType = body.payment_type === 'debt' ? 'debt' : 'cash';
    const paid = paymentType === 'debt' ? 0 : (body.paid != null ? Math.max(0, Number(body.paid) || 0) : total);
    const status = paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';
    const dueDate = paymentType === 'debt' ? (body.due_date || null) : null;
    const currency = body.currency || 'LAK';
    const exchangeRate = Math.max(0, Number(body.exchange_rate) || 1);

    // Get supplier name if needed
    let supplierName = pr.supplier_name;
    if (pr.supplier_id && !supplierName) {
      const sRes = await client.query(`SELECT name FROM suppliers WHERE id = $1`, [pr.supplier_id]);
      supplierName = sRes.rows[0]?.name || null;
    }

    // Allocate purchase ref_number
    const settingsRes = await client.query('SELECT * FROM company_profile WHERE id = 1');
    const refNumber = await allocateDocumentNumber(client, 'purchase', settingsRes.rows[0] || {});

    // Create purchase
    const purchaseRes = await client.query(
      `INSERT INTO purchases (supplier_id, total, paid, status, currency, payment_method, note, ref_number,
                              payment_type, due_date, exchange_rate, original_total, subtotal, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pr_convert') RETURNING *`,
      [
        pr.supplier_id, total, paid, status, currency,
        body.payment_method || 'cash',
        body.note || pr.note || `Converted from ${pr.request_number}`,
        refNumber,
        paymentType, dueDate, exchangeRate, total, total,
      ]
    );
    const purchase = purchaseRes.rows[0];

    // Insert items + bump product stock
    for (const it of itemsRes.rows) {
      await client.query(
        `INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price) VALUES ($1, $2, $3, $4)`,
        [purchase.id, it.product_id, it.quantity, it.cost_price]
      );
      await client.query(
        `UPDATE products SET qty_on_hand = qty_on_hand + $1, cost_price = $2,
           supplier_name = COALESCE($4, supplier_name) WHERE id = $3`,
        [it.quantity, it.cost_price, it.product_id, supplierName]
      );
    }

    // Mark PR converted
    await client.query(
      `UPDATE purchase_requests SET status = 'converted', converted_purchase_id = $1,
         converted_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [purchase.id, pid]
    );

    await client.query('COMMIT');
    return ok({ purchase_id: purchase.id, ref_number: refNumber, request_id: pid });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
