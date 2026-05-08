export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson } from '@/lib/api';

export const GET = handle(async () => {
  const result = await pool.query('SELECT * FROM suppliers ORDER BY name');
  return ok(result.rows);
});

export const POST = handle(async (request) => {
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

    const result = await client.query(
      `INSERT INTO suppliers (
        name, phone, province, district, village, address, contact_person, contact_phone, credit_days,
        api_enabled, api_url, api_cust_code, api_cust_codes, api_hashkey
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14) RETURNING *`,
      [
        name, phone, province, district, village, address, contact_person, contact_phone, credit_days || 0,
        !!api_enabled, api_url || null, primaryCustCode, JSON.stringify(custCodes), api_hashkey || null
      ]
    );

    const supplier = result.rows[0];

    if (contact_person) {
      await client.query(
        'INSERT INTO supplier_contact_history (supplier_id, contact_person, contact_phone, note) VALUES ($1, $2, $3, $4)',
        [supplier.id, contact_person, contact_phone, 'ບັນທຶກເບື້ອງຕົ້ນ']
      );
    }

    await client.query('COMMIT');
    return ok(supplier);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});