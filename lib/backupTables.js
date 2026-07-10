// ລາຍການຕາຕະລາງທີ່ອະນຸຍາດໃຫ້ export/backup — ບໍ່ມີ users (ລະຫັດຜ່ານ) ແລະ sessions
export const EXPORTABLE_TABLES = {
  products: 'SELECT * FROM products ORDER BY id',
  categories: 'SELECT * FROM categories ORDER BY id',
  brands: 'SELECT * FROM brands ORDER BY id',
  units: 'SELECT * FROM units ORDER BY id',
  suppliers: 'SELECT * FROM suppliers ORDER BY id',
  supplier_contact_history: 'SELECT * FROM supplier_contact_history ORDER BY id',
  members: 'SELECT id, member_code, name, phone, email, province, district, village, address, tier, points, total_spent, active, note, created_at, updated_at FROM members ORDER BY id',
  product_variants: 'SELECT * FROM product_variants ORDER BY id',
  branches: 'SELECT * FROM branches ORDER BY id',
  branch_stocks: 'SELECT * FROM branch_stocks ORDER BY branch_id, product_id',
  orders: 'SELECT * FROM orders ORDER BY id',
  order_items: 'SELECT * FROM order_items ORDER BY id',
  returns: 'SELECT * FROM returns ORDER BY id',
  return_items: 'SELECT * FROM return_items ORDER BY id',
  purchases: 'SELECT * FROM purchases ORDER BY id',
  purchase_items: 'SELECT * FROM purchase_items ORDER BY id',
  purchase_orders: 'SELECT * FROM purchase_orders ORDER BY id',
  purchase_order_items: 'SELECT * FROM purchase_order_items ORDER BY id',
  purchase_requests: 'SELECT * FROM purchase_requests ORDER BY id',
  purchase_request_items: 'SELECT * FROM purchase_request_items ORDER BY id',
  pending_invoices: 'SELECT * FROM pending_invoices ORDER BY id',
  debt_payments: 'SELECT * FROM debt_payments ORDER BY id',
  customer_debt_payments: 'SELECT * FROM customer_debt_payments ORDER BY id',
  quotations: 'SELECT * FROM quotations ORDER BY id',
  quotation_items: 'SELECT * FROM quotation_items ORDER BY id',
  cash_transactions: 'SELECT * FROM cash_transactions ORDER BY id',
  cash_handovers: 'SELECT * FROM cash_handovers ORDER BY id',
  stock_adjustments: 'SELECT * FROM stock_adjustments ORDER BY id',
  stock_takes: 'SELECT * FROM stock_takes ORDER BY id',
  stock_take_items: 'SELECT * FROM stock_take_items ORDER BY id',
  stock_transfers: 'SELECT * FROM stock_transfers ORDER BY id',
  stock_transfer_items: 'SELECT * FROM stock_transfer_items ORDER BY id',
  parked_carts: 'SELECT * FROM parked_carts ORDER BY id',
  laybys: 'SELECT * FROM laybys ORDER BY id',
  layby_items: 'SELECT * FROM layby_items ORDER BY id',
  layby_payments: 'SELECT * FROM layby_payments ORDER BY id',
  promotions: 'SELECT * FROM promotions ORDER BY id',
  price_history: 'SELECT * FROM price_history ORDER BY id',
  bill_number_sequences: 'SELECT * FROM bill_number_sequences ORDER BY period_key',
  provinces: 'SELECT * FROM provinces ORDER BY id',
  districts: 'SELECT * FROM districts ORDER BY id',
  villages: 'SELECT * FROM villages ORDER BY id',
  audit_logs: 'SELECT * FROM audit_logs ORDER BY id',
  app_events: 'SELECT * FROM app_events ORDER BY id',
  chatter_messages: 'SELECT * FROM chatter_messages ORDER BY id',
  chatter_followers: 'SELECT * FROM chatter_followers ORDER BY id',
  chatter_activities: 'SELECT * FROM chatter_activities ORDER BY id',
  currencies: 'SELECT * FROM currencies ORDER BY code',
  company_profile: 'SELECT id, name, slogan, tax_id, business_reg_no, address, phone, email, logo_url, payment_qr_url, bank_accounts, vat_enabled, vat_rate, vat_mode, vat_label, default_costing_method, loyalty_enabled, points_per_amount, points_redeem_value, min_points_to_redeem, tier_silver_threshold, tier_gold_threshold, tier_platinum_threshold FROM company_profile',
};

export async function dumpAllTables(pool) {
  const exportData = {
    _exported_at: new Date().toISOString(),
    _version: 1,
    tables: {},
  };
  for (const [name, sql] of Object.entries(EXPORTABLE_TABLES)) {
    const r = await pool.query(sql);
    exportData.tables[name] = r.rows;
  }
  return exportData;
}
