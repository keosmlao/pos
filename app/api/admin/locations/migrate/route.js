export const dynamic = 'force-dynamic';

import { handle, ok } from '@/lib/api';
import { mergeDefaultLocations } from '@/lib/locationSettings';

// ເອົາລາຍການ ແຂວງ/ເມືອງ/ບ້ານ ຕົ້ນຕໍຂອງລາວມາລວມເຂົ້າຖານຂໍ້ມູນ.
// ລວມແບບບໍ່ລຶບ — ຂໍ້ມູນທີ່ຜູ້ໃຊ້ເພີ່ມເອງຍັງຢູ່ຄືເກົ່າ.
export const POST = handle(async () => {
  const locations = await mergeDefaultLocations();
  return ok({ locations, message: 'ລວມຂໍ້ມູນຕົ້ນຕໍເຂົ້າຖານຂໍ້ມູນແລ້ວ' });
});
