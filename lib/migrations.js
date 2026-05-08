import pool from './db';

let ordersMigrated = false;
let cashHandoversMigrated = false;
let currenciesMigrated = false;
let promotionsMigrated = false;
let priceHistoryMigrated = false;
let pendingInvoicesMigrated = false;
let companyProfileMigrated = false;
let usersMigrated = false;

export async function ensureUsersSchema() {
  if (usersMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'cashier',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'cashier'`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`);
    usersMigrated = true;
  } catch (e) {
    console.error('users migration error:', e.message);
  }
}

export async function ensureOrdersSchema() {
  if (ordersMigrated) return;
  try {
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS note TEXT`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payments JSONB`);
    ordersMigrated = true;
  } catch (e) {
    console.error('orders migration error:', e.message);
  }
}

export async function ensureCompanyProfileSchema() {
  if (companyProfileMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS company_profile (
        id INTEGER PRIMARY KEY DEFAULT 1,
        name TEXT,
        slogan TEXT,
        tax_id TEXT,
        business_reg_no TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        logo_url TEXT,
        bank_accounts JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP DEFAULT NOW(),
        CHECK (id = 1)
      )
    `);
    await pool.query(
      `INSERT INTO company_profile (id, name) VALUES (1, 'ຮ້ານອຸປະກອນປະປາ') ON CONFLICT (id) DO NOTHING`
    );
    companyProfileMigrated = true;
  } catch (e) {
    console.error('company_profile migration error:', e.message);
  }
}

export async function ensurePendingInvoicesSchema() {
  if (pendingInvoicesMigrated) return;
  try {
    await pool.query(`ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS header JSONB`);
    await pool.query(`ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS purchase_id INTEGER`);
    pendingInvoicesMigrated = true;
  } catch (e) {
    console.error('pending_invoices migration error:', e.message);
  }
}

export async function ensurePriceHistorySchema() {
  if (priceHistoryMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        cost_price_before NUMERIC,
        selling_price_before NUMERIC,
        cost_price_after NUMERIC,
        selling_price_after NUMERIC,
        source VARCHAR(30) DEFAULT 'manual',
        note TEXT,
        changed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_price_history_changed ON price_history(changed_at DESC)`);
    priceHistoryMigrated = true;
  } catch (e) {
    console.error('price_history migration error:', e.message);
  }
}

export async function ensurePromotionsSchema() {
  if (promotionsMigrated) return;
  try {
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS description TEXT`);
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS buy_qty INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS get_qty INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS min_purchase NUMERIC DEFAULT 0`);
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS scope VARCHAR(20) DEFAULT 'all'`);
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS scope_ids JSONB DEFAULT '[]'::jsonb`);
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS start_time TIME`);
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS end_time TIME`);
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS days_of_week JSONB DEFAULT '[]'::jsonb`);
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS max_uses INTEGER`);
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS used_count INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS stackable BOOLEAN DEFAULT true`);
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS gift_product_id INTEGER`);
    promotionsMigrated = true;
  } catch (e) {
    console.error('promotions migration error:', e.message);
  }
}

export async function ensureCurrenciesSchema() {
  if (currenciesMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS currencies (
        code VARCHAR(10) PRIMARY KEY,
        symbol VARCHAR(10),
        name TEXT,
        rate NUMERIC NOT NULL DEFAULT 1,
        enabled BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const seed = [
      { code: 'LAK', symbol: '₭', name: 'ກີບ', rate: 1, enabled: true, sort_order: 0 },
      { code: 'THB', symbol: '฿', name: 'ບາດ', rate: 625, enabled: true, sort_order: 1 },
      { code: 'USD', symbol: '$', name: 'ໂດລາ', rate: 21500, enabled: true, sort_order: 2 },
      { code: 'CNY', symbol: '¥', name: 'ຫຍວນ', rate: 2950, enabled: false, sort_order: 3 },
      { code: 'VND', symbol: '₫', name: 'ດົງ', rate: 0.85, enabled: false, sort_order: 4 },
    ];
    for (const c of seed) {
      await pool.query(
        `INSERT INTO currencies (code, symbol, name, rate, enabled, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO NOTHING`,
        [c.code, c.symbol, c.name, c.rate, c.enabled, c.sort_order]
      );
    }
    currenciesMigrated = true;
  } catch (e) {
    console.error('currencies migration error:', e.message);
  }
}

export async function ensureCashHandoversSchema() {
  if (cashHandoversMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cash_handovers (
        id SERIAL PRIMARY KEY,
        handover_date DATE NOT NULL DEFAULT CURRENT_DATE,
        cashier_name TEXT,
        expected_cash NUMERIC DEFAULT 0,
        actual_cash NUMERIC DEFAULT 0,
        diff NUMERIC DEFAULT 0,
        note TEXT,
        received_by TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE cash_handovers ADD COLUMN IF NOT EXISTS received_at TIMESTAMP`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cash_handovers_date ON cash_handovers(handover_date DESC)`);
    cashHandoversMigrated = true;
  } catch (e) {
    console.error('cash_handovers migration error:', e.message);
  }
}
