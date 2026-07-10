import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import pg from 'pg';

const targetDatabase = process.env.POS_RESTORE_DATABASE;
if (!targetDatabase) throw new Error('Set POS_RESTORE_DATABASE to a disposable rehearsal database');
if (targetDatabase === process.env.PGDATABASE) throw new Error('Refusing to restore into the live POS database');

const dir = path.join(process.cwd(), 'backups');
const requested = process.argv[2];
const file = requested
  ? path.resolve(requested)
  : fs.readdirSync(dir).filter((name) => name.endsWith('.json.gz')).sort().map((name) => path.join(dir, name)).at(-1);
if (!file || !fs.existsSync(file)) throw new Error('No backup file found');

const backup = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
if (!backup?.tables || Object.keys(backup.tables).length === 0) throw new Error('Invalid backup');

const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: targetDatabase,
});
const client = await pool.connect();
const quote = (name) => `"${name.replaceAll('"', '""')}"`;

try {
  const tables = Object.keys(backup.tables);
  if (tables.some((name) => !/^[a-z][a-z0-9_]*$/.test(name))) throw new Error('Unsafe table name in backup');
  const existing = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)`, [tables]);
  if (existing.rowCount !== tables.length) {
    const found = new Set(existing.rows.map((row) => row.tablename));
    throw new Error(`Target schema is missing: ${tables.filter((name) => !found.has(name)).join(', ')}`);
  }
  const columnTypesResult = await client.query(
    `SELECT table_name, column_name, data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [tables]
  );
  const columnTypes = new Map(columnTypesResult.rows.map((row) => [
    `${row.table_name}.${row.column_name}`,
    row.data_type,
  ]));

  await client.query('BEGIN');
  await client.query(`TRUNCATE ${tables.map(quote).join(', ')} RESTART IDENTITY CASCADE`);
  for (const table of tables) {
    const rows = backup.tables[table];
    if (!Array.isArray(rows)) throw new Error(`${table}: backup rows are invalid`);
    if (rows.length === 0) continue;
    const columns = Object.keys(rows[0]);
    if (columns.length === 0 || columns.some((name) => !/^[a-z][a-z0-9_]*$/.test(name))) continue;
    for (let start = 0; start < rows.length; start += 100) {
      const chunk = rows.slice(start, start + 100);
      const values = [];
      const tuples = chunk.map((row) => {
        const placeholders = columns.map((name) => {
          const value = row[name];
          const type = columnTypes.get(`${table}.${name}`);
          values.push((type === 'json' || type === 'jsonb') && value != null && typeof value === 'object'
            ? JSON.stringify(value)
            : value);
          return `$${values.length}`;
        });
        return `(${placeholders.join(', ')})`;
      });
      await client.query(
        `INSERT INTO ${quote(table)} (${columns.map(quote).join(', ')}) VALUES ${tuples.join(', ')}`,
        values
      );
    }
  }
  await client.query('COMMIT');
  console.log(`${path.basename(file)} restored successfully into ${targetDatabase} (${tables.length} tables)`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
