import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const dir = path.join(process.cwd(), 'backups');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json.gz')) : [];
if (files.length === 0) {
  console.error('No compressed backups found in backups/');
  process.exitCode = 1;
} else {
  for (const name of files) {
    const parsed = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, name))).toString('utf8'));
    if (!parsed?._exported_at || !parsed?.tables || Object.keys(parsed.tables).length === 0) {
      throw new Error(`${name}: invalid backup structure`);
    }
    console.log(`${name}: OK (${Object.keys(parsed.tables).length} tables)`);
  }
}
