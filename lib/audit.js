// Audit log helper.
//
// The frontend sends actor info via headers:
//   x-actor-id, x-actor-username, x-actor-role
// (Set by lib/api/audit-fetch.js on the client; this is best-effort and not a
// security boundary — the API still trusts its own permission checks.)

import pool from './db';
import { ensureAuditLogsSchema } from './migrations';

const MAX_PAYLOAD = 16 * 1024;

export function extractActor(request) {
  const h = request?.headers;
  if (!h) return {};
  const idRaw = h.get('x-actor-id');
  return {
    user_id: idRaw ? Number(idRaw) || null : null,
    username: h.get('x-actor-username') || null,
    role: h.get('x-actor-role') || null,
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null,
    user_agent: h.get('user-agent') || null,
  };
}

function truncPayload(payload) {
  if (payload == null) return null;
  try {
    const str = JSON.stringify(payload);
    if (str.length <= MAX_PAYLOAD) return str;
    return JSON.stringify({ _truncated: true, preview: str.slice(0, MAX_PAYLOAD) });
  } catch {
    return null;
  }
}

// Write a single audit entry. Best-effort: never throws.
// `client` is optional — pass a transactional client to write within the
// same transaction; otherwise the pool is used.
export async function logAudit(client, entry) {
  try {
    await ensureAuditLogsSchema();
    const q = client || pool;
    const {
      actor = {},
      action,
      entity_type = null,
      entity_id = null,
      summary = null,
      payload = null,
    } = entry || {};
    if (!action) return;
    await q.query(
      `INSERT INTO audit_logs (user_id, username, role, action, entity_type, entity_id, summary, payload, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
      [
        actor.user_id || null,
        actor.username || null,
        actor.role || null,
        String(action),
        entity_type,
        entity_id != null ? String(entity_id) : null,
        summary,
        truncPayload(payload),
        actor.ip || null,
        actor.user_agent || null,
      ]
    );
  } catch (e) {
    console.error('audit log error:', e.message);
  }
}
