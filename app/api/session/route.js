import { handle, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async (request) => ok(request.sessionUser));
