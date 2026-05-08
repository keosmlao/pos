export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';

export const PUT = handle(async (request, { params }) => {
  const { id } = await params;
  const body = await readJson(request);
  const {
    name, phone, province, district, village, address, contact_person, contact_phone, credit_days,
    api_enabled, api_url, api_cust_codes, api_hashkey
  } = body;
  const custCodes = Array.isArray(api_cust_codes)
    ? api_cust_codes.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const primaryCustCode = custCodes[0] || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const old = await client.query('SELECT name, contact_person, contact_phone FROM suppliers WHERE id = $1', [id]);
    if (old.rows.length > 0) {
      const oldContact = old.rows[0];
      if (contact_person && (oldContact.contact_person !== contact_person || oldContact.contact_phone !== contact_phone)) {
        await client.query(
          'INSERT INTO supplier_contact_history (supplier_id, contact_person, contact_phone, note) VALUES ($1, $2, $3, $4)',
          [id, contact_person, contact_phone, 'ອັບເດດຂໍ້ມູນຕິດຕໍ່']
        );
      }
    }

    const result = await client.query(
      `UPDATE suppliers SET
        name=$1, phone=$2, province=$3, district=$4, village=$5, address=$6, contact_person=$7, contact_phone=$8, credit_days=$9,
        api_enabled=$10, api_url=$11, api_cust_code=$12, api_cust_codes=$13::jsonb, api_hashkey=$14
       WHERE id=$15 RETURNING *`,
      [
        name, phone, province, district, village, address, contact_person, contact_phone, credit_days || 0,
        !!api_enabled, api_url || null, primaryCustCode, JSON.stringify(custCodes), api_hashkey || null, id
      ]
    );

    if (old.rows.length > 0 && old.rows[0].name !== name) {
      await client.query(
        'UPDATE products SET supplier_name = $1 WHERE supplier_name = $2',
        [name, old.rows[0].name]
      );
    }

    await client.query('COMMIT');

    if (result.rows.length === 0) return fail(404, 'Supplier not found');
    return ok(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

export const DELETE = handle(async (_request, { params }) => {
  const { id } = await params;

  const supplierResult = await pool.query('SELECT name FROM suppliers WHERE id = $1', [id]);
  if (supplierResult.rows.length === 0) return fail(404, 'Supplier not found');

  const purchases = await pool.query('SELECT COUNT(*) FROM purchases WHERE supplier_id = $1', [id]);
  if (parseInt(purchases.rows[0].count) > 0) {
    return fail(400, 'ບໍ່ສາມາດລຶບຜູ້ສະໜອງທີ່ມີການສັ່ງຊື້');
  }

  await pool.query('UPDATE products SET supplier_name = NULL WHERE supplier_name = $1', [supplierResult.rows[0].name]);
  await pool.query('DELETE FROM suppliers WHERE id = $1', [id]);
  return ok({ message: 'Supplier deleted' });
});