export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureQuotationsSchema, ensureCompanyProfileSchema } from '@/lib/migrations';
import { normalizeVatSettings, applyVat } from '@/lib/vat';

const STATUSES = new Set(['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted']);

function normalizeItems(items) {
  const list = Array.isArray(items) ? items : [];
  return list.map(it => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.price) || 0;
    return {
      product_id: Number(it.product_id) || null,
      product_name: String(it.product_name || '').trim() || null,
      quantity: qty,
      price,
      amount: Number(it.amount) || (qty * price),
    };
  }).filter(it => it.quantity > 0 && (it.product_id || it.product_name));
}

export const GET = handle(async (_request, { params }) => {
  await ensureQuotationsSchema();
  const { id } = await params;
  const qid = Number(id);
  if (!Number.isInteger(qid) || qid <= 0) return fail(400, 'Invalid id');
  const q = await pool.query('SELECT * FROM quotations WHERE id = $1', [qid]);
  if (q.rowCount === 0) return fail(404, 'Not found');
  const items = await pool.query('SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY id', [qid]);
  return ok({ ...q.rows[0], items: items.rows });
});

export const PUT = handle(async (request, { params }) => {
  await ensureQuotationsSchema();
  const { id } = await params;
  const qid = Number(id);
  if (!Number.isInteger(qid) || qid <= 0) return fail(400, 'Invalid id');
  const body = await readJson(request);

  const items = normalizeItems(body.items);
  if (items.length === 0) return fail(400, 'items is required');
  const itemsSum = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const discount = Math.max(0, Number(body.discount) || 0);
  const net = Math.max(0, itemsSum - discount);
  const status = STATUSES.has(body.status) ? body.status : null;

  await ensureCompanyProfileSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existsRes = await client.query('SELECT id, status FROM quotations WHERE id = $1 FOR UPDATE', [qid]);
    if (existsRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(404, 'Not found');
    }
    if (existsRes.rows[0].status === 'converted') {
      await client.query('ROLLBACK');
      return fail(400, 'Quotation already converted');
    }
    const settingsRes = await client.query(
      `SELECT vat_enabled, vat_rate, vat_mode, vat_label FROM company_profile WHERE id = 1`
    );
    const vat = normalizeVatSettings(settingsRes.rows[0] || {});
    const { subtotalExVat, vatAmount, total: grandTotal } = applyVat(net, vat);

    const updateRes = await client.query(
      `UPDATE quotations SET
         customer_name = $1, customer_phone = $2, customer_address = $3, member_id = $4,
         quote_date = $5, valid_until = $6, status = COALESCE($7, status),
         subtotal = $8, discount = $9, total = $10, note = $11,
         vat_rate = $12, vat_mode = $13, vat_amount = $14,
         updated_at = NOW()
       WHERE id = $15 RETURNING *`,
      [
        body.customer_name?.trim() || null,
        body.customer_phone?.trim() || null,
        body.customer_address?.trim() || null,
        Number(body.member_id) || null,
        body.quote_date ? String(body.quote_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        body.valid_until ? String(body.valid_until).slice(0, 10) : null,
        status,
        subtotalExVat, discount, grandTotal,
        body.note?.trim() || null,
        vat.enabled ? vat.rate : 0,
        vat.enabled ? vat.mode : null,
        vatAmount,
        qid,
      ]
    );

    await client.query('DELETE FROM quotation_items WHERE quotation_id = $1', [qid]);
    for (const it of items) {
      await client.query(
        `INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, price, amount)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [qid, it.product_id, it.product_name, it.quantity, it.price, it.amount]
      );
    }
    const itemsRes = await client.query(`SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY id`, [qid]);
    await client.query('COMMIT');
    return ok({ ...updateRes.rows[0], items: itemsRes.rows });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

export const DELETE = handle(async (_request, { params }) => {
  await ensureQuotationsSchema();
  const { id } = await params;
  const qid = Number(id);
  if (!Number.isInteger(qid) || qid <= 0) return fail(400, 'Invalid id');
  const exists = await pool.query('SELECT status FROM quotations WHERE id = $1', [qid]);
  if (exists.rowCount === 0) return fail(404, 'Not found');
  if (exists.rows[0].status === 'converted') return fail(400, 'Cannot delete converted quotation');
  await pool.query('DELETE FROM quotations WHERE id = $1', [qid]);
  return ok({ message: 'Deleted', id: qid });
});
