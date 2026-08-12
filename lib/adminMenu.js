// ແຫຼ່ງດຽວຂອງເມນູ admin + ສິດຜູ້ໃຊ້ — ໃຊ້ທັງ client (sidebar, users UI)
// ແລະ server (users API) ເພື່ອບໍ່ໃຫ້ລາຍການ path ແຕກຕ່າງກັນແລ້ວສິດຫາຍຕອນບັນທຶກ
// iconName = Lucide React icon component name (used by sidebar for SVG icons)

export const adminMenuSections = [
  {
    title: 'ພາບລວມ',
    icon: '⌂',
    iconName: 'LayoutDashboard',
    items: [
      { path: '/admin', icon: '\u{1F4CA}', iconName: 'LayoutDashboard', label: 'ແຜງຄວບຄຸມ' },
    ],
  },
  {
    title: 'ສິນຄ້າ',
    icon: '□',
    iconName: 'Package',
    items: [
      { path: '/admin/products', icon: '\u{1F4E6}', iconName: 'Package', label: 'ຈັດການສິນຄ້າ' },
      { path: '/admin/categories-brands', icon: '\u{1F3F7}️', iconName: 'Tags', label: 'ໝວດໝູ່ / ຍີ່ຫໍ້ / ຫົວໜ່ວຍ' },
      { path: '/admin/suppliers', icon: '\u{1F69A}', iconName: 'Truck', label: 'ຜູ້ສະໜອງ' },
      { path: '/admin/reorder-alerts', icon: '\u{1F514}', iconName: 'Bell', label: 'ສິນຄ້າຄວນສັ່ງເພີ່ມ' },
      { path: '/admin/price-labels', icon: '\u{1F3F7}', iconName: 'Tag', label: 'ພິມປ້າຍລາຄາ' },
      { path: '/admin/barcode-generator', icon: '\u{1F4C7}', iconName: 'ScanBarcode', label: 'ສ້າງບາໂຄດສິນຄ້າ' },
      { path: '/admin/stock-movements', icon: '\u{1F504}', iconName: 'ArrowLeftRight', label: 'ການເຄື່ອນໄຫວສິນຄ້າ' },
      { path: '/admin/stock-cost', icon: '\u{1F4B0}', iconName: 'Coins', label: 'ການເຄື່ອນໄຫວສິນຄ້າ (ຕົ້ນທຶນ)' },
      { path: '/admin/stock-reconcile', icon: '\u{2696}', iconName: 'Scale', label: 'ກວດຄວາມສົມດຸນສະຕັອກ' },
      { path: '/admin/stock-adjustments', icon: '\u{1F4DD}', iconName: 'FileEdit', label: 'ປັບປຸງສະຕັອກ' },
      { path: '/admin/stock-take', icon: '\u{1F50D}', iconName: 'Search', label: 'ນັບສິນຄ້າ (Stock take)' },
      { path: '/admin/stock-transfers', icon: '\u{1F504}', iconName: 'ArrowLeftRight', label: 'ໂອນຣະຫວ່າງສາຂາ' },
    ],
  },
  {
    title: 'ຊື້',
    icon: '↓',
    iconName: 'ShoppingBag',
    items: [
      { path: '/admin/purchase-requests', icon: '\u{1F4DD}', iconName: 'FileText', label: 'ໃບສະເໜີຊື້' },
      { path: '/admin/purchases', icon: '\u{1F6D2}', iconName: 'ShoppingCart', label: 'ລະບົບຊື້ເຂົ້າ' },
      { path: '/admin/debts', icon: '\u{1F4B3}', iconName: 'CreditCard', label: 'ໜີ້ຜູ້ສະໜອງ' },
      { path: '/admin/purchase-returns', icon: '\u{21A9}', iconName: 'Undo2', label: 'ສົ່ງເຄື່ອງຄືນຜູ້ສະໜອງ' },
      { path: '/admin/debt-payments/supplier', icon: '\u{1F4B8}', iconName: 'Banknote', label: 'ຊຳລະໃຫ້ເຈົ້າໜີ້' },
    ],
  },
  {
    title: 'ຂາຍ',
    icon: '↑',
    iconName: 'TrendingUp',
    items: [
      { path: '/admin/quotations', icon: '\u{1F4DC}', iconName: 'FileText', label: 'ໃບສະເໜີລາຄາ' },
      { path: '/admin/laybys', icon: '\u{1F4B0}', iconName: 'Banknote', label: 'Layby / ມັດຈຳ', posHint: 'ຕິກ ✏️ ແກ້ = ໃຊ້ Layby ໃນໜ້າຂາຍໄດ້' },
      { path: '/admin/sales', icon: '\u{1F4CB}', iconName: 'ClipboardList', label: 'ປະຫວັດການຂາຍ', posHint: 'ຕິກ 🗑 ລົບ = ຍົກເລີກບິນຂາຍໃນໜ້າຂາຍໄດ້' },
      { path: '/admin/credit-sales', icon: '\u{1F9FE}', iconName: 'Receipt', label: 'ບິນຂາຍຕິດໜີ້' },
      { path: '/admin/vat-sales-report', icon: '\u{1F9FE}', iconName: 'FileBarChart', label: 'ລາຍງານການຂາຍສິນຄ້າ ອມພ (VAT)' },
      { path: '/admin/returns', icon: '\u{21A9}', iconName: 'Undo2', label: 'ຮັບຄືນ / ຄືນເງິນ', posHint: 'ຕິກ ✏️ ແກ້ ຈຶ່ງເຫັນປຸ່ມ “ຮັບຄືນ” ໃນໜ້າຂາຍ · ຕິກ 🗑 ລົບ = ຍົກເລີກບິນຮັບຄືນໄດ້' },
      { path: '/admin/cash-handovers', icon: '\u{1F4B0}', iconName: 'Wallet', label: 'ລາຍການສົ່ງເງິນ' },
      { path: '/admin/cashier-receipts', icon: '\u{1F9FE}', iconName: 'ScrollText', label: 'ສະຫຼຸບການຮັບເງິນ' },
    ],
  },
  {
    title: 'ການເງິນ',
    icon: '$',
    iconName: 'CircleDollarSign',
    items: [
      { path: '/admin/cash-transactions/income', icon: '\u{1F7E2}', iconName: 'ArrowUpCircle', label: 'ບັນທຶກລາຍຮັບ' },
      { path: '/admin/cash-transactions/expense', icon: '\u{1F534}', iconName: 'ArrowDownCircle', label: 'ບັນທຶກລາຍຈ່າຍ' },
      { path: '/admin/cash-flow', icon: '\u{1F4C8}', iconName: 'TrendingUp', label: 'ການເຄື່ອນໄຫວເງິນສົດ' },
      { path: '/admin/tax-report', icon: '\u{1F9FE}', iconName: 'FileBarChart', label: 'ລາຍງານພາສີ / VAT' },
      { path: '/admin/profit-report', icon: '\u{1F4C8}', iconName: 'BarChart3', label: 'ກຳໄລ / COGS' },
      { path: '/admin/cashier-kpi', icon: '\u{1F3AF}', iconName: 'Target', label: 'KPI ພະນັກງານ' },
    ],
  },
  {
    title: 'ລູກຄ້າ',
    icon: '◎',
    iconName: 'Users',
    items: [
      { path: '/admin/members', icon: '\u{1Faaa}', iconName: 'UserCircle', label: 'ສະມາຊິກ' },
      { path: '/admin/points-report', icon: '\u{2B50}', iconName: 'Star', label: 'ລາຍງານແຕ້ມສະສົມ' },
      { path: '/admin/customer-debts', icon: '\u{1F9FE}', iconName: 'CreditCard', label: 'ໜີ້ລູກຄ້າ' },
      { path: '/admin/debt-payments/customer', icon: '\u{1F4B5}', iconName: 'Banknote', label: 'ຊຳລະຈາກລູກໜີ້' },
    ],
  },
  {
    title: 'ລາຍງານ',
    icon: '▤',
    iconName: 'FileBarChart',
    items: [
      { path: '/admin/reports/payables', icon: '\u{1F4E4}', iconName: 'FileDown', label: 'ໜີ້ຄ້າງສົ່ງ (ຜູ້ສະໜອງ)' },
      { path: '/admin/reports/receivables', icon: '\u{1F4E5}', iconName: 'FileUp', label: 'ໜີ້ຄ້າງຮັບ (ລູກຄ້າ)' },
    ],
  },
  {
    title: 'ຕັ້ງຄ່າ',
    icon: '⚙',
    iconName: 'Settings',
    items: [
      { path: '/admin/users', icon: '\u{1F464}', iconName: 'UserCog', label: 'User ແລະ ສິດ' },
      { path: '/admin/audit-log', icon: '\u{1F4CB}', iconName: 'ClipboardList', label: 'ປະຫວັດການເຮັດວຽກ' },
      { path: '/admin/manual', icon: '\u{1F4D8}', iconName: 'BookOpen', label: 'ຄູ່ມືການໃຊ້ງານ' },
      { path: '/admin/download', icon: '\u{1F4F1}', iconName: 'Download', label: 'ດາວໂຫຼດແອັບ' },
      { path: '/admin/backup', icon: '\u{1F4BE}', iconName: 'Database', label: 'ສຳຮອງ / ສົ່ງອອກຂໍ້ມູນ' },
      { path: '/admin/pricing', icon: '\u{1F4B2}', iconName: 'DollarSign', label: 'ກຳນົດລາຄາຂາຍ' },
      { path: '/admin/promotions', icon: '\u{1F381}', iconName: 'Gift', label: 'ໂປຣໂມຊັ່ນ' },
      { path: '/admin/loyalty', icon: '\u{2B50}', iconName: 'Star', label: 'ຕັ້ງຄ່າແຕ້ມສະສົມ' },
      { path: '/admin/currencies', icon: '\u{1F4B1}', iconName: 'CircleDollarSign', label: 'ສະກຸນເງິນ / ອັດຕາ' },
      { path: '/admin/branches', icon: '\u{1F3EC}', iconName: 'Building2', label: 'ສາຂາ' },
      { path: '/admin/locations', icon: '\u{1F4CD}', iconName: 'MapPin', label: 'ແຂວງ / ເມືອງ / ບ້ານ' },
      { path: '/admin/company', icon: '\u{1F3E2}', iconName: 'Store', label: 'ຂໍ້ມູນບໍລິສັດ' },
      { path: '/admin/bill-format', icon: '\u{1F9FE}', iconName: 'FileEdit', label: 'ຮູບແບບເລກບິນ' },
    ],
  },
];

