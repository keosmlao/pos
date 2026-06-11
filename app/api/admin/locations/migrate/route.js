export const dynamic = 'force-dynamic';

import { handle, ok } from '@/lib/api';
import { setLocations } from '@/lib/locationSettings';
import defaultLocations from '@/data/laoLocations';

export const POST = handle(async () => {
  // Migrate default locations to database
  await setLocations(defaultLocations);
  return ok({ message: 'Default locations migrated to database successfully' });
});