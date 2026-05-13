export const dynamic = 'force-dynamic';

import { handle, ok } from '@/lib/api';
import { ensureCompanyProfileSchema, ensureMembersSchema } from '@/lib/migrations';
import { recomputeAllMemberTiers } from '@/lib/memberTiers';

export const POST = handle(async () => {
  await ensureCompanyProfileSchema();
  await ensureMembersSchema();
  const updated = await recomputeAllMemberTiers();
  return ok({ updated });
});
