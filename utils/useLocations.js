'use client';

import { useCallback, useEffect, useState } from 'react';
import defaultLocations from '@/data/laoLocations';

// ເຫດການພາຍໃນແອັບ — ໜ້າຫຼັງບ້ານຍິງອອກຫຼັງບັນທຶກ ແຂວງ/ເມືອງ/ບ້ານ
// ເພື່ອໃຫ້ໜ້າອື່ນ (POS, ສະມາຊິກ, ຜູ້ສະໜອງ) ດຶງໃໝ່ທັນທີ ບໍ່ຕ້ອງ refresh
export const LOCATIONS_CHANGED_EVENT = 'pos:locations-changed';

/**
 * @param {object} [locations] ຖ້າສົ່ງຕົ້ນໄມ້ໃໝ່ມານຳ ໜ້າອື່ນຈະຮັບຄ່າທັນທີ (ບໍ່ຕ້ອງລໍ fetch)
 */
export function notifyLocationsChanged(locations) {
  try {
    window.dispatchEvent(new CustomEvent(LOCATIONS_CHANGED_EVENT, { detail: locations || null }));
  } catch { /* SSR */ }
}

// ເພີ່ມ ແຂວງ/ເມືອງ/ບ້ານ ຈາກຟອມໃດກໍໄດ້ — ເພີ່ມແລ້ວແຈ້ງໃຫ້ທຸກໜ້າອັບເດດທັນທີ
// (dispatch ເປັນ synchronous ຈຶ່ງໝັ້ນໃຈວ່າ list ມີຄ່າໃໝ່ກ່ອນ SearchSelect ເລືອກມັນ)
export async function createLocation({ province, district, village } = {}) {
  const res = await fetch('/api/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ province, district, village }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'ເພີ່ມຂໍ້ມູນບໍ່ສຳເລັດ');
  notifyLocationsChanged(data.locations);
  return data.locations;
}

/**
 * @param {any} refreshKey ປ່ຽນຄ່ານີ້ເມື່ອໃດ ຈະດຶງຂໍ້ມູນໃໝ່ (ເຊັ່ນ ຕອນເປີດຟອມເພີ່ມລູກຄ້າ)
 */
export function useLocations(refreshKey) {
  const [locations, setLocations] = useState(defaultLocations);

  const load = useCallback(async (alive = () => true) => {
    try {
      // no-store — ບໍ່ດັ່ງນັ້ນ browser ຈະຄືນຂໍ້ມູນເກົ່າຈາກ cache ຫຼັງ admin ແກ້ແລ້ວ
      const res = await fetch('/api/locations', { cache: 'no-store' });
      const data = await res.json();
      if (!alive()) return;
      if (data?.locations && typeof data.locations === 'object' && Object.keys(data.locations).length) {
        setLocations(data.locations);
      }
    } catch { /* ໃຊ້ຄ່າເດີມຕໍ່ໄປ */ }
  }, []);

  useEffect(() => {
    let alive = true;
    const isAlive = () => alive;
    load(isAlive);

    const onChanged = (event) => {
      const next = event?.detail;
      if (next && typeof next === 'object' && Object.keys(next).length) {
        setLocations(next);
        return;
      }
      load(isAlive);
    };
    const onFocus = () => load(isAlive);
    const onVisible = () => { if (document.visibilityState === 'visible') load(isAlive); };

    window.addEventListener(LOCATIONS_CHANGED_EVENT, onChanged);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      window.removeEventListener(LOCATIONS_CHANGED_EVENT, onChanged);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load, refreshKey]);

  return locations;
}
