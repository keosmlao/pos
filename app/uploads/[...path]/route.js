export const dynamic = 'force-dynamic';

import { readFile, stat } from 'fs/promises';
import path from 'path';

// ສົ່ງໄຟລ໌ທີ່ອັບໂຫຼດ (ໃບບິນແນບ, ໂລໂກ້, ຮູບສິນຄ້າ) ອອກຈາກແຜ່ນຈານໂດຍກົງ
//
// ເປັນຫຍັງຕ້ອງມີ route ນີ້:
//   Next.js ຮັບໃຊ້ໂຟນເດີ public/ ຕາມລາຍການທີ່ມີ "ຕອນ build" ເທົ່ານັ້ນ —
//   ໄຟລ໌ທີ່ອັບໂຫຼດຫຼັງ build ຈະຄືນ 404 ຈົນກວ່າຈະ build ໃໝ່.
//   route ນີ້ອ່ານຈາກແຜ່ນຈານທຸກຄັ້ງທີ່ຮ້ອງຂໍ ຈຶ່ງເຫັນໄຟລ໌ໃໝ່ທັນທີ.
//
// URL ຄືເກົ່າ (/uploads/xxx) ຈຶ່ງບໍ່ຕ້ອງແກ້ຂໍ້ມູນເກົ່າໃນຖານຂໍ້ມູນ.

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.heic': 'image/heic',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv',
  '.txt': 'text/plain; charset=utf-8',
};

export async function GET(_request, { params }) {
  const { path: parts = [] } = await params;
  const rel = parts.join('/');

  // ກັນການໄຕ່ອອກນອກໂຟນເດີ (../../etc/passwd)
  const target = path.resolve(UPLOAD_DIR, rel);
  if (!target.startsWith(UPLOAD_DIR + path.sep)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const info = await stat(target);
    if (!info.isFile()) return new Response('Not found', { status: 404 });

    const data = await readFile(target);
    const ext = path.extname(target).toLowerCase();
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': String(info.size),
        // ຊື່ໄຟລ໌ມີ timestamp ຢູ່ແລ້ວ ຈຶ່ງ cache ໄດ້ຍາວ
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
