import crypto from 'crypto';
import pool from './db';

// Session ເກັບໃນຖານຂໍ້ມູນ + cookie httpOnly
// ບໍ່ໃສ່ Secure flag ເພາະຮ້ານໃຊ້ຜ່ານ http ໃນ LAN — ຖ້າຍ້າຍໄປ https ຄວນເພີ່ມ

const SESSION_COOKIE = 'pos_session';
const SESSION_DAYS = 30;

let sessionsMigrated = false;
export async function ensureSessionsSchema() {
  if (sessionsMigrated) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP NOT NULL
      )
    `);
    sessionsMigrated = true;
  } catch (e) {
    console.error('sessions migration error:', e.message); throw e;
  }
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export async function createSession(userId) {
  await ensureSessionsSchema();
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' days')::interval)`,
    [hashToken(token), userId, SESSION_DAYS]
  );
  pool.query('DELETE FROM sessions WHERE expires_at < NOW()').catch(() => {});
  return token;
}

export async function getSessionUser(request) {
  const token = request?.cookies?.get?.(SESSION_COOKIE)?.value;
  if (!token) return null;
  await ensureSessionsSchema();
  const result = await pool.query(
    `SELECT u.id, u.username, u.display_name, u.role, COALESCE(u.permissions, '{}'::jsonb) AS permissions
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
    [hashToken(token)]
  );
  return result.rows[0] || null;
}

export async function destroySession(request) {
  const token = request?.cookies?.get?.(SESSION_COOKIE)?.value;
  if (!token) return;
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]).catch(() => {});
}

export function sessionCookie(token) {
  const secure = process.env.NODE_ENV === 'production' && process.env.POS_COOKIE_SECURE !== 'false' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' && process.env.POS_COOKIE_SECURE !== 'false' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}
