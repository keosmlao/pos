export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureCompanyProfileSchema, ensurePendingInvoicesSchema } from '@/lib/migrations';
import { allocateDocumentNumber } from '@/lib/billNumber';
import { extractActor } from '@/lib/audit';
import { publishEvent } from '@/lib/appEvents';

export const GET = handle(async () => {
  await ensurePendingInvoicesSchema();
  const result = await pool.query(`
    SELECT p.*,
      s.name as supplier_name,
      json_agg(json_build_object(
        'id', pi.id,
        'product_id', pi.product_id,
        'quantity', pi.quantity,
        'cost_price', pi.cost_price,
        'product_name', pr.product_name,
        'product_code', pr.product_code,
        'unit', pr.unit
      )) FILTER (WHERE pi.id IS NOT NULL) as items
    FROM purchases p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
    LEFT JOIN products pr ON pi.product_id = pr.id
    GROUP BY p.id, s.name
    ORDER BY p.created_at DESC
  `);
  return ok(result.rows);
});

export const POST = handle(async (request) => {
  await ensurePendingInvoicesSchema();
  await ensureCompanyProfileSchema();
  const body = await readJson(request);
  const {
    supplier_id, total, paid, currency, payment_method, invoice_file, note,
    ref_number, payment_type, due_date, exchange_rate, original_total, discount_amount, subtotal, items,
    sml_doc_no, sml_doc_date,
  } = body;

  const normalizedTotal = Math.max(0, Number(total) || 0);
  const normalizedExchangeRate = Math.max(0, Number(exchange_rate) || 0) || 1;
  const normalizedOriginalTotal = Math.max(0, Number(original_total) || 0);
  const normalizedDiscountAmount = Math.max(0, Number(discount_amount) || 0);
  const normalizedSubtotal = Math.max(0, Number(subtotal) || 0);
  const normalizedPaymentType = payment_type === 'debt' ? 'debt' : 'cash';
  const normalizedPaymentMethod = normalizedPaymentType === 'debt' ? 'cash' : (payment_method || 'cash');
  const requestedPaid = Math.max(0, Number(paid) || 0);

  if (normalizedTotal <= 0) return fail(400, 'ຍອດລວມຂອງບິນຕ້ອງຫຼາຍກວ່າ 0');

  const normalizedPaid = normalizedPaymentType === 'debt'
    ? 0
    : Math.min(normalizedTotal, requestedPaid > 0 ? requestedPaid : normalizedTotal);
  const normalizedStatus = normalizedPaid >= normalizedTotal && normalizedTotal > 0
    ? 'paid'
    : normalizedPaid > 0
      ? 'partial'
      : 'pending';
  const normalizedDueDate = normalizedPaymentType === 'debt' ? (due_date || null) : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let resolvedRefNumber = String(ref_number || '').trim() || null;
    if (!resolvedRefNumber) {
      const settingsRes = await client.query('SELECT * FROM company_profile WHERE id = 1');
      resolvedRefNumber = await allocateDocumentNumber(client, 'purchase', settingsRes.rows[0] || {});
    }

    const purchaseResult = await client.query(
      `INSERT INTO purchases (supplier_id, total, paid, status, currency, payment_method, invoice_file, note, ref_number, payment_type, due_date, exchange_rate, original_total, discount_amount, subtotal, sml_doc_no, sml_doc_date, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [supplier_id, normalizedTotal, normalizedPaid, normalizedStatus, currency || 'LAK', normalizedPaymentMethod, invoice_file, note, resolvedRefNumber, normalizedPaymentType, normalizedDueDate, normalizedExchangeRate, normalizedOriginalTotal, normalizedDiscountAmount, normalizedSubtotal, sml_doc_no || null, sml_doc_date || null, sml_doc_no ? 'sml' : 'manual']
    );
    const purchase = purchaseResult.rows[0];

    if (sml_doc_no && supplier_id) {
      await client.query(
        `UPDATE pending_invoices SET purchase_id = $1 WHERE supplier_id = $2 AND doc_no = $3`,
        [purchase.id, supplier_id, sml_doc_no]
      );
    }

    let supplierName = null;
    if (supplier_id) {
      const supplierResult = await client.query('SELECT name FROM suppliers WHERE id = $1', [supplier_id]);
      supplierName = supplierResult.rows[0]?.name || null;
    }

    if (items && items.length > 0) {
      for (const item of items) {
        await client.query(
          'INSERT INTO purchase_items (purchase_id, product_id, quantity, cost_price) VALUES ($1, $2, $3, $4)',
          [purchase.id, item.product_id, item.quantity, item.cost_price]
        );
        await client.query(
          'UPDATE products SET qty_on_hand = qty_on_hand + $1, cost_price = $2, supplier_name = COALESCE($4, supplier_name) WHERE id = $3',
          [item.quantity, item.cost_price, item.product_id, supplierName]
        );
      }
    }

    await client.query('COMMIT');
    const actor = extractActor(request);
    publishEvent({
      type: normalizedPaymentType === 'debt' ? 'purchase.credit' : 'purchase.create',
      title: normalizedPaymentType === 'debt' ? 'ມີບິນຊື້ແບບໜີ້ໃໝ່' : 'ມີບິນຊື້ໃໝ່',
      body: `${resolvedRefNumber || '#' + purchase.id} · ${supplierName || 'ບໍ່ມີຜູ້ສະໜອງ'} · ${Number(normalizedTotal).toLocaleString('en-US')} ${currency || 'LAK'}`,
      data: { purchase_id: purchase.id, ref_number: resolvedRefNumber, supplier_id, supplier_name: supplierName, total: normalizedTotal, currency: currency || 'LAK', payment_type: normalizedPaymentType },
      actor: actor.username,
    }).catch(() => {});
    return ok(purchase);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
