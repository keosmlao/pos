export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson } from '@/lib/api';
import { ensureCompanyProfileSchema } from '@/lib/migrations';

export const GET = handle(async () => {
  await ensureCompanyProfileSchema();
  const result = await pool.query('SELECT * FROM company_profile WHERE id = 1');
  return ok(result.rows[0] || null);
});

export const PUT = handle(async (request) => {
  await ensureCompanyProfileSchema();
  const body = await readJson(request);
  const { name, slogan, tax_id, business_reg_no, address, phone, email, logo_url, bank_accounts } = body;
  const accounts = Array.isArray(bank_accounts)
    ? bank_accounts
        .map((a) => ({
          bank_name: String(a?.bank_name || '').trim(),
          account_name: String(a?.account_name || '').trim(),
          account_number: String(a?.account_number || '').trim(),
        }))
        .filter((a) => a.bank_name || a.account_name || a.account_number)
    : [];

  const result = await pool.query(
    `INSERT INTO company_profile
       (id, name, slogan, tax_id, business_reg_no, address, phone, email, logo_url, bank_accounts, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       slogan = EXCLUDED.slogan,
       tax_id = EXCLUDED.tax_id,
       business_reg_no = EXCLUDED.business_reg_no,
       address = EXCLUDED.address,
       phone = EXCLUDED.phone,
       email = EXCLUDED.email,
       logo_url = EXCLUDED.logo_url,
       bank_accounts = EXCLUDED.bank_accounts,
       updated_at = NOW()
     RETURNING *`,
    [
      name || null,
      slogan || null,
      tax_id || null,
      business_reg_no || null,
      address || null,
      phone || null,
      email || null,
      logo_url || null,
      JSON.stringify(accounts),
    ]
  );
  return ok(result.rows[0]);
});
