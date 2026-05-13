export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { ensureAuditLogsSchema } from '@/lib/migrations';

export const GET = handle(async (request) => {
  await ensureAuditLogsSchema();
  const { from, to, action, entity_type, user_id, limit = '200' } = getQuery(request);
  const lim = Math.max(1, Math.min(1000, parseInt(limit, 10) || 200));
  const where = [];
  const params = [];
  if (from) { params.push(from); where.push(`created_at::date >= $${params.length}`); }
  if (to) { params.push(to); where.push(`created_at::date <= $${params.length}`); }
  if (action) { params.push(`%${action}%`); where.push(`action ILIKE $${params.length}`); }
  if (entity_type) { params.push(entity_type); where.push(`entity_type = $${params.length}`); }
  if (user_id) { params.push(Number(user_id)); where.push(`user_id = $${params.length}`); }
  params.push(lim);

  const result = await pool.query(
    `SELECT id, user_id, username, role, action, entity_type, entity_id, summary, payload, ip, user_agent, created_at
     FROM audit_logs
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY id DESC
     LIMIT $${params.length}`,
    params
  );

  const facetsRes = await pool.query(
    `SELECT entity_type, COUNT(*)::int AS n FROM audit_logs
     ${where.length ? `WHERE ${where.slice(0, where.length).join(' AND ')}` : ''}
     GROUP BY entity_type ORDER BY n DESC LIMIT 20`,
    params.slice(0, params.length - 1)
  );

  return ok({ logs: result.rows, facets: { entity_types: facetsRes.rows } });
});
