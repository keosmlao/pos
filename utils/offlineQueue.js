'use client';

import { formatDateTime } from '@/utils/formatDate';

// ຄິວບິນຂາຍ offline — ເນັດຫຼຸດແລ້ວຍັງຂາຍໄດ້:
// ບິນຖືກເກັບໃນເຄື່ອງ (localStorage) ແລ້ວສົ່ງຫາ server ອັດຕະໂນມັດເມື່ອເນັດກັບມາ.
// ໃຊ້ໄດ້ສະເພາະບິນແບບງ່າຍ (ສົດ/ໂອນ) — ຕິດໜີ້/ໃຊ້ແຕ້ມສະມາຊິກ ຕ້ອງມີເນັດ.

const QUEUE_KEY = 'pos_offline_orders_v1';
const PRODUCTS_CACHE_KEY = 'pos_products_cache_v1';

export function getQueue() {
  try {
    const arr = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {}
}

export function queueCount() {
  return getQueue().length;
}

// ເກັບບິນໄວ້ໃນເຄື່ອງ — ຄືນເລກອ້າງອີງ offline
export function queueOrder(payload) {
  const ref = `OFF-${Date.now().toString(36).toUpperCase()}`;
  const entry = {
    ref,
    sold_at: new Date().toISOString(),
    payload: {
      ...payload,
      note: [payload.note, `[ຂາຍ offline ${formatDateTime(new Date())} · ${ref}]`]
        .filter(Boolean).join(' '),
    },
  };
  saveQueue([...getQueue(), entry]);
  return entry;
}

// ສົ່ງບິນທີ່ຄ້າງຫາ server ເທື່ອລະໃບ — ຢຸດທັນທີເມື່ອສົ່ງບໍ່ໄດ້ (ເນັດຍັງບໍ່ມາ)
// ຄືນ { sent, remaining, failed } ; failed = server ປະຕິເສດ (ບໍ່ແມ່ນເນັດຫຼຸດ)
export async function syncQueue() {
  let queue = getQueue();
  let sent = 0;
  const failed = [];
  while (queue.length > 0) {
    const entry = queue[0];
    let res;
    try {
      res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry.payload),
      });
    } catch {
      break; // ເນັດຍັງບໍ່ມາ — ຄ້າງໄວ້ ລອງໃໝ່ພາຍຫຼັງ
    }
    queue = queue.slice(1);
    if (res.ok) {
      sent += 1;
    } else {
      // server ຮັບແລ້ວແຕ່ປະຕິເສດ (ເຊັ່ນ ສະຕັອກບໍ່ພໍ) — ເອົາອອກຈາກຄິວ ແຕ່ລາຍງານ
      let error = '';
      try { error = (await res.json()).error || `HTTP ${res.status}`; } catch { error = `HTTP ${res.status}`; }
      failed.push({ ref: entry.ref, error });
    }
    saveQueue(queue);
  }
  return { sent, remaining: queue.length, failed };
}

// Cache ລາຍການສິນຄ້າໄວ້ໃນເຄື່ອງ — ໃຊ້ຕອນ server ຕິດຕໍ່ບໍ່ໄດ້
export function cacheProducts(products) {
  try {
    if (Array.isArray(products) && products.length > 0) {
      localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
    }
  } catch {}
}

export function getCachedProducts() {
  try {
    const arr = JSON.parse(localStorage.getItem(PRODUCTS_CACHE_KEY) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
