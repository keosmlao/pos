import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

export async function saveUpload({ file, prefix, maxBytes, mimeStartsWith }) {
  if (!file || typeof file === 'string') {
    return { error: 'No file uploaded', status: 400 };
  }
  if (maxBytes && file.size > maxBytes) {
    return { error: `File too large (max ${maxBytes} bytes)`, status: 400 };
  }
  if (mimeStartsWith && !String(file.type || '').startsWith(mimeStartsWith)) {
    return { error: 'ອະນຸຍາດສະເພາະໄຟລ໌ຮູບພາບ', status: 400 };
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name || '') || '';
  const filename = `${prefix}_${Date.now()}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buf);
  return { filename, path: `/uploads/${filename}` };
}
