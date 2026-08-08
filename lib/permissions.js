// ແຫຼ່ງດຽວຂອງການກວດສິດ — ໃຊ້ທັງ server (lib/api.js) ແລະ client (utils/adminPermissions.js)
//
// ໂຄງສ້າງສິດ: { '<menu path>': { access, edit, delete } }  (ຕັ້ງຢູ່ໜ້າ User ແລະ ສິດ)
//   access = ເບິ່ງ/ເຂົ້າໜ້າ + ອ່ານຂໍ້ມູນ (GET)
//   edit   = ເພີ່ມ/ແກ້ໄຂ (POST / PUT / PATCH)
//   delete = ລົບ (DELETE)
//
// ກົດເກນ:
//   1. admin ໄດ້ທຸກຢ່າງ
//   2. API ໃດຢູ່ໃນ API_RULES → ກວດສິດຂອງເມນູທີ່ຜູກໄວ້
//   3. API ພາຍໃຕ້ /api/admin ທີ່ບໍ່ຢູ່ໃນ map → ປະຕິເສດ (fail-closed)
//   4. API ອື່ນ (ໜ້າ POS ໃຊ້ຂາຍປົກກະຕິ) → ອະນຸຍາດຜູ້ທີ່ login ແລ້ວ

import { adminMenuItems, normalizePermissions } from './adminMenu.js';

export const ACTION_BY_METHOD = {
  GET: 'access', HEAD: 'access', OPTIONS: 'access',
  POST: 'edit', PUT: 'edit', PATCH: 'edit',
  DELETE: 'delete',
};

// API → ເມນູ. sharedRead = ຂໍ້ມູນອ້າງອີງທີ່ໜ້າ POS ຕ້ອງອ່ານໄດ້ສະເໝີ (GET ບໍ່ກວດສິດ)
export const API_RULES = [
  // ── ສິນຄ້າ / ຂໍ້ມູນອ້າງອີງ ─────────────────────────────────────────────
  { prefix: '/api/admin/uploads/product-image', menu: '/admin/products' },
  { prefix: '/api/admin/uploads/invoice', menu: '/admin/purchases' },
  { prefix: '/api/admin/uploads/logo', menu: '/admin/company' },
  { prefix: '/api/admin/uploads/windows-app', menu: '/admin/download' },
  { prefix: '/api/admin/products', menu: '/admin/products', sharedRead: true },
  { prefix: '/api/admin/categories', menu: '/admin/categories-brands', sharedRead: true },
  { prefix: '/api/admin/brands', menu: '/admin/categories-brands', sharedRead: true },
  { prefix: '/api/admin/units', menu: '/admin/categories-brands', sharedRead: true },
  { prefix: '/api/admin/suppliers', menu: '/admin/suppliers', sharedRead: true },
  { prefix: '/api/admin/reorder-alerts', menu: '/admin/reorder-alerts' },
  { prefix: '/api/admin/stock-movements', menu: '/admin/stock-movements' },
  { prefix: '/api/admin/stock-cost', menu: '/admin/stock-cost' },
  { prefix: '/api/admin/stock-reconcile', menu: '/admin/stock-reconcile' },
  { prefix: '/api/admin/stock-adjustments', menu: '/admin/stock-adjustments' },
  { prefix: '/api/admin/stock-takes', menu: '/admin/stock-take' },
  { prefix: '/api/admin/stock-transfers', menu: '/admin/stock-transfers' },

  // ── ຊື້ ────────────────────────────────────────────────────────────────
  { prefix: '/api/admin/purchase-requests', menu: '/admin/purchase-requests' },
  { prefix: '/api/admin/purchase-returns', menu: '/admin/purchase-returns' },
  { prefix: '/api/admin/purchases', menu: '/admin/purchases' },
  { prefix: '/api/admin/payments/next-number', menu: '/admin/purchases' },
  { prefix: '/api/admin/debts', menu: '/admin/debts' },
  { prefix: '/api/admin/debt-payments', menu: '/admin/debt-payments/supplier' },

  // ── ຂາຍ ────────────────────────────────────────────────────────────────
  { prefix: '/api/admin/quotations', menu: '/admin/quotations' },
  { prefix: '/api/admin/laybys', menu: '/admin/laybys' },
  { prefix: '/api/admin/sales', menu: '/admin/sales' },
  { prefix: '/api/admin/cashier-receipts', menu: '/admin/cashier-receipts' },

  // ── ການເງິນ ────────────────────────────────────────────────────────────
  { prefix: '/api/admin/cash-transactions', menu: '/admin/cash-transactions/income' },
  { prefix: '/api/admin/cash-flow', menu: '/admin/cash-flow' },
  { prefix: '/api/admin/tax-report', menu: '/admin/tax-report' },
  { prefix: '/api/admin/profit-report', menu: '/admin/profit-report' },
  { prefix: '/api/admin/cashier-kpi', menu: '/admin/cashier-kpi' },

  // ── ລູກຄ້າ ─────────────────────────────────────────────────────────────
  { prefix: '/api/admin/members', menu: '/admin/members' },
  { prefix: '/api/admin/points-report', menu: '/admin/points-report' },
  { prefix: '/api/admin/customer-debts', menu: '/admin/customer-debts' },

  // ── ຕັ້ງຄ່າ ────────────────────────────────────────────────────────────
  { prefix: '/api/admin/users', menu: '/admin/users' },
  { prefix: '/api/admin/audit-log', menu: '/admin/audit-log' },
  { prefix: '/api/admin/backup', menu: '/admin/backup' },
  { prefix: '/api/admin/pricing', menu: '/admin/pricing' },
  { prefix: '/api/admin/promotions', menu: '/admin/promotions' },
  { prefix: '/api/admin/loyalty', menu: '/admin/loyalty' },
  { prefix: '/api/admin/currencies', menu: '/admin/currencies', sharedRead: true },
  { prefix: '/api/admin/branches', menu: '/admin/branches', sharedRead: true },
  { prefix: '/api/admin/locations', menu: '/admin/locations', sharedRead: true },
  { prefix: '/api/admin/company', menu: '/admin/company', sharedRead: true },
  { prefix: '/api/admin/settings', menu: '/admin/company', sharedRead: true },
  { prefix: '/api/admin/bill-format', menu: '/admin/bill-format' },
  { prefix: '/api/admin/dashboard', menu: '/admin' },

  // ── ນອກ /api/admin ແຕ່ຍັງຕ້ອງຄຸມສິດ ────────────────────────────────────
  // ໜ້າ POS ຕ້ອງຂາຍໄດ້ສະເໝີ → GET/POST ເປີດ, ລົບບິນຈຶ່ງກວດສິດ
  { prefix: '/api/orders', menu: '/admin/sales', openMethods: ['GET', 'HEAD', 'POST'] },
  { prefix: '/api/returns', menu: '/admin/returns', openMethods: ['GET', 'HEAD'] },
  // ພະນັກງານສົ່ງເງິນຂອງຕົນເອງໄດ້ສະເໝີ (POST) — ຮັບເງິນ/ຍົກເລີກຮັບ ເປັນວຽກຫົວໜ້າ
  // ເສັ້ນທາງຈິງ: /api/cash-handovers/<id>/receive · /unreceive
  { prefix: '/api/cash-handovers', menu: '/admin/cash-handovers', openMethods: ['GET', 'HEAD'],
    openPost: p => p === '/api/cash-handovers' },
];

// ຜູ້ໃຊ້ເກົ່າທີ່ຍັງບໍ່ເຄີຍຕັ້ງສິດ (permissions = {}) — ໃຫ້ໃຊ້ໜ້າ POS ໄດ້ຕາມປົກກະຕິ
// ເພື່ອບໍ່ໃຫ້ການອັບເກຣດຕັດການເຮັດວຽກ. ພໍ admin ບັນທຶກສິດເທື່ອດຽວ ຄ່ານີ້ຈະບໍ່ຖືກໃຊ້ອີກ
export const LEGACY_POS_DEFAULTS = {
  '/admin/laybys': { access: true, edit: true, delete: false },
  '/admin/returns': { access: true, edit: true, delete: false },
  '/admin/cash-handovers': { access: true, edit: true, delete: false },
  '/admin/credit-sales': { access: true, edit: true, delete: false },
  '/admin/sales': { access: true, edit: false, delete: false },
};

