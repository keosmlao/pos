export const dynamic = 'force-dynamic';

import { handle, ok } from '@/lib/api';
import { getLocations } from '@/lib/locationSettings';

export const GET = handle(async () => {
  const locations = await getLocations();
  return ok({ locations });
});

