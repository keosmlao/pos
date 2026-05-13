export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson, getQuery } from '@/lib/api';
import { ensureQuotationsSchema, ensureCompanyProfileSchema } from '@/lib/migrations';
import { allocateQuotationNumber } from '@/lib/billNumber';
import { normalizeVatSettings, applyVat } from '@/lib/vat';

const STATUSES = new Set(['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted']);

export const GET = handle(async (request) => {
  await ensureQuotationsSchema();
  const { status, q, from, to, limit = '200' } = getQuery(request);
  const lim = Math.max(1, Math.min(500, parseInt(limit, 10) || 200));
  const where = [];
  const params = [];
  if (status && STATUSES.has(status)) { params.push(status); where.push(`q.status = $${params.length}`); }
  if (from) { params.push(from); where.push(`q.quote_date >= $${params.length}`); }
  if (to) { params.push(to); where.push(`q.quote_date <= $${params.length}`); }
  if (q) {
    params.push(`%${String(q).toLowerCase()}%`);
    const i = params.length;
    where.push(`(LOWER(COALESCE(q.quotation_number,'')) LIKE $${i} OR LOWER(COALESCE(q.customer_name,'')) LIKE $${i} OR COALESCE(q.customer_phone,'') LIKE $${i})`);
  }
  params.push(lim);

  const result = await pool.query(
    `SELECT q.*,
       COALESCE(json_agg(json_build_object(
         'id', qi.id,
         'product_id', qi.product_id,
         'product_name', qi.product_name,
         'quantity', qi.quantity,
         'price', qi.price,
         'amount', qi.amount
       ) ORDER BY qi.id) FILTER (WHERE qi.id IS NOT NULL), '[]') AS items
     FROM quotations q
     LEFT JOIN quotation_items qi ON qi.quotation_id = q.id
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     GROUP BY q.id
     ORDER BY q.quote_date DESC, q.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return ok(result.rows);
});

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

export const POST = handle(async (request) => {
  await ensureQuotationsSchema();
  await ensureCompanyProfileSchema();
  const body = await readJson(request);

  const items = normalizeItems(body.items);
  if (items.length === 0) return fail(400, 'items is required');

  const itemsSum = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const discount = Math.max(0, Number(body.discount) || 0);
  const net = Math.max(0, itemsSum - discount);
  const status = STATUSES.has(body.status) ? body.status : 'draft';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const settingsRes = await client.query(
      `SELECT quotation_number_template, quotation_number_prefix, quotation_number_seq_digits,
              quotation_number_seq_reset, quotation_number_start,
              vat_enabled, vat_rate, vat_mode, vat_label
       FROM company_profile WHERE id = 1`
    );
    const settings = settingsRes.rows[0] || {};
    const quotationNumber = body.quotation_number?.trim() || await allocateQuotationNumber(client, settings);
    const vat = normalizeVatSettings(settings);
    const { subtotalExVat, vatAmount, total: grandTotal } = applyVat(net, vat);

    const qres = await client.query(
      `INSERT INTO quotations
         (quotation_number, customer_name, customer_phone, customer_address, member_id,
          quote_date, valid_until, status, subtotal, discount, total, note, created_by,
          vat_rate, vat_mode, vat_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        quotationNumber,
        body.customer_name?.trim() || null,
        body.customer_phone?.trim() || null,
        body.customer_address?.trim() || null,
        Number(body.member_id) || null,
        body.quote_date ? String(body.quote_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        body.valid_until ? String(body.valid_until).slice(0, 10) : null,
        status,
        subtotalExVat,
        discount,
        grandTotal,
        body.note?.trim() || null,
        body.created_by?.trim() || null,
        vat.enabled ? vat.rate : 0,
        vat.enabled ? vat.mode : null,
        vatAmount,
      ]
    );
    const quotation = qres.rows[0];

    for (const it of items) {
      await client.query(
        `INSERT INTO quotation_items (quotation_id, product_id, product_name, quantity, price, amount)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [quotation.id, it.product_id, it.product_name, it.quantity, it.price, it.amount]
      );
    }
    const itemsRes = await client.query(`SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY id`, [quotation.id]);

    await client.query('COMMIT');
    return ok({ ...quotation, items: itemsRes.rows });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});
