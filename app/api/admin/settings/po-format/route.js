export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson } from '@/lib/api';

export const GET = handle(async () => {
  const result = await pool.query("SELECT value FROM settings WHERE key = 'po_format'");
  const format = result.rows.length > 0 ? result.rows[0].value : 'PO-{YYYY}{MM}-{NNN}';
  return ok({ format });
});

export const PUT = handle(async (request) => {
  const { format } = await readJson(request);
  await pool.query(
    "INSERT INTO settings (key, value) VALUES ('po_format', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
    [format]
  );
  return ok({ format });
});