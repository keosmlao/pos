'use client';

// ຂໍ້ມູນເມນູ + normalize ຢູ່ lib/adminMenu.js · ກົດເກນການກວດສິດຢູ່ lib/permissions.js
// (ແຫຼ່ງດຽວ ໃຊ້ທັງ client ແລະ server ຈຶ່ງບໍ່ຫຼົງກັນ)
export {
  adminMenuSections,
  adminMenuItems,
  createFullPermissions,
  normalizePermissions,
} from '@/lib/adminMenu';

import { useState, useEffect } from 'react';
import { pagePermission, resolveMenuPath, effectivePermissions } from '@/lib/permissions';

export function isMenuItemActive(item, pathname) {
  return item.path === '/admin' ? pathname === '/admin' : pathname.startsWith(item.path);
}

// ເຂົ້າໜ້າຫຼັງບ້ານໄດ້ບໍ່ — admin ໄດ້ໝົດ, ຄົນອື່ນອີງຕາມສິດ "ເຂົ້າ" ຂອງເມນູນັ້ນ
// (ໜ້າຍ່ອຍເຊັ່ນ /admin/products/import ສືບສິດຈາກ /admin/products)
export function canAccessAdmin(user, pathname) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!pathname) return firstAccessibleAdminPath(user) !== null;
  return pagePermission(user, pathname).access;
}

// ສິດຂອງໜ້າໃດໜຶ່ງ: { access, edit, delete } — admin ໄດ້ທຸກຢ່າງ
export function getPagePermission(user, path) {
  return pagePermission(user, path);
}

// Hook ສຳລັບໜ້າ admin — ເລີ່ມຕົ້ນເປັນ "ບໍ່ມີສິດ" (fail-closed) ພ້ອມ loading
// ເພື່ອບໍ່ໃຫ້ປຸ່ມແກ້/ລົບກະພິບໃຫ້ເຫັນກ່ອນອ່ານສິດແລ້ວຄ່ອຍຫາຍ
export function usePagePermission(path) {
  const [perm, setPerm] = useState({ access: false, edit: false, delete: false, loading: true });
  useEffect(() => {
    try {
      const user = JSON.parse(localStorage.getItem('pos_user') || 'null');
      setPerm({ ...getPagePermission(user, path), loading: false });
    } catch {
      setPerm({ access: false, edit: false, delete: false, loading: false });
    }
  }, [path]);
  return perm;
}

// ໜ້າທຳອິດທີ່ຜູ້ໃຊ້ເຂົ້າໄດ້ — ໃຊ້ຕອນ redirect ຫຼັງ login ຫຼື ຕອນເຂົ້າໜ້າທີ່ບໍ່ມີສິດ
export function firstAccessibleAdminPath(user) {
  if (!user) return null;
  if (user.role === 'admin') return '/admin';
  const perms = effectivePermissions(user);
  const found = Object.entries(perms).find(([, p]) => p?.access);
  return found ? found[0] : null;
}

export { resolveMenuPath };
