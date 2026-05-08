export const dynamic = 'force-dynamic';

import { handle, ok, readJson } from '@/lib/api';
import { getSetting, setSetting } from '@/lib/settings';

export const GET = handle(async () => {
  const [enabled, name, apiKey] = await Promise.all([
    getSetting('supplier_api_enabled', 'false'),
    getSetting('supplier_api_name', 'POS Supplier API'),
    getSetting('supplier_api_key', ''),
  ]);

  return ok({
    enabled: enabled === 'true',
    name,
    api_key: apiKey,
  });
});

export const PUT = handle(async (request) => {
  const { enabled, name, api_key } = await readJson(request);

  await Promise.all([
    setSetting('supplier_api_enabled', !!enabled),
    setSetting('supplier_api_name', name || 'POS Supplier API'),
    setSetting('supplier_api_key', api_key || ''),
  ]);

  return ok({
    enabled: !!enabled,
    name: name || 'POS Supplier API',
    api_key: api_key || '',
  });
});