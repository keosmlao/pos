export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, getQuery } from '@/lib/api';
import { EXPORTABLE_TABLES, dumpAllTables } from '@/lib/backupTables';

export const GET = handle(async (request) => {
  const { table } = getQuery(request);

  if (table) {
    if (!EXPORTABLE_TABLES[table]) {
      return new Response(JSON.stringify({ error: 'Unknown table' }), { status: 400 });
    }
    const r = await pool.query(EXPORTABLE_TABLES[table]);
    const csv = rowsToCsv(r.rows);
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${table}_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  // Full backup as JSON
  const exportData = await dumpAllTables(pool);

  return new Response(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="pos-backup_${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});

function rowsToCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const cols = Object.keys(rows[0]);
  const escape = (v) => {
    if (v == null) return '';
    if (typeof v === 'object') v = JSON.stringify(v);
    const s = String(v);
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [
    cols.join(','),
    ...rows.map(r => cols.map(c => escape(r[c])).join(',')),
  ].join('\n');
}
