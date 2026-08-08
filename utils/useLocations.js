'use client';

import { useCallback, useEffect, useState } from 'react';
import defaultLocations from '@/data/laoLocations';

// ເຫດການພາຍໃນແອັບ — ໜ້າຫຼັງບ້ານຍິງອອກຫຼັງບັນທຶກ ແຂວງ/ເມືອງ/ບ້ານ
// ເພື່ອໃຫ້ໜ້າອື່ນ (POS, ສະມາຊິກ, ຜູ້ສະໜອງ) ດຶງໃໝ່ທັນທີ ບໍ່ຕ້ອງ refresh
export const LOCATIONS_CHANGED_EVENT = 'pos:locations-changed';

export function notifyLocationsChanged() {
  try { window.dispatchEvent(new Event(LOCATIONS_CHANGED_EVENT)); } catch { /* SSR */ }
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

    const onChanged = () => load(isAlive);
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
