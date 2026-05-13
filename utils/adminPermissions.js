'use client';

export const adminMenuSections = [
  {
    title: 'ພາບລວມ',
    icon: '⌂',
    items: [
      { path: '/admin', icon: '\u{1F4CA}', label: 'ແຜງຄວບຄຸມ' },
    ],
  },
  {
    title: 'ສິນຄ້າ',
    icon: '□',
    items: [
      { path: '/admin/products', icon: '\u{1F4E6}', label: 'ຈັດການສິນຄ້າ' },
      { path: '/admin/categories-brands', icon: '\u{1F3F7}️', label: 'ໝວດໝູ່ / ຍີ່ຫໍ້ / ຫົວໜ່ວຍ' },
      { path: '/admin/suppliers', icon: '\u{1F69A}', label: 'ຜູ້ສະໜອງ' },
      { path: '/admin/reorder-alerts', icon: '\u{1F514}', label: 'ສິນຄ້າຄວນສັ່ງເພີ່ມ' },
      { path: '/admin/price-labels', icon: '\u{1F3F7}', label: 'ພິມປ້າຍລາຄາ' },
      { path: '/admin/stock-adjustments', icon: '\u{1F4DD}', label: 'ປັບປຸງສະຕັອກ' },
      { path: '/admin/stock-take', icon: '\u{1F50D}', label: 'ນັບສິນຄ້າ (Stock take)' },
      { path: '/admin/stock-transfers', icon: '\u{1F504}', label: 'ໂອນຣະຫວ່າງສາຂາ' },
    ],
  },
  {
    title: 'ຊື້',
    icon: '↓',
    items: [
      { path: '/admin/purchase-requests', icon: '\u{1F4DD}', label: 'ໃບສະເໜີຊື້' },
      { path: '/admin/purchases', icon: '\u{1F6D2}', label: 'ລະບົບຊື້ເຂົ້າ' },
      { path: '/admin/debts', icon: '\u{1F4B3}', label: 'ໜີ້ຜູ້ສະໜອງ' },
      { path: '/admin/debt-payments/supplier', icon: '\u{1F4B8}', label: 'ຊຳລະໃຫ້ເຈົ້າໜີ້' },
    ],
  },
  {
    title: 'ຂາຍ',
    icon: '↑',
    items: [
      { path: '/admin/quotations', icon: '\u{1F4DC}', label: 'ໃບສະເໜີລາຄາ' },
      { path: '/admin/laybys', icon: '\u{1F4B0}', label: 'Layby / ມັດຈຳ' },
      { path: '/admin/sales', icon: '\u{1F4CB}', label: 'ປະຫວັດການຂາຍ' },
      { path: '/admin/returns', icon: '\u{21A9}', label: 'ຮັບຄືນ / ຄືນເງິນ' },
      { path: '/admin/cash-handovers', icon: '\u{1F4B0}', label: 'ລາຍການສົ່ງເງິນ' },
    ],
  },
  {
    title: 'ການເງິນ',
    icon: '$',
    items: [
      { path: '/admin/cash-transactions/income', icon: '\u{1F7E2}', label: 'ບັນທຶກລາຍຮັບ' },
      { path: '/admin/cash-transactions/expense', icon: '\u{1F534}', label: 'ບັນທຶກລາຍຈ່າຍ' },
      { path: '/admin/cash-flow', icon: '\u{1F4C8}', label: 'ການເຄື່ອນໄຫວເງິນສົດ' },
      { path: '/admin/tax-report', icon: '\u{1F9FE}', label: 'ລາຍງານພາສີ / VAT' },
      { path: '/admin/profit-report', icon: '\u{1F4C8}', label: 'ກຳໄລ / COGS' },
      { path: '/admin/cashier-kpi', icon: '\u{1F3AF}', label: 'KPI ພະນັກງານ' },
    ],
  },
  {
    title: 'ລູກຄ້າ',
    icon: '◎',
    items: [
      { path: '/admin/members', icon: '\u{1Faaa}', label: 'ສະມາຊິກ' },
      { path: '/admin/customer-debts', icon: '\u{1F9FE}', label: 'ໜີ້ລູກຄ້າ' },
      { path: '/admin/debt-payments/customer', icon: '\u{1F4B5}', label: 'ຊຳລະຈາກລູກໜີ້' },
    ],
  },
  {
    title: 'ຕັ້ງຄ່າ',
    icon: '⚙',
    items: [
      { path: '/admin/users', icon: '\u{1F464}', label: 'User ແລະ ສິດ' },
      { path: '/admin/audit-log', icon: '\u{1F4CB}', label: 'ປະຫວັດການເຮັດວຽກ' },
      { path: '/admin/backup', icon: '\u{1F4BE}', label: 'ສຳຮອງ / ສົ່ງອອກຂໍ້ມູນ' },
      { path: '/admin/pricing', icon: '\u{1F4B2}', label: 'ກຳນົດລາຄາຂາຍ' },
      { path: '/admin/promotions', icon: '\u{1F381}', label: 'ໂປຣໂມຊັ່ນ' },
      { path: '/admin/loyalty', icon: '\u{2B50}', label: 'ຕັ້ງຄ່າແຕ້ມສະສົມ' },
      { path: '/admin/currencies', icon: '\u{1F4B1}', label: 'ສະກຸນເງິນ / ອັດຕາ' },
      { path: '/admin/branches', icon: '\u{1F3EC}', label: 'ສາຂາ' },
      { path: '/admin/locations', icon: '\u{1F4CD}', label: 'ແຂວງ / ເມືອງ / ບ້ານ' },
      { path: '/admin/company', icon: '\u{1F3E2}', label: 'ຂໍ້ມູນບໍລິສັດ' },
      { path: '/admin/bill-format', icon: '\u{1F9FE}', label: 'ຮູບແບບເລກບິນ' },
    ],
  },
];

export const adminMenuItems = adminMenuSections.flatMap(section =>
  section.items.map(item => ({ ...item, section: section.title }))
);

export function createFullPermissions() {
  return Object.fromEntries(adminMenuItems.map(item => [item.path, { access: true, edit: true, delete: true }]));
}

export function normalizePermissions(permissions) {
  const src = permissions && typeof permissions === 'object' ? permissions : {};
  return Object.fromEntries(adminMenuItems.map(item => {
    const p = src[item.path] || {};
    return [item.path, { access: !!p.access, edit: !!p.edit, delete: !!p.delete }];
  }));
}

export function isMenuItemActive(item, pathname) {
  return item.path === '/admin' ? pathname === '/admin' : pathname.startsWith(item.path);
}

export function canAccessAdmin(user, pathname = '/admin') {
  if (user?.role === 'admin') return true;
  const permissions = normalizePermissions(user?.permissions);
  const match = adminMenuItems
    .filter(item => isMenuItemActive(item, pathname))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return match ? !!permissions[match.path]?.access : adminMenuItems.some(item => permissions[item.path]?.access);
}

export function firstAccessibleAdminPath(user) {
  if (user?.role === 'admin') return '/admin';
  const permissions = normalizePermissions(user?.permissions);
  return adminMenuItems.find(item => permissions[item.path]?.access)?.path || null;
}
