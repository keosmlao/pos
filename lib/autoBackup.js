import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import pool from './db';
import { dumpAllTables } from './backupTables';

// Backup ອັດຕະໂນມັດໃນຕົວແອັບ: ຕັ້ງເວລາໄດ້ໃນໜ້າ admin/backup
// ໄຟລ໌ເກັບທີ່ <project>/backups/*.json.gz

export const BACKUP_DIR = path.join(process.cwd(), 'backups');

let settingsMigrated = false;
export async function ensureBackupSettingsSchema() {
  if (settingsMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS backup_settings (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        enabled BOOLEAN NOT NULL DEFAULT false,
        backup_time TEXT NOT NULL DEFAULT '20:00',
        keep_count INTEGER NOT NULL DEFAULT 30,
        last_run_at TIMESTAMP,
        last_status TEXT
      )
    `);
    await pool.query(`INSERT INTO backup_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
    // key ຂອງຮອບທີ່ແລ່ນຫຼ້າສຸດ (ຄິດຈາກໂມງເຄື່ອງ server) — ກັນບັນຫາ timezone DB ≠ ເຄື່ອງ
    await pool.query(`ALTER TABLE backup_settings ADD COLUMN IF NOT EXISTS last_run_key TEXT`);
    settingsMigrated = true;
  } catch (e) {
    console.error('backup_settings migration error:', e.message); throw e;
  }
}

export async function getBackupSettings() {
  await ensureBackupSettingsSchema();
  const r = await pool.query('SELECT * FROM backup_settings WHERE id = 1');
  return r.rows[0];
}

export async function updateBackupSettings({ enabled, backup_time, keep_count }) {
  await ensureBackupSettingsSchema();
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(backup_time || '')) ? backup_time : '20:00';
  const keep = Math.max(3, Math.min(365, Number(keep_count) || 30));
  const r = await pool.query(
    `UPDATE backup_settings SET enabled = $1, backup_time = $2, keep_count = $3 WHERE id = 1 RETURNING *`,
    [!!enabled, time, keep]
  );
  return r.rows[0];
}

export function listBackupFiles() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => /^pos-backup_[\w.-]+\.json\.gz$/.test(f))
    .map((f) => {
      const st = fs.statSync(path.join(BACKUP_DIR, f));
      return { name: f, size: st.size, created_at: st.mtime.toISOString() };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function runBackup() {
  await ensureBackupSettingsSchema();
  try {
    const data = await dumpAllTables(pool);
    const gz = zlib.gzipSync(JSON.stringify(data));
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
    const file = path.join(BACKUP_DIR, `pos-backup_${stamp}.json.gz`);
    const tempFile = `${file}.tmp`;
    fs.writeFileSync(tempFile, gz, { mode: 0o600 });
    const verified = JSON.parse(zlib.gunzipSync(fs.readFileSync(tempFile)).toString('utf8'));
    if (!verified?._exported_at || !verified?.tables || Object.keys(verified.tables).length === 0) {
      throw new Error('Backup integrity verification failed');
    }
    fs.renameSync(tempFile, file);

    const settings = await getBackupSettings();
    const files = listBackupFiles();
    for (const old of files.slice(settings.keep_count)) {
      try { fs.unlinkSync(path.join(BACKUP_DIR, old.name)); } catch {}
    }

    await pool.query(`UPDATE backup_settings SET last_run_at = NOW(), last_status = $1 WHERE id = 1`,
      [`OK ${path.basename(file)} (${(gz.length / 1024).toFixed(0)} KB)`]);
    return { ok: true, verified: true, table_count: Object.keys(verified.tables).length, file: path.basename(file), size: gz.length };
  } catch (e) {
    await pool.query(`UPDATE backup_settings SET last_run_at = NOW(), last_status = $1 WHERE id = 1`,
      [`ERROR: ${e.message}`]).catch(() => {});
    return { ok: false, error: e.message };
  }
}

// ກວດທຸກນາທີ: ຖ້າຮອດເວລາທີ່ຕັ້ງ ແລະ ມື້ນີ້ຍັງບໍ່ໄດ້ແລ່ນ → ແລ່ນ
// (ກໍລະນີ server ເປີດຊ້າກວ່າເວລານັດ ກໍຈະແລ່ນຊົດເຊີຍທັນທີ)
async function tick() {
  try {
    const s = await getBackupSettings();
    if (!s?.enabled) return;
    const now = new Date();
    const [h, m] = s.backup_time.split(':').map(Number);
    const scheduled = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
    if (now < scheduled) return;
    // ປຽບທຽບດ້ວຍ key ຮອບນັດ (ໂມງເຄື່ອງ server ຢ່າງດຽວ) — ບໍ່ອີງ last_run_at
    // ເພາະ NOW() ຂອງ DB ອາດຢູ່ຄົນລະ timezone ກັບເຄື່ອງ ເຮັດໃຫ້ແລ່ນຊ້ຳ/ຂ້າມຮອບ
    const pad = (n) => String(n).padStart(2, '0');
    const runKey = `${scheduled.getFullYear()}-${pad(scheduled.getMonth() + 1)}-${pad(scheduled.getDate())} ${s.backup_time}`;
    if (s.last_run_key === runKey) return;
    console.log(`[auto-backup] running scheduled backup (${s.backup_time})`);
    await pool.query(`UPDATE backup_settings SET last_run_key = $1 WHERE id = 1`, [runKey]).catch(() => {});
    const result = await runBackup();
    console.log('[auto-backup]', result.ok ? `done: ${result.file}` : `failed: ${result.error}`);
  } catch (e) {
    console.error('[auto-backup] tick error:', e.message);
  }
}

export function startBackupScheduler() {
  const g = globalThis;
  if (g.__posBackupScheduler) return;
  g.__posBackupScheduler = setInterval(tick, 60 * 1000);
  g.__posBackupScheduler.unref?.();
  tick();
  console.log('[auto-backup] scheduler started');
}
