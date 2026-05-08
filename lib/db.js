import pg from 'pg';

const { Pool } = pg;

const globalForPg = globalThis;

const pool =
  globalForPg.__pgPool ||
  new Pool({
    user: process.env.PGUSER || 'itdpt',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'pos_db',
    port: parseInt(process.env.PGPORT || '5432', 10),
    password: process.env.PGPASSWORD,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPg.__pgPool = pool;
}

export default pool;
