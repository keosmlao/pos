export const dynamic = 'force-dynamic';

import { stat, mkdir, writeFile, rename, unlink } from 'fs/promises';
import path from 'path';
import { handle, ok, fail } from '@/lib/api';

// ຕົວຕິດຕັ້ງແອັບ Windows — ອັບຂຶ້ນມາຈາກໜ້າ "ດາວໂຫຼດແອັບ" ແທນການ copy ໄຟລ໌ໃສ່ server ດ້ວຍມື
const DOWNLOAD_DIR = path.join(process.cwd(), 'public', 'downloads');
const FILE_NAME = 'SMLAO-POS-Setup.exe';
const MAX_BYTES = 300 * 1024 * 1024;

async function installerInfo() {
  try {
    const s = await stat(path.join(DOWNLOAD_DIR, FILE_NAME));
    return { available: true, size: s.size, updatedAt: s.mtime.toISOString() };
  } catch {
    return { available: false, size: null, updatedAt: null };
  }
}

export const GET = handle(async () => ok(await installerInfo()));

export const POST = handle(async (request) => {
  // ໄຟລ໌ນີ້ຖືກເອົາໄປຕິດຕັ້ງທຸກເຄື່ອງຈຸດຂາຍ — ໃຫ້ສະເພາະ admin ອັບໄດ້
  if (request.sessionUser?.role !== 'admin') {
    return fail(403, 'ສະເພາະ admin ເທົ່ານັ້ນທີ່ອັບໂຫຼດຕົວຕິດຕັ້ງໄດ້');
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') return fail(400, 'ບໍ່ພົບໄຟລ໌');
  if (!/\.exe$/i.test(file.name || '')) return fail(400, 'ຕ້ອງເປັນໄຟລ໌ .exe');
  if (file.size > MAX_BYTES) {
    return fail(400, `ໄຟລ໌ໃຫຍ່ເກີນໄປ (ສູງສຸດ ${Math.round(MAX_BYTES / 1024 / 1024)} MB)`);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  // ໂປຣແກຣມ Windows (PE) ຂຶ້ນຕົ້ນດ້ວຍ "MZ" ສະເໝີ — ກັນອັບໄຟລ໌ຜິດປະເພດ
  if (buf.length < 2 || buf[0] !== 0x4d || buf[1] !== 0x5a) {
    return fail(400, 'ໄຟລ໌ນີ້ບໍ່ແມ່ນໂປຣແກຣມ Windows (.exe)');
  }

  await mkdir(DOWNLOAD_DIR, { recursive: true });
  // ຂຽນໃສ່ໄຟລ໌ຊົ່ວຄາວກ່ອນແລ້ວ rename — ກັນຄົນດາວໂຫຼດໄຟລ໌ທີ່ຂຽນຍັງບໍ່ທັນຄົບ
  const tmp = path.join(DOWNLOAD_DIR, `.${FILE_NAME}.uploading`);
  try {
    await writeFile(tmp, buf);
    await rename(tmp, path.join(DOWNLOAD_DIR, FILE_NAME));
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }

  return ok(await installerInfo());
});
