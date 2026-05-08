export const dynamic = 'force-dynamic';

import { handle, ok, fail } from '@/lib/api';
import { saveUpload } from '@/lib/uploads';

export const POST = handle(async (request) => {
  const form = await request.formData();
  const file = form.get('file');
  const result = await saveUpload({
    file,
    prefix: 'logo',
    maxBytes: 5 * 1024 * 1024,
    mimeStartsWith: 'image/',
  });
  if (result.error) return fail(result.status, result.error);
  return ok(result);
});
