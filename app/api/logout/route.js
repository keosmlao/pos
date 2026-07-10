export const dynamic = 'force-dynamic';

import { handle, ok } from '@/lib/api';
import { destroySession, clearSessionCookie } from '@/lib/auth';

export const POST = handle(async (request) => {
  await destroySession(request);
  return ok({ message: 'ອອກຈາກລະບົບແລ້ວ' }, { headers: { 'Set-Cookie': clearSessionCookie() } });
});
