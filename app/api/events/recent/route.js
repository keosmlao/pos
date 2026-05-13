export const dynamic = 'force-dynamic';

import { handle, ok } from '@/lib/api';
import { recentEvents } from '@/lib/appEvents';

export const GET = handle(async (request) => {
  const sp = request.nextUrl.searchParams;
  const since = sp.get('since');
  const limit = sp.get('limit');
  const rows = await recentEvents({
    since: since ? Number(since) : undefined,
    limit: limit ? Number(limit) : 50,
  });
  return ok(rows);
});
