import pool from './db';

const DEFAULT_COMPANY_NAME = 'SMLAO Soft Co,Ltd';

let ordersMigrated = false;
let cashHandoversMigrated = false;
let currenciesMigrated = false;
let promotionsMigrated = false;
let priceHistoryMigrated = false;
let pendingInvoicesMigrated = false;
let companyProfileMigrated = false;
let usersMigrated = false;
let membersMigrated = false;
let customerDebtPaymentsMigrated = false;
let productsExtraMigrated = false;
let cashTransactionsMigrated = false;
let quotationsMigrated = false;
let auditLogsMigrated = false;
let productVariantsMigrated = false;
let branchesMigrated = false;
let parkedCartsMigrated = false;
let stockAdjustmentsMigrated = false;
let stockTakesMigrated = false;
let laybysMigrated = false;
let stockTransfersMigrated = false;
let purchaseRequestsMigrated = false;

export async function ensurePurchaseRequestsSchema() {
  if (purchaseRequestsMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_requests (
        id SERIAL PRIMARY KEY,
        request_number TEXT UNIQUE,
        supplier_id INTEGER,
        supplier_name TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        needed_by DATE,
        subtotal NUMERIC DEFAULT 0,
        total NUMERIC DEFAULT 0,
        reason TEXT,
        note TEXT,
        branch_id INTEGER,
        requested_by TEXT,
        requested_by_user_id INTEGER,
        approved_by TEXT,
        approved_at TIMESTAMP,
        rejected_at TIMESTAMP,
        converted_purchase_id INTEGER,
        converted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_request_items (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL,
        product_name TEXT,
        quantity NUMERIC NOT NULL DEFAULT 0,
        cost_price NUMERIC NOT NULL DEFAULT 0,
        amount NUMERIC NOT NULL DEFAULT 0,
        note TEXT
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pr_status ON purchase_requests(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pr_supplier ON purchase_requests(supplier_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_pr_items_request ON purchase_request_items(request_id)`);
    purchaseRequestsMigrated = true;
  } catch (e) {
    console.error('purchase_requests migration error:', e.message);
  }
}

export async function ensureStockTransfersSchema() {
  if (stockTransfersMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS branch_stocks (
        product_id INTEGER NOT NULL,
        branch_id INTEGER NOT NULL,
        qty NUMERIC NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (product_id, branch_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_transfers (
        id SERIAL PRIMARY KEY,
        transfer_number TEXT UNIQUE,
        from_branch_id INTEGER NOT NULL,
        to_branch_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        note TEXT,
        created_by TEXT,
        completed_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_transfer_items (
        id SERIAL PRIMARY KEY,
        transfer_id INTEGER NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL,
        quantity NUMERIC NOT NULL DEFAULT 0
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_branch_stocks_branch ON branch_stocks(branch_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_transfers_dates ON stock_transfers(created_at DESC)`);
    stockTransfersMigrated = true;
  } catch (e) {
    console.error('stock_transfers migration error:', e.message);
  }
}

export async function ensureLaybysSchema() {
  if (laybysMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS laybys (
        id SERIAL PRIMARY KEY,
        layby_number TEXT UNIQUE,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        member_id INTEGER,
        status TEXT NOT NULL DEFAULT 'open',
        subtotal NUMERIC NOT NULL DEFAULT 0,
        discount NUMERIC DEFAULT 0,
        total NUMERIC NOT NULL DEFAULT 0,
        paid NUMERIC NOT NULL DEFAULT 0,
        balance NUMERIC NOT NULL DEFAULT 0,
        due_date DATE,
        note TEXT,
        branch_id INTEGER,
        completed_order_id INTEGER,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        cancelled_at TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS layby_items (
        id SERIAL PRIMARY KEY,
        layby_id INTEGER NOT NULL REFERENCES laybys(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,
        quantity NUMERIC NOT NULL DEFAULT 0,
        price NUMERIC NOT NULL DEFAULT 0
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS layby_payments (
        id SERIAL PRIMARY KEY,
        layby_id INTEGER NOT NULL REFERENCES laybys(id) ON DELETE CASCADE,
        amount NUMERIC NOT NULL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        payment_date DATE DEFAULT CURRENT_DATE,
        note TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_laybys_status ON laybys(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_laybys_member ON laybys(member_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_layby_items_layby ON layby_items(layby_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_layby_payments_layby ON layby_payments(layby_id)`);
    laybysMigrated = true;
  } catch (e) {
    console.error('laybys migration error:', e.message);
  }
}

export async function ensureStockTakesSchema() {
  if (stockTakesMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_takes (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        branch_id INTEGER,
        scope TEXT DEFAULT 'all',
        scope_value TEXT,
        note TEXT,
        created_by TEXT,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_take_items (
        id SERIAL PRIMARY KEY,
        stock_take_id INTEGER NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL,
        expected NUMERIC NOT NULL DEFAULT 0,
        counted NUMERIC,
        delta NUMERIC,
        note TEXT,
        counted_at TIMESTAMP
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_take_items_take ON stock_take_items(stock_take_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_takes_status ON stock_takes(status)`);
    stockTakesMigrated = true;
  } catch (e) {
    console.error('stock_takes migration error:', e.message);
  }
}

export async function ensureStockAdjustmentsSchema() {
  if (stockAdjustmentsMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stock_adjustments (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL,
        variant_id INTEGER,
        branch_id INTEGER,
        qty_before NUMERIC NOT NULL,
        qty_after NUMERIC NOT NULL,
        delta NUMERIC NOT NULL,
        reason TEXT NOT NULL,
        note TEXT,
        user_id INTEGER,
        username TEXT,
        adjustment_type TEXT DEFAULT 'manual',
        reference_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_adj_product ON stock_adjustments(product_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_adj_created ON stock_adjustments(created_at DESC)`);
    await pool.query(`ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS adjustment_number TEXT`);
    await pool.query(`ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved'`);
    await pool.query(`ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS requested_by TEXT`);
    await pool.query(`ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS approved_by TEXT`);
    await pool.query(`ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`);
    await pool.query(`ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS rejected_by TEXT`);
    await pool.query(`ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP`);
    await pool.query(`ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS rejection_note TEXT`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_adj_number ON stock_adjustments(adjustment_number) WHERE adjustment_number IS NOT NULL`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_stock_adj_status ON stock_adjustments(status)`);
    stockAdjustmentsMigrated = true;
  } catch (e) {
    console.error('stock_adjustments migration error:', e.message);
  }
}

export async function ensureParkedCartsSchema() {
  if (parkedCartsMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parked_carts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        username TEXT,
        branch_id INTEGER,
        name TEXT,
        cart JSONB NOT NULL,
        discount NUMERIC DEFAULT 0,
        discount_mode TEXT,
        member_id INTEGER,
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parked_carts_user ON parked_carts(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_parked_carts_branch ON parked_carts(branch_id)`);
    parkedCartsMigrated = true;
  } catch (e) {
    console.error('parked_carts migration error:', e.message);
  }
}

export async function ensureBranchesSchema() {
  if (branchesMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT,
        address TEXT,
        phone TEXT,
        active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        is_default BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_code ON branches(LOWER(code)) WHERE code IS NOT NULL AND code <> ''`);
    // Seed a default "Main" branch on first run
    await pool.query(
      `INSERT INTO branches (name, code, active, is_default, sort_order)
       SELECT 'ສາຂາຫຼັກ', 'MAIN', TRUE, TRUE, 0
       WHERE NOT EXISTS (SELECT 1 FROM branches)`
    );
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id INTEGER`);
    await pool.query(`ALTER TABLE purchases ADD COLUMN IF NOT EXISTS branch_id INTEGER`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id INTEGER`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id)`);
    branchesMigrated = true;
  } catch (e) {
    console.error('branches migration error:', e.message);
  }
}

export async function ensureProductVariantsSchema() {
  if (productVariantsMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        variant_name TEXT NOT NULL,
        variant_code TEXT,
        barcode TEXT,
        selling_price NUMERIC,
        cost_price NUMERIC,
        qty_on_hand INTEGER NOT NULL DEFAULT 0,
        active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_barcode ON product_variants(barcode) WHERE barcode IS NOT NULL AND barcode <> ''`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id)`);
    await pool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id INTEGER`);
    productVariantsMigrated = true;
  } catch (e) {
    console.error('product_variants migration error:', e.message);
  }
}

export async function ensureAuditLogsSchema() {
  if (auditLogsMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER,
        username TEXT,
        role TEXT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        summary TEXT,
        payload JSONB,
        ip TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
    auditLogsMigrated = true;
  } catch (e) {
    console.error('audit_logs migration error:', e.message);
  }
}

export async function ensureQuotationsSchema() {
  if (quotationsMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        id SERIAL PRIMARY KEY,
        quotation_number TEXT UNIQUE,
        customer_name TEXT,
        customer_phone TEXT,
        customer_address TEXT,
        member_id INTEGER,
        quote_date DATE DEFAULT CURRENT_DATE,
        valid_until DATE,
        status TEXT NOT NULL DEFAULT 'draft',
        subtotal NUMERIC NOT NULL DEFAULT 0,
        discount NUMERIC NOT NULL DEFAULT 0,
        total NUMERIC NOT NULL DEFAULT 0,
        note TEXT,
        converted_order_id INTEGER,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        id SERIAL PRIMARY KEY,
        quotation_id INTEGER REFERENCES quotations(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        product_name TEXT,
        quantity NUMERIC NOT NULL DEFAULT 0,
        price NUMERIC NOT NULL DEFAULT 0,
        amount NUMERIC NOT NULL DEFAULT 0
      )
    `);
    await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS vat_rate NUMERIC DEFAULT 0`);
    await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS vat_mode TEXT`);
    await pool.query(`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS vat_amount NUMERIC DEFAULT 0`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_quotations_date ON quotations(quote_date DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_quotation_items_q ON quotation_items(quotation_id)`);
    quotationsMigrated = true;
  } catch (e) {
    console.error('quotations migration error:', e.message);
  }
}

export async function ensureCashTransactionsSchema() {
  if (cashTransactionsMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cash_transactions (
        id SERIAL PRIMARY KEY,
        txn_type TEXT NOT NULL,
        category TEXT,
        description TEXT,
        amount NUMERIC NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'LAK',
        exchange_rate NUMERIC DEFAULT 1,
        amount_lak NUMERIC DEFAULT 0,
        account TEXT DEFAULT 'CASH',
        payment_method TEXT DEFAULT 'cash',
        note TEXT,
        attachment TEXT,
        txn_date DATE DEFAULT CURRENT_DATE,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cash_transactions_date ON cash_transactions(txn_date DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON cash_transactions(txn_type)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cash_transactions_currency ON cash_transactions(currency)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_cash_transactions_account ON cash_transactions(account)`);
    cashTransactionsMigrated = true;
  } catch (e) {
    console.error('cash_transactions migration error:', e.message);
  }
}
let returnsMigrated = false;

export async function ensureProductsExtraSchema() {
  if (productsExtraMigrated) return;
  try {
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS costing_method TEXT`);
    productsExtraMigrated = true;
  } catch (e) {
    console.error('products extra migration error:', e.message);
  }
}

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
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 0`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sales_target NUMERIC DEFAULT 0`);
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
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS credit_due_date DATE`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS credit_status TEXT DEFAULT 'none'`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS credit_paid NUMERIC DEFAULT 0`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS member_id INTEGER`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS member_points_earned INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS member_points_used INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS member_points_discount NUMERIC DEFAULT 0`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS bill_number TEXT`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by_username TEXT`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_created_by ON orders(created_by_user_id)`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS vat_rate NUMERIC DEFAULT 0`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS vat_mode TEXT`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS vat_amount NUMERIC DEFAULT 0`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_bill_number ON orders(bill_number) WHERE bill_number IS NOT NULL`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_credit_status ON orders(credit_status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_orders_member_id ON orders(member_id)`);
    ordersMigrated = true;
  } catch (e) {
    console.error('orders migration error:', e.message);
  }
}

export async function ensureMembersSchema() {
  if (membersMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        member_code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        province TEXT,
        district TEXT,
        village TEXT,
        address TEXT,
        tier TEXT NOT NULL DEFAULT 'standard',
        points INTEGER NOT NULL DEFAULT 0,
        total_spent NUMERIC NOT NULL DEFAULT 0,
        active BOOLEAN DEFAULT TRUE,
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS email TEXT`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS province TEXT`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS district TEXT`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS village TEXT`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS address TEXT`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'standard'`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS total_spent NUMERIC NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS note TEXT`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0`);
    await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS points_expires_at DATE`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_members_phone_unique ON members(phone) WHERE phone IS NOT NULL AND TRIM(phone) <> ''`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_members_search ON members(member_code, name, phone)`);
    membersMigrated = true;
  } catch (e) {
    console.error('members migration error:', e.message);
  }
}

export async function ensureCustomerDebtPaymentsSchema() {
  if (customerDebtPaymentsMigrated) return;
  try {
    await ensureOrdersSchema();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customer_debt_payments (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        payment_number TEXT,
        payment_date DATE DEFAULT CURRENT_DATE,
        amount NUMERIC NOT NULL DEFAULT 0,
        payment_method TEXT DEFAULT 'cash',
        note TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_customer_debt_payments_order ON customer_debt_payments(order_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_customer_debt_payments_date ON customer_debt_payments(payment_date DESC)`);
    customerDebtPaymentsMigrated = true;
  } catch (e) {
    console.error('customer_debt_payments migration error:', e.message);
  }
}

export async function ensureReturnsSchema() {
  if (returnsMigrated) return;
  try {
    await ensureOrdersSchema();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS returns (
        id SERIAL PRIMARY KEY,
        return_number TEXT UNIQUE,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        refund_amount NUMERIC NOT NULL DEFAULT 0,
        refund_method TEXT DEFAULT 'cash',
        note TEXT,
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS return_items (
        id SERIAL PRIMARY KEY,
        return_id INTEGER REFERENCES returns(id) ON DELETE CASCADE,
        order_item_id INTEGER REFERENCES order_items(id),
        product_id INTEGER REFERENCES products(id),
        quantity NUMERIC NOT NULL DEFAULT 0,
        price NUMERIC NOT NULL DEFAULT 0,
        amount NUMERIC NOT NULL DEFAULT 0
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_returns_created ON returns(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_return_items_order_item ON return_items(order_item_id)`);
    returnsMigrated = true;
  } catch (e) {
    console.error('returns migration error:', e.message);
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
      `INSERT INTO company_profile (id, name) VALUES (1, $1) ON CONFLICT (id) DO NOTHING`,
      [DEFAULT_COMPANY_NAME]
    );
    await pool.query(
      `UPDATE company_profile SET name = $1, updated_at = NOW() WHERE id = 1 AND (name IS NULL OR name IN ('POS System', 'ຮ້ານອຸປະກອນປະປາ'))`,
      [DEFAULT_COMPANY_NAME]
    );
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT TRUE`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS points_per_amount INTEGER DEFAULT 10000`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS points_redeem_value INTEGER DEFAULT 100`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS min_points_to_redeem INTEGER DEFAULT 100`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS tier_silver_threshold BIGINT DEFAULT 5000000`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS tier_gold_threshold BIGINT DEFAULT 20000000`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS tier_platinum_threshold BIGINT DEFAULT 50000000`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS points_lifetime_months INTEGER DEFAULT 0`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS bill_number_template TEXT DEFAULT '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS bill_number_prefix TEXT DEFAULT 'INV'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS bill_number_seq_digits INTEGER DEFAULT 5`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS bill_number_seq_reset TEXT DEFAULT 'monthly'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS bill_number_start INTEGER DEFAULT 1`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS return_number_template TEXT DEFAULT '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS return_number_prefix TEXT DEFAULT 'RET'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS return_number_seq_digits INTEGER DEFAULT 4`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS return_number_seq_reset TEXT DEFAULT 'monthly'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS return_number_start INTEGER DEFAULT 1`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS quotation_number_template TEXT DEFAULT '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS quotation_number_prefix TEXT DEFAULT 'QT'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS quotation_number_seq_digits INTEGER DEFAULT 4`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS quotation_number_seq_reset TEXT DEFAULT 'monthly'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS quotation_number_start INTEGER DEFAULT 1`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS purchase_number_template TEXT DEFAULT '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS purchase_number_prefix TEXT DEFAULT 'PO'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS purchase_number_seq_digits INTEGER DEFAULT 4`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS purchase_number_seq_reset TEXT DEFAULT 'monthly'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS purchase_number_start INTEGER DEFAULT 1`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS supplier_payment_number_template TEXT DEFAULT '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS supplier_payment_number_prefix TEXT DEFAULT 'SPAY'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS supplier_payment_number_seq_digits INTEGER DEFAULT 4`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS supplier_payment_number_seq_reset TEXT DEFAULT 'monthly'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS supplier_payment_number_start INTEGER DEFAULT 1`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS customer_payment_number_template TEXT DEFAULT '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS customer_payment_number_prefix TEXT DEFAULT 'CRP'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS customer_payment_number_seq_digits INTEGER DEFAULT 4`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS customer_payment_number_seq_reset TEXT DEFAULT 'monthly'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS customer_payment_number_start INTEGER DEFAULT 1`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS stock_adjustment_number_template TEXT DEFAULT '{{prefix}}-{{YYYY}}{{MM}}-{{seq}}'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS stock_adjustment_number_prefix TEXT DEFAULT 'ADJ'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS stock_adjustment_number_seq_digits INTEGER DEFAULT 4`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS stock_adjustment_number_seq_reset TEXT DEFAULT 'monthly'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS stock_adjustment_number_start INTEGER DEFAULT 1`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS default_costing_method TEXT DEFAULT 'AVG'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS vat_enabled BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS vat_rate NUMERIC DEFAULT 10`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS vat_mode TEXT DEFAULT 'exclusive'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS vat_label TEXT DEFAULT 'VAT'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS rounding_mode TEXT DEFAULT 'none'`);
    await pool.query(`ALTER TABLE company_profile ADD COLUMN IF NOT EXISTS rounding_step INTEGER DEFAULT 0`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bill_number_sequences (
        period_key TEXT PRIMARY KEY,
        current_seq INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
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
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS code TEXT`);
    await pool.query(`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS requires_code BOOLEAN DEFAULT FALSE`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_promotions_code ON promotions(LOWER(code)) WHERE code IS NOT NULL AND code <> ''`);
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