export function isLegacyUser(user) {
  const p = user?.permissions;
  return !p || typeof p !== 'object' || Object.keys(p).length === 0;
}

/** ສິດທີ່ໃຊ້ຈິງຂອງຜູ້ໃຊ້ (normalize + fallback ຜູ້ໃຊ້ເກົ່າ) */
export function effectivePermissions(user) {
  const base = normalizePermissions(user?.permissions);
  if (!isLegacyUser(user)) return base;
  for (const [path, perm] of Object.entries(LEGACY_POS_DEFAULTS)) {
    if (base[path]) base[path] = { ...perm };
  }
  return base;
}

/** ຫາເມນູທີ່ກົງກັບ path ຂອງໜ້າ (ເອົາອັນທີ່ຍາວທີ່ສຸດ — ໜ້າຍ່ອຍສືບສິດຈາກໜ້າແມ່) */
export function resolveMenuPath(pathname) {
  const p = String(pathname || '');
  if (p === '/admin') return '/admin';
  let best = null;
  for (const item of adminMenuItems) {
    if (item.path === '/admin') continue;
    if (p === item.path || p.startsWith(item.path + '/')) {
      if (!best || item.path.length > best.length) best = item.path;
    }
  }
  return best;
}

export function can(user, menuPath, action = 'access') {
  if (!menuPath) return false;
  if (user?.role === 'admin') return true;
  const perms = effectivePermissions(user);
  const p = perms[menuPath];
  if (!p) return false;
  if (action === 'access') return !!p.access;
  return !!p.access && !!p[action];
}

/** ສິດຂອງໜ້າໃດໜຶ່ງ — ໜ້າຍ່ອຍ (/admin/products/import) ສືບຈາກໜ້າແມ່ */
export function pagePermission(user, pathname) {
  if (user?.role === 'admin') return { access: true, edit: true, delete: true };
  const menu = resolveMenuPath(pathname);
  if (!menu) return { access: false, edit: false, delete: false };
  const perms = effectivePermissions(user);
  return perms[menu] || { access: false, edit: false, delete: false };
}

function matchRule(pathname) {
  let best = null;
  for (const rule of API_RULES) {
    if (pathname === rule.prefix || pathname.startsWith(rule.prefix + '/') || pathname.startsWith(rule.prefix + '?')) {
      if (!best || rule.prefix.length > best.prefix.length) best = rule;
    }
  }
  return best;
}

/**
 * ກວດສິດຂອງ API 1 ຄຳຮ້ອງ
 * @returns {{ allowed: boolean, menu: string|null, action: string, reason: string }}
 */
export function authorizeApi(user, pathname, method) {
  const action = ACTION_BY_METHOD[String(method || 'GET').toUpperCase()] || 'edit';
  if (user?.role === 'admin') return { allowed: true, menu: null, action, reason: 'admin' };

  const rule = matchRule(String(pathname || ''));
  if (!rule) {
    // ບໍ່ຢູ່ໃນ map: /api/admin ປິດໄວ້ກ່ອນ (fail-closed) ສ່ວນ API ໜ້າ POS ເປີດ
    const isAdminApi = String(pathname || '').startsWith('/api/admin');
    return {
      allowed: !isAdminApi,
      menu: null,
      action,
      reason: isAdminApi ? 'unmapped-admin-api' : 'pos-api',
    };
  }

  const upper = String(method || 'GET').toUpperCase();
  if (rule.openMethods && rule.openMethods.includes(upper)) {
    return { allowed: true, menu: rule.menu, action, reason: 'open-method' };
  }
  if (upper === 'POST' && typeof rule.openPost === 'function' && rule.openPost(String(pathname || ''))) {
    return { allowed: true, menu: rule.menu, action, reason: 'open-post' };
  }
  if (rule.sharedRead && action === 'access') {
    return { allowed: true, menu: rule.menu, action, reason: 'shared-read' };
  }
  return {
    allowed: can(user, rule.menu, action),
    menu: rule.menu,
    action,
    reason: 'permission',
  };
}
