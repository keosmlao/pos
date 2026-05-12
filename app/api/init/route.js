export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';
import defaultLocations from '@/data/laoLocations';

export const GET = handle(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      product_code VARCHAR(50),
      product_name TEXT NOT NULL,
      barcode VARCHAR(100),
      category VARCHAR(100),
      brand VARCHAR(100),
      cost_price NUMERIC DEFAULT 0,
      selling_price NUMERIC DEFAULT 0,
      qty_on_hand INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 5,
      unit VARCHAR(20) DEFAULT 'ອັນ',
      expiry_date DATE,
      supplier_name TEXT,
      status BOOLEAN DEFAULT TRUE,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      pos_visible BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS pos_visible BOOLEAN DEFAULT TRUE;

    CREATE TABLE IF NOT EXISTS brands (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS units (
      id SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      total NUMERIC NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      amount_paid NUMERIC DEFAULT 0,
      change_amount NUMERIC DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS note TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS payments JSONB;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS credit_due_date DATE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS credit_status TEXT DEFAULT 'none';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS credit_paid NUMERIC DEFAULT 0;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS member_id INTEGER;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS member_points_earned INTEGER DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_orders_credit_status ON orders(credit_status);
    CREATE INDEX IF NOT EXISTS idx_orders_member_id ON orders(member_id);

    CREATE TABLE IF NOT EXISTS order_items (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id),
      product_id INTEGER REFERENCES products(id),
      quantity INTEGER NOT NULL,
      price NUMERIC NOT NULL
    );

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
    );
    ALTER TABLE members ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS province TEXT;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS district TEXT;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS village TEXT;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'standard';
    ALTER TABLE members ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS total_spent NUMERIC NOT NULL DEFAULT 0;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS note TEXT;
    ALTER TABLE members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
    CREATE UNIQUE INDEX IF NOT EXISTS idx_members_phone_unique ON members(phone) WHERE phone IS NOT NULL AND TRIM(phone) <> '';
    CREATE INDEX IF NOT EXISTS idx_members_search ON members(member_code, name, phone);

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT INTO settings (key, value) VALUES ('po_format', 'PO-{YYYY}{MM}-{NNN}') ON CONFLICT DO NOTHING;
    INSERT INTO settings (key, value) VALUES ('supplier_api_enabled', 'false') ON CONFLICT DO NOTHING;
    INSERT INTO settings (key, value) VALUES ('supplier_api_name', 'POS Supplier API') ON CONFLICT DO NOTHING;
    INSERT INTO settings (key, value) VALUES ('supplier_api_key', '') ON CONFLICT DO NOTHING;

    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      province TEXT,
      district TEXT,
      village TEXT,
      address TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS province TEXT;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS district TEXT;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS village TEXT;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_person TEXT;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_phone TEXT;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS credit_days INTEGER DEFAULT 0;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS api_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS api_url TEXT;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS api_cust_code TEXT;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS api_hashkey TEXT;
    ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS api_cust_codes JSONB DEFAULT '[]'::jsonb;
    UPDATE suppliers
      SET api_cust_codes = jsonb_build_array(api_cust_code)
      WHERE api_cust_code IS NOT NULL
        AND TRIM(api_cust_code) <> ''
        AND (api_cust_codes IS NULL OR api_cust_codes = '[]'::jsonb);

    CREATE TABLE IF NOT EXISTS supplier_contact_history (
      id SERIAL PRIMARY KEY,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
      contact_person TEXT NOT NULL,
      contact_phone TEXT,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
      supplier_id INTEGER REFERENCES suppliers(id),
      total NUMERIC NOT NULL DEFAULT 0,
      paid NUMERIC NOT NULL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      currency TEXT DEFAULT 'LAK',
      payment_method TEXT DEFAULT 'cash',
      invoice_file TEXT,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'LAK';
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS invoice_file TEXT;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS ref_number TEXT;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'cash';
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS due_date DATE;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 1;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS original_total NUMERIC DEFAULT 0;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS sml_doc_no TEXT;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS sml_doc_date DATE;
    ALTER TABLE purchases ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_sml_doc ON purchases(supplier_id, sml_doc_no) WHERE sml_doc_no IS NOT NULL;

    CREATE TABLE IF NOT EXISTS pending_invoices (
      id SERIAL PRIMARY KEY,
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
      cust_code TEXT,
      doc_no TEXT NOT NULL,
      doc_date DATE,
      sale_code TEXT,
      items JSONB DEFAULT '[]'::jsonb,
      header JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (supplier_id, doc_no)
    );
    ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS header JSONB;
    ALTER TABLE pending_invoices ADD COLUMN IF NOT EXISTS purchase_id INTEGER;

    CREATE TABLE IF NOT EXISTS purchase_items (
      id SERIAL PRIMARY KEY,
      purchase_id INTEGER REFERENCES purchases(id),
      product_id INTEGER REFERENCES products(id),
      quantity INTEGER NOT NULL,
      cost_price NUMERIC NOT NULL
    );

    CREATE TABLE IF NOT EXISTS debt_payments (
      id SERIAL PRIMARY KEY,
      purchase_id INTEGER REFERENCES purchases(id),
      amount NUMERIC NOT NULL,
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE debt_payments ADD COLUMN IF NOT EXISTS payment_number TEXT;
    ALTER TABLE debt_payments ADD COLUMN IF NOT EXISTS payment_date DATE;
    ALTER TABLE debt_payments ADD COLUMN IF NOT EXISTS bill_number TEXT;
    ALTER TABLE debt_payments ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'LAK';
    ALTER TABLE debt_payments ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 1;
    ALTER TABLE debt_payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
    ALTER TABLE debt_payments ADD COLUMN IF NOT EXISTS attachment TEXT;

    CREATE TABLE IF NOT EXISTS customer_debt_payments (
      id SERIAL PRIMARY KEY,
      order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
      payment_number TEXT,
      payment_date DATE DEFAULT CURRENT_DATE,
      amount NUMERIC NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_customer_debt_payments_order ON customer_debt_payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_customer_debt_payments_date ON customer_debt_payments(payment_date DESC);

    CREATE TABLE IF NOT EXISTS promotions (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'percent',
      value NUMERIC NOT NULL DEFAULT 0,
      product_id INTEGER REFERENCES products(id),
      category VARCHAR(100),
      start_date DATE,
      end_date DATE,
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(
    "INSERT INTO settings (key, value) VALUES ('lao_locations', $1) ON CONFLICT DO NOTHING",
    [JSON.stringify(defaultLocations)]
  );

  const products = [
    { code: 'PVC-001', name: 'ທໍ່ PVC 1/2"', cat: 'ທໍ່ນ້ຳ', brand: 'Thai Pipe', cost: 10000, sell: 15000, qty: 200, unit: 'ທ່ອນ', supplier: 'ບໍລິສັດ ທໍ່ໄທ' },
    { code: 'PVC-002', name: 'ທໍ່ PVC 3/4"', cat: 'ທໍ່ນ້ຳ', brand: 'Thai Pipe', cost: 15000, sell: 22000, qty: 150, unit: 'ທ່ອນ', supplier: 'ບໍລິສັດ ທໍ່ໄທ' },
    { code: 'PVC-003', name: 'ທໍ່ PVC 1"', cat: 'ທໍ່ນ້ຳ', brand: 'Thai Pipe', cost: 25000, sell: 35000, qty: 120, unit: 'ທ່ອນ', supplier: 'ບໍລິສັດ ທໍ່ໄທ' },
    { code: 'PVC-004', name: 'ທໍ່ PVC 2"', cat: 'ທໍ່ນ້ຳ', brand: 'Thai Pipe', cost: 40000, sell: 55000, qty: 80, unit: 'ທ່ອນ', supplier: 'ບໍລິສັດ ທໍ່ໄທ' },
    { code: 'PPR-001', name: 'ທໍ່ PPR 1/2"', cat: 'ທໍ່ນ້ຳ', brand: 'PPR Plus', cost: 18000, sell: 25000, qty: 100, unit: 'ທ່ອນ', supplier: 'ຮ້ານ PPR ລາວ' },
    { code: 'PPR-002', name: 'ທໍ່ PPR 3/4"', cat: 'ທໍ່ນ້ຳ', brand: 'PPR Plus', cost: 25000, sell: 35000, qty: 80, unit: 'ທ່ອນ', supplier: 'ຮ້ານ PPR ລາວ' },
    { code: 'STL-001', name: 'ທໍ່ເຫລັກ 1/2"', cat: 'ທໍ່ນ້ຳ', brand: 'Steel Pro', cost: 32000, sell: 45000, qty: 60, unit: 'ທ່ອນ', supplier: 'ບໍລິສັດ ເຫລັກລາວ' },
    { code: 'STL-002', name: 'ທໍ່ເຫລັກ 3/4"', cat: 'ທໍ່ນ້ຳ', brand: 'Steel Pro', cost: 48000, sell: 65000, qty: 50, unit: 'ທ່ອນ', supplier: 'ບໍລິສັດ ເຫລັກລາວ' },
    { code: 'FAU-001', name: 'ກັອກນ້ຳອ່າງລ້າງມື', cat: 'ກັອກນ້ຳ', brand: 'COTTO', cost: 85000, sell: 120000, qty: 30, unit: 'ອັນ', supplier: 'COTTO Laos' },
    { code: 'FAU-002', name: 'ກັອກນ້ຳອ່າງລ້າງຈານ', cat: 'ກັອກນ້ຳ', brand: 'COTTO', cost: 110000, sell: 150000, qty: 25, unit: 'ອັນ', supplier: 'COTTO Laos' },
    { code: 'FAU-003', name: 'ກັອກນ້ຳຝັກບົວ', cat: 'ກັອກນ້ຳ', brand: 'COTTO', cost: 130000, sell: 180000, qty: 20, unit: 'ຊຸດ', supplier: 'COTTO Laos' },
    { code: 'FAU-004', name: 'ກັອກນ້ຳສວນ', cat: 'ກັອກນ້ຳ', brand: 'Sanwa', cost: 22000, sell: 35000, qty: 50, unit: 'ອັນ', supplier: 'ຮ້ານ ສັນວາ' },
    { code: 'FAU-005', name: 'ກັອກນ້ຳພລາສຕິກ', cat: 'ກັອກນ້ຳ', brand: 'General', cost: 8000, sell: 15000, qty: 100, unit: 'ອັນ', supplier: 'ຮ້ານ ສັນວາ' },
    { code: 'CON-001', name: 'ຂໍ້ງໍ PVC 1/2"', cat: 'ຂໍ້ຕໍ່', brand: 'Thai Pipe', cost: 1800, sell: 3000, qty: 500, unit: 'ອັນ', supplier: 'ບໍລິສັດ ທໍ່ໄທ' },
    { code: 'CON-002', name: 'ຂໍ້ງໍ PVC 3/4"', cat: 'ຂໍ້ຕໍ່', brand: 'Thai Pipe', cost: 2500, sell: 4000, qty: 400, unit: 'ອັນ', supplier: 'ບໍລິສັດ ທໍ່ໄທ' },
    { code: 'CON-003', name: 'ສາມທາງ PVC 1/2"', cat: 'ຂໍ້ຕໍ່', brand: 'Thai Pipe', cost: 2500, sell: 4000, qty: 400, unit: 'ອັນ', supplier: 'ບໍລິສັດ ທໍ່ໄທ' },
    { code: 'CON-004', name: 'ສາມທາງ PVC 3/4"', cat: 'ຂໍ້ຕໍ່', brand: 'Thai Pipe', cost: 3500, sell: 5500, qty: 300, unit: 'ອັນ', supplier: 'ບໍລິສັດ ທໍ່ໄທ' },
    { code: 'CON-005', name: 'ຂໍ້ຕໍ່ກົງ PVC 1/2"', cat: 'ຂໍ້ຕໍ່', brand: 'Thai Pipe', cost: 1500, sell: 2500, qty: 500, unit: 'ອັນ', supplier: 'ບໍລິສັດ ທໍ່ໄທ' },
    { code: 'CON-006', name: 'ຂໍ້ຕໍ່ກົງ PVC 3/4"', cat: 'ຂໍ້ຕໍ່', brand: 'Thai Pipe', cost: 2200, sell: 3500, qty: 400, unit: 'ອັນ', supplier: 'ບໍລິສັດ ທໍ່ໄທ' },
    { code: 'VLV-001', name: 'ວາວບານ PVC 1/2"', cat: 'ວາວ', brand: 'Thai Pipe', cost: 10000, sell: 15000, qty: 80, unit: 'ອັນ', supplier: 'ບໍລິສັດ ທໍ່ໄທ' },
    { code: 'VLV-002', name: 'ວາວບານ PVC 3/4"', cat: 'ວາວ', brand: 'Thai Pipe', cost: 15000, sell: 22000, qty: 60, unit: 'ອັນ', supplier: 'ບໍລິສັດ ທໍ່ໄທ' },
    { code: 'VLV-003', name: 'ວາວບານທອງ 1/2"', cat: 'ວາວ', brand: 'Brass King', cost: 32000, sell: 45000, qty: 40, unit: 'ອັນ', supplier: 'ບໍລິສັດ ເຫລັກລາວ' },
    { code: 'VLV-004', name: 'ວາວບານທອງ 3/4"', cat: 'ວາວ', brand: 'Brass King', cost: 48000, sell: 65000, qty: 30, unit: 'ອັນ', supplier: 'ບໍລິສັດ ເຫລັກລາວ' },
    { code: 'VLV-005', name: 'ວາວລູກລອຍ 1/2"', cat: 'ວາວ', brand: 'Sanwa', cost: 24000, sell: 35000, qty: 40, unit: 'ອັນ', supplier: 'ຮ້ານ ສັນວາ' },
    { code: 'VLV-006', name: 'ວາວລູກລອຍ 3/4"', cat: 'ວາວ', brand: 'Sanwa', cost: 32000, sell: 45000, qty: 30, unit: 'ອັນ', supplier: 'ຮ້ານ ສັນວາ' },
    { code: 'PMP-001', name: 'ປັ໊ມນ້ຳອັດຕະໂນມັດ 250W', cat: 'ປັ໊ມນ້ຳ', brand: 'Hitachi', cost: 1100000, sell: 1500000, qty: 10, unit: 'ເຄື່ອງ', supplier: 'Hitachi Laos' },
    { code: 'PMP-002', name: 'ປັ໊ມນ້ຳອັດຕະໂນມັດ 370W', cat: 'ປັ໊ມນ້ຳ', brand: 'Hitachi', cost: 1650000, sell: 2200000, qty: 8, unit: 'ເຄື່ອງ', supplier: 'Hitachi Laos' },
    { code: 'PMP-003', name: 'ປັ໊ມນ້ຳບາດານ 1HP', cat: 'ປັ໊ມນ້ຳ', brand: 'Mitsubishi', cost: 2600000, sell: 3500000, qty: 5, unit: 'ເຄື່ອງ', supplier: 'Hitachi Laos' },
    { code: 'PMP-004', name: 'ປັ໊ມນ້ຳຈຸ່ມ', cat: 'ປັ໊ມນ້ຳ', brand: 'Leo', cost: 1300000, sell: 1800000, qty: 6, unit: 'ເຄື່ອງ', supplier: 'ຮ້ານ ລີໂອ' },
    { code: 'OTH-001', name: 'ເທບພັນເກືອກ', cat: 'ອຸປະກອນອື່ນໆ', brand: 'General', cost: 3000, sell: 5000, qty: 200, unit: 'ມ້ວນ', supplier: 'ຮ້ານ ສັນວາ' },
    { code: 'OTH-002', name: 'ກາວ PVC', cat: 'ອຸປະກອນອື່ນໆ', brand: 'Thai Pipe', cost: 9000, sell: 15000, qty: 100, unit: 'ກະປ໋ອງ', supplier: 'ບໍລິສັດ ທໍ່ໄທ' },
    { code: 'OTH-003', name: 'ຊີລິໂຄນ', cat: 'ອຸປະກອນອື່ນໆ', brand: 'Sista', cost: 25000, sell: 35000, qty: 80, unit: 'ຫລອດ', supplier: 'ຮ້ານ ສັນວາ' },
    { code: 'OTH-004', name: 'ປະແຈປັ໊ບ 10"', cat: 'ອຸປະກອນອື່ນໆ', brand: 'Stanley', cost: 62000, sell: 85000, qty: 20, unit: 'ອັນ', supplier: 'ຮ້ານ Stanley' },
    { code: 'OTH-005', name: 'ປະແຈປັ໊ບ 14"', cat: 'ອຸປະກອນອື່ນໆ', brand: 'Stanley', cost: 88000, sell: 120000, qty: 15, unit: 'ອັນ', supplier: 'ຮ້ານ Stanley' },
    { code: 'OTH-006', name: 'ຖັງນ້ຳ 1000L', cat: 'ອຸປະກອນອື່ນໆ', brand: 'DOS', cost: 1800000, sell: 2500000, qty: 10, unit: 'ໃບ', supplier: 'DOS Laos' },
    { code: 'OTH-007', name: 'ຖັງນ້ຳ 2000L', cat: 'ອຸປະກອນອື່ນໆ', brand: 'DOS', cost: 3200000, sell: 4500000, qty: 5, unit: 'ໃບ', supplier: 'DOS Laos' },
  ];

  const existing = await pool.query('SELECT COUNT(*) FROM products');
  if (parseInt(existing.rows[0].count) === 0) {
    for (const p of products) {
      await pool.query(
        `INSERT INTO products (product_code, product_name, barcode, category, brand, cost_price, selling_price, qty_on_hand, unit, supplier_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [p.code, p.name, p.code, p.cat, p.brand, p.cost, p.sell, p.qty, p.unit, p.supplier]
      );
    }
  }

  const categories = ['ທໍ່ນ້ຳ', 'ກັອກນ້ຳ', 'ຂໍ້ຕໍ່', 'ວາວ', 'ປັ໊ມນ້ຳ', 'ອຸປະກອນອື່ນໆ'];
  for (const cat of categories) {
    await pool.query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT DO NOTHING', [cat]);
  }

  const brands = ['Thai Pipe', 'PPR Plus', 'Steel Pro', 'COTTO', 'Sanwa', 'General', 'Brass King', 'Hitachi', 'Mitsubishi', 'Leo', 'Sista', 'Stanley', 'DOS'];
  for (const brand of brands) {
    await pool.query('INSERT INTO brands (name) VALUES ($1) ON CONFLICT DO NOTHING', [brand]);
  }

  const units = ['ອັນ', 'ທ່ອນ', 'ຊຸດ', 'ເຄື່ອງ', 'ມ້ວນ', 'ກະປ໋ອງ', 'ຫລອດ', 'ໃບ'];
  for (const unit of units) {
    await pool.query('INSERT INTO units (name) VALUES ($1) ON CONFLICT DO NOTHING', [unit]);
  }

  const adminPass = crypto.createHash('sha256').update('admin123').digest('hex');
  const cashierPass = crypto.createHash('sha256').update('1234').digest('hex');
  await pool.query(
    `INSERT INTO users (username, password, display_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING`,
    ['admin', adminPass, 'ຜູ້ດູແລລະບົບ', 'admin']
  );
  await pool.query(
    `INSERT INTO users (username, password, display_name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING`,
    ['cashier', cashierPass, 'ພະນັກງານຂາຍ', 'cashier']
  );

  return ok({ message: 'Database initialized successfully' });
});
