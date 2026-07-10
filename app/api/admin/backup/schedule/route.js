export const dynamic = 'force-dynamic';

import { handle, ok, readJson } from '@/lib/api';
import { getBackupSettings, updateBackupSettings, listBackupFiles, runBackup } from '@/lib/autoBackup';

export const GET = handle(async () => {
  const settings = await getBackupSettings();
  return ok({ settings, files: listBackupFiles() });
});

export const PUT = handle(async (request) => {
  const body = await readJson(request);
  const settings = await updateBackupSettings(body);
  return ok({ settings, files: listBackupFiles() });
});

// ແລ່ນ backup ດຽວນີ້
export const POST = handle(async () => {
  const result = await runBackup();
  const settings = await getBackupSettings();
  return ok({ ...result, settings, files: listBackupFiles() });
});
