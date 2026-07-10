'use client';

// ຂໍ້ມູນເມນູ + normalize ຍ້າຍໄປ lib/adminMenu.js (ແຫຼ່ງດຽວ ໃຊ້ທັງ client/server)
export {
  adminMenuSections,
  adminMenuItems,
  createFullPermissions,
  normalizePermissions,
} from '@/lib/adminMenu';

import { useState, useEffect } from 'react';
import { adminMenuItems, normalizePermissions } from '@/lib/adminMenu';

export function isMenuItemActive(item, pathname) {
  return item.path === '/admin' ? pathname === '/admin' : pathname.startsWith(item.path);
}

export function canAccessAdmin(user, pathname = '/admin') {
  if (user?.role === 'admin') return true;
  const permissions = normalizePermissions(user?.permissions);
  const match = adminMenuItems
    .filter(item => isMenuItemActive(item, pathname))
    .sort((a, b) => b.path.length - a.path.length)[0];
  // ບໍ່ພົບໃນເມນູ → ປິດໄວ້ກ່ອນ (fail-closed) ບໍ່ໃຫ້ຫຼຸດເຂົ້າໜ້າທີ່ບໍ່ໄດ້ຮັບສິດ
  return match ? !!permissions[match.path]?.access : false;
}

// ສິດຂອງໜ້າໃດໜຶ່ງ: { access, edit, delete } — admin ໄດ້ທຸກຢ່າງ
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
  if (user?.role === 'admin') return '/admin';
  const permissions = normalizePermissions(user?.permissions);
  return adminMenuItems.find(item => permissions[item.path]?.access)?.path || null;
}