export const adminMenuItems = adminMenuSections.flatMap(section =>
  section.items.map(item => ({ ...item, section: section.title, sectionIcon: section.icon, sectionIconName: section.iconName }))
);

export function createFullPermissions() {
  return Object.fromEntries(adminMenuItems.map(item => [item.path, { access: true, edit: true, delete: true }]));
}

export function normalizePermissions(permissions) {
  const src = permissions && typeof permissions === 'object' ? permissions : {};
  const hasAnyAccess = Object.values(src).some(p => p && typeof p === 'object' && p.access);
  return Object.fromEntries(adminMenuItems.map(item => {
    const p = src[item.path] || {};
    if (item.path === '/admin/manual' && hasAnyAccess && !src[item.path]) {
      return [item.path, { access: true, edit: false, delete: false }];
    }
    return [item.path, { access: !!p.access, edit: !!p.edit, delete: !!p.delete }];
  }));
}

// ໃຊ້ຕອນບັນທຶກຜູ້ໃຊ້ (POST/PUT users API): admin ໄດ້ທຸກສິດ,
// ຜູ້ໃຊ້ອື່ນ normalize ຕາມເມນູ ແລະ ບໍ່ມີ access → edit/delete ຕ້ອງດັບນຳ
export function normalizeRolePermissions(input, role) {
  if (role === 'admin') return createFullPermissions();
  const normalized = normalizePermissions(input);
  for (const p of Object.values(normalized)) {
    if (!p.access) { p.edit = false; p.delete = false; }
  }
  return normalized;
}