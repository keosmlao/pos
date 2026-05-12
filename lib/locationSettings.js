import pool from './db';
import defaultLocations from '@/data/laoLocations';

const SETTING_KEY = 'lao_locations';

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

async function ensureSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
}

export async function getLocations() {
  await ensureSettingsTable();
  const result = await pool.query('SELECT value FROM settings WHERE key = $1', [SETTING_KEY]);
  if (!result.rows.length) return defaultLocations;

  try {
    const parsed = JSON.parse(result.rows[0].value);
    const normalized = normalizeLocations(parsed);
    return Object.keys(normalized).length ? normalized : defaultLocations;
  } catch {
    return defaultLocations;
  }
}

export async function setLocations(locations) {
  await ensureSettingsTable();
  const normalized = normalizeLocations(locations);
  await pool.query(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
    [SETTING_KEY, JSON.stringify(normalized)]
  );
  return normalized;
}

