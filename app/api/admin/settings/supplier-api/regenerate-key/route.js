export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { handle, ok } from '@/lib/api';
import { setSetting } from '@/lib/settings';

export const POST = handle(async () => {
  const apiKey = crypto.randomBytes(24).toString('hex');
  await setSetting('supplier_api_key', apiKey);
  return ok({ api_key: apiKey });
});