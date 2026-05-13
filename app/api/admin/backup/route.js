export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, getQuery } from '@/lib/api';

// Table whitelist — only safe, owned data. No `users` table (passwords).
const EXPORTABLE_TABLES = {
  products: 'SELECT * FROM products ORDER BY id',
  categories: 'SELECT * FROM categories ORDER BY id',
  brands: 'SELECT * FROM brands ORDER BY id',
  units: 'SELECT * FROM units ORDER BY id',
  suppliers: 'SELECT * FROM suppliers ORDER BY id',
  members: 'SELECT id, member_code, name, phone, email, province, district, village, address, tier, points, total_spent, active, note, created_at, updated_at FROM members ORDER BY id',
  orders: 'SELECT * FROM orders ORDER BY id',
  order_items: 'SELECT * FROM order_items ORDER BY id',
  returns: 'SELECT * FROM returns ORDER BY id',
  return_items: 'SELECT * FROM return_items ORDER BY id',
  purchases: 'SELECT * FROM purchases ORDER BY id',
  purchase_items: 'SELECT * FROM purchase_items ORDER BY id',
  customer_debt_payments: 'SELECT * FROM customer_debt_payments ORDER BY id',
  quotations: 'SELECT * FROM quotations ORDER BY id',
  quotation_items: 'SELECT * FROM quotation_items ORDER BY id',
  cash_transactions: 'SELECT * FROM cash_transactions ORDER BY id',
  cash_handovers: 'SELECT * FROM cash_handovers ORDER BY id',
  promotions: 'SELECT * FROM promotions ORDER BY id',
  currencies: 'SELECT * FROM currencies ORDER BY code',
  company_profile: 'SELECT id, name, slogan, tax_id, business_reg_no, address, phone, email, logo_url, bank_accounts, vat_enabled, vat_rate, vat_mode, vat_label, default_costing_method, loyalty_enabled, points_per_amount, points_redeem_value, min_points_to_redeem, tier_silver_threshold, tier_gold_threshold, tier_platinum_threshold FROM company_profile',
};

export const GET = handle(async (request) => {
  const { table } = getQuery(request);

  if (table) {
    if (!EXPORTABLE_TABLES[table]) {
      return new Response(JSON.stringify({ error: 'Unknown table' }), { status: 400 });
    }
    const r = await pool.query(EXPORTABLE_TABLES[table]);
    const csv = rowsToCsv(r.rows);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${table}_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  // Full backup as JSON
  const exportData = {
    _exported_at: new Date().toISOString(),
    _version: 1,
    tables: {},
  };

  for (const [name, sql] of Object.entries(EXPORTABLE_TABLES)) {
    try {
      const r = await pool.query(sql);
      exportData.tables[name] = r.rows;
    } catch (e) {
      exportData.tables[name] = { _error: e.message };
    }
  }

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="pos-backup_${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});

function rowsToCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const escape = (v) => {
    if (v == null) return '';
    if (typeof v === 'object') v = JSON.stringify(v);
    const s = String(v);
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [
    cols.join(','),
    ...rows.map(r => cols.map(c => escape(r[c])).join(',')),
  ].join('\n');
}
