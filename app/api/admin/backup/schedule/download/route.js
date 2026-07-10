export const dynamic = 'force-dynamic';

import fs from 'fs';
import path from 'path';
import { handle, getQuery, fail } from '@/lib/api';
import { BACKUP_DIR } from '@/lib/autoBackup';

export const GET = handle(async (request) => {
  const { file } = getQuery(request);
  // ອະນຸຍາດສະເພາະຊື່ໄຟລ໌ backup ທີ່ຖືກຮູບແບບ — ກັນ path traversal
  if (!/^pos-backup_[\w.-]+\.json\.gz$/.test(String(file || ''))) {
    return fail(400, 'invalid file');
  }
  const full = path.join(BACKUP_DIR, file);
  if (!fs.existsSync(full)) return fail(404, 'file not found');
  return new Response(fs.readFileSync(full), {
    headers: {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${file}"`,
    },
  });
});
