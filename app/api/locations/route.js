export const dynamic = 'force-dynamic';

import { fail, handle, ok, readJson } from '@/lib/api';
import { addLocation, getLocations } from '@/lib/locationSettings';

export const GET = handle(async () => {
  const locations = await getLocations();
  return ok({ locations });
});

// ເພີ່ມ ແຂວງ/ເມືອງ/ບ້ານ ຈາກຟອມລູກຄ້າໂດຍກົງ (POS, ສະມາຊິກ, ຜູ້ສະໜອງ).
// ເພີ່ມແບບບໍ່ລຶບຂອງເກົ່າ ແລະ ຄືນຕົ້ນໄມ້ໃໝ່ທັງໝົດເພື່ອໃຫ້ໜ້າຈໍອັບເດດທັນທີ.
export const POST = handle(async (request) => {
  const body = await readJson(request);
  const result = await addLocation(body);
  if (!result.ok) return fail(400, result.error);

  const locations = await getLocations();
  return ok({ locations });
});
