export const dynamic = 'force-dynamic';

import { fail, handle, ok, readJson } from '@/lib/api';
import { getLocations, normalizeLocations, setLocations } from '@/lib/locationSettings';

export const GET = handle(async () => {
  const locations = await getLocations();
  return ok({ locations });
});

export const PUT = handle(async (request) => {
  const body = await readJson(request);
  const normalized = normalizeLocations(body.locations);
  if (!Object.keys(normalized).length) return fail(400, 'locations is required');

  const locations = await setLocations(normalized);
  return ok({ locations });
});

