import pool from './db';
import defaultLocations from '@/data/laoLocations';

export function normalizeLocations(input) {
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;

  for (const [provinceRaw, districtsRaw] of Object.entries(input)) {
    const province = String(provinceRaw || '').trim();
    if (!province || !districtsRaw || typeof districtsRaw !== 'object' || Array.isArray(districtsRaw)) continue;

    const districts = {};
    for (const [districtRaw, villagesRaw] of Object.entries(districtsRaw)) {
      const district = String(districtRaw || '').trim();
      if (!district) continue;

      const seen = new Set();
      const villages = (Array.isArray(villagesRaw) ? villagesRaw : [])
        .map(v => String(v || '').trim())
        .filter(Boolean)
        .filter(v => {
          if (seen.has(v)) return false;
          seen.add(v);
          return true;
        });
      districts[district] = villages;
    }

    out[province] = districts;
  }
  return out;
}

async function ensureLocationTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS provinces (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS districts (
      id SERIAL PRIMARY KEY,
      province_id INTEGER NOT NULL REFERENCES provinces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      UNIQUE (province_id, name)
    );

    CREATE TABLE IF NOT EXISTS villages (
      id SERIAL PRIMARY KEY,
      district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      UNIQUE (district_id, name)
    );
  `);
}

async function readOldSettingsLocations() {
  try {
    const result = await pool.query(`SELECT value FROM settings WHERE key = 'lao_locations' LIMIT 1`);
    if (!result.rows.length) return null;
    const parsed = JSON.parse(result.rows[0].value);
    const normalized = normalizeLocations(parsed);
    return Object.keys(normalized).length ? normalized : null;
  } catch {
    return null;
  }
}

async function importLocations(locations) {
  const normalized = normalizeLocations(locations);
  if (!Object.keys(normalized).length) return normalized;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM villages');
    await client.query('DELETE FROM districts');
    await client.query('DELETE FROM provinces');

    for (const [province, districts] of Object.entries(normalized)) {
      const provinceRes = await client.query(
        'INSERT INTO provinces (name) VALUES ($1) RETURNING id',
        [province]
      );
      const provinceId = provinceRes.rows[0].id;

      for (const [district, villages] of Object.entries(districts)) {
        const districtRes = await client.query(
          'INSERT INTO districts (province_id, name) VALUES ($1, $2) RETURNING id',
          [provinceId, district]
        );
        const districtId = districtRes.rows[0].id;

        for (const village of villages) {
          await client.query(
            'INSERT INTO villages (district_id, name) VALUES ($1, $2)',
            [districtId, village]
          );
        }
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return normalized;
}

async function queryLocationsFromTables() {
  const provinces = await pool.query('SELECT id, name FROM provinces ORDER BY name');
  const out = {};

  for (const province of provinces.rows) {
    out[province.name] = {};
    const districts = await pool.query(
      'SELECT id, name FROM districts WHERE province_id = $1 ORDER BY name',
      [province.id]
    );
    for (const district of districts.rows) {
      const villages = await pool.query(
        'SELECT name FROM villages WHERE district_id = $1 ORDER BY name',
        [district.id]
      );
      out[province.name][district.name] = villages.rows.map(v => v.name);
    }
  }

  return out;
}

export async function getLocations() {
  await ensureLocationTables();

  const locations = await queryLocationsFromTables();
  if (Object.keys(locations).length) return locations;

  const old = await readOldSettingsLocations();
  if (old) return importLocations(old);

  return importLocations(defaultLocations);
}

export async function setLocations(locations) {
  await ensureLocationTables();
  return importLocations(locations);
}

