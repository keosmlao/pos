import pool from '@/lib/db';
import { handle, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const started = Date.now();
  await pool.query('SELECT 1');
  return ok({ status: 'ok', database: 'ok', latency_ms: Date.now() - started });
});
