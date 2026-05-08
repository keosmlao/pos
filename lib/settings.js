import pool from './db';

export async function getSetting(key, fallback = '') {
  const result = await pool.query('SELECT value FROM settings WHERE key = $1', [key]);
  return result.rows.length > 0 ? result.rows[0].value : fallback;
}

export async function setSetting(key, value) {
  await pool.query(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
    [key, String(value)]
  );
}
