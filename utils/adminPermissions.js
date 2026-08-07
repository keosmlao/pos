'use client';

// ຂໍ້ມູນເມນູ + normalize ຍ້າຍໄປ lib/adminMenu.js (ແຫຼ່ງດຽວ ໃຊ້ທັງ client/server)
export {
  adminMenuSections,
  adminMenuItems,
  createFullPermissions,
  normalizePermissions,
} from '@/lib/adminMenu';

import { useState, useEffect } from 'react';
import { normalizePermissions } from '@/lib/adminMenu';

export function isMenuItemActive(item, pathname) {
  return item.path === '/admin' ? pathname === '/admin' : pathname.startsWith(item.path);
}

// ໜ້າຫຼັງບ້ານເປັນຂອງ admin ເທົ່ານັ້ນ — ພະນັກງານຂາຍ (cashier) ເຂົ້າບໍ່ໄດ້ເດັດຂາດ
// ເຖິງວ່າຈະຖືກຕັ້ງສິດລາຍໜ້າໄວ້ກໍຕາມ (server ກວດຊ້ຳອີກຊັ້ນໃນ lib/api.js)
export function canAccessAdmin(user) {
  return user?.role === 'admin';
}

// ສິດຂອງໜ້າໃດໜຶ່ງ: { access, edit, delete } — admin ໄດ້ທຸກຢ່າງ
// ໝາຍເຫດ: ສິດເຫຼົ່ານີ້ບໍ່ໄດ້ເປີດທາງໃຫ້ cashier ເຂົ້າໜ້າຫຼັງບ້ານ — ມັນຄຸມແຕ່
// ຄວາມສາມາດໃນໜ້າ POS ເອງ (ຄືນສິນຄ້າ / ຍົກເລີກບິນ) ເທົ່ານັ້ນ
export function getPagePermission(user, path) {
  if (user?.role === 'admin') return { access: true, edit: true, delete: true };
  const permissions = normalizePermissions(user?.permissions);
  return permissions[path] || { access: false, edit: false, delete: false };
}

// Hook ສຳລັບໜ້າ admin: ອ່ານສິດຂອງຜູ້ໃຊ້ປັດຈຸບັນຕໍ່ໜ້ານີ້
// ເລີ່ມຕົ້ນເປັນ "ໄດ້ທຸກຢ່າງ" ເພື່ອບໍ່ໃຫ້ປຸ່ມກະພິບຫາຍຕອນໂຫຼດ — server ກວດອີກຊັ້ນຢູ່ແລ້ວ
export function usePagePermission(path) {
  const [perm, setPerm] = useState({ access: true, edit: true, delete: true });
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('pos_user') || 'null');
      if (user) setPerm(getPagePermission(user, path));
    } catch {}
  }, [path]);
  return perm;
}

export function firstAccessibleAdminPath(user) {
  return user?.role === 'admin' ? '/admin' : null;
}
