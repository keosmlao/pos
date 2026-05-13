// Real-time event bus for the mobile app's notification inbox.
//
// publishEvent() inserts a row into app_events and broadcasts to every
// connected SSE subscriber. /api/events/stream subscribes; /api/events/recent
// reads from the DB. Subscriber set lives on globalThis so HMR doesn't lose
// connections in dev.

import pool from './db';
import { ensureAppEventsSchema } from './migrations';

const g = globalThis;
if (!g.__appEventSubscribers) g.__appEventSubscribers = new Set();
const subscribers = g.__appEventSubscribers;

export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export async function publishEvent({ type, title, body, data, actor }) {
  try {
    await ensureAppEventsSchema();
    const result = await pool.query(
      `INSERT INTO app_events (type, title, body, data, actor_username)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING id, type, title, body, data, actor_username, created_at, read_at`,
      [
        String(type),
        String(title),
        body ? String(body) : null,
        data ? JSON.stringify(data) : null,
        actor || null,
      ]
    );
    const event = result.rows[0];
    for (const cb of subscribers) {
      try { cb(event); } catch {}
    }
    return event;
  } catch (e) {
    console.error('publishEvent error:', e.message);
    return null;
  }
}

export async function recentEvents({ since, limit = 50 } = {}) {
  await ensureAppEventsSchema();
  const params = [];
  let where = '';
  if (since != null) {
    params.push(Number(since));
    where = `WHERE id > $${params.length}`;
  }
  params.push(Math.min(Math.max(Number(limit) || 50, 1), 200));
  const result = await pool.query(
    `SELECT id, type, title, body, data, actor_username, created_at, read_at
     FROM app_events
     ${where}
     ORDER BY id DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows;
}

export async function markRead(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  await ensureAppEventsSchema();
  const numericIds = ids.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (numericIds.length === 0) return 0;
  const result = await pool.query(
    `UPDATE app_events SET read_at = NOW()
     WHERE id = ANY($1::bigint[]) AND read_at IS NULL`,
    [numericIds]
  );
  return result.rowCount;
}

export async function markAllRead() {
  await ensureAppEventsSchema();
  const result = await pool.query(
    `UPDATE app_events SET read_at = NOW() WHERE read_at IS NULL`
  );
  return result.rowCount;
}

export async function unreadCount() {
  await ensureAppEventsSchema();
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM app_events WHERE read_at IS NULL`
  );
  return result.rows[0]?.n || 0;
}
