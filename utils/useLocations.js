'use client';

import { useEffect, useState } from 'react';
import defaultLocations from '@/data/laoLocations';

export function useLocations() {
  const [locations, setLocations] = useState(defaultLocations);

  useEffect(() => {
    let alive = true;
    fetch('/api/locations')
      .then(r => r.json())
      .then(data => {
        if (!alive) return;
        if (data?.locations && typeof data.locations === 'object') {
          setLocations(data.locations);
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return locations;
}

