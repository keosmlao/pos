import pool from './db';

const migrations = [
  {
    version: 1,
    name: 'protect_non_negative_inventory_and_line_values',
    sql: `
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_qty_nonnegative') THEN
          ALTER TABLE products ADD CONSTRAINT products_qty_nonnegative CHECK (qty_on_hand >= 0) NOT VALID;
        END IF;
        IF to_regclass('public.product_variants') IS NOT NULL AND
           NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_qty_nonnegative') THEN
          ALTER TABLE product_variants ADD CONSTRAINT product_variants_qty_nonnegative CHECK (qty_on_hand >= 0) NOT VALID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_quantity_positive') THEN
          ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_positive CHECK (quantity > 0) NOT VALID;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_items_price_nonnegative') THEN
          ALTER TABLE order_items ADD CONSTRAINT order_items_price_nonnegative CHECK (price >= 0) NOT VALID;
        END IF;
      END $$;
    `,
  },
];

export async function runSchemaMigrations() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [730_526_001]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    const base = await client.query(`SELECT to_regclass('public.products') AS products,
      to_regclass('public.order_items') AS order_items`);
    if (!base.rows[0]?.products || !base.rows[0]?.order_items) return;
    for (const migration of migrations) {
      const done = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [migration.version]);
      if (done.rowCount) continue;
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [migration.version, migration.name]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [730_526_001]).catch(() => {});
    client.release();
  }
}
