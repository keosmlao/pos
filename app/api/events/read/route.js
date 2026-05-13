export const dynamic = 'force-dynamic';

import { handle, ok, readJson } from '@/lib/api';
import { markRead, markAllRead } from '@/lib/appEvents';

export const POST = handle(async (request) => {
  const body = await readJson(request);
  if (body?.all === true) {
    const n = await markAllRead();
    return ok({ updated: n });
  }
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  const n = await markRead(ids);
  return ok({ updated: n });
});
