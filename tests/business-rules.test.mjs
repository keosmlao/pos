import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVatSettings, applyVat, orderVatBreakdown } from '../lib/vat.js';
import { normalizeTaxId, digitsOnly } from '../lib/taxId.js';
import { pagePermission } from '../lib/permissions.js';
import { normalizeRolePermissions } from '../lib/adminMenu.js';
import { applyRounding } from '../lib/rounding.js';
import { consumeRateLimit, clearRateLimit } from '../lib/rateLimit.js';
import ExcelJS from 'exceljs';
import { readFirstWorksheet, rowsToObjects } from '../utils/excelClient.js';
import { mergeExistingProduct } from '../lib/productMerge.js';

test('exclusive and inclusive VAT totals remain consistent', () => {
  const exclusive = normalizeVatSettings({ vat_enabled: true, vat_rate: 10, vat_mode: 'exclusive' });
  assert.deepEqual(applyVat(100, exclusive), { subtotalExVat: 100, vatAmount: 10, total: 110 });
  const inclusive = normalizeVatSettings({ vat_enabled: true, vat_rate: 10, vat_mode: 'inclusive' });
  assert.deepEqual(applyVat(110, inclusive), { subtotalExVat: 100, vatAmount: 10, total: 110 });
});

test('receipt breakdown separates rounding from discount (exclusive VAT)', () => {
  // ບິນຕົວຢ່າງ: 130,000 − 16,500 = 113,500 · ອມພ 10% = 11,350 · ຕາມລະບົບ 124,850 · ຈ່າຍຈິງ 125,000
  const b = orderVatBreakdown({
    subtotal: 113500, vat_rate: 10, vat_mode: 'exclusive', vat_amount: 11350,
    discount: 16500, member_points_discount: 10000, total: 125000,
  }, { label: 'VAT', itemsSum: 130000 });
  assert.equal(b.itemsGross, 130000);
  assert.equal(b.discount, 16500);   // ໃບບິນສະແດງສ່ວນຫຼຸດລວມແຖວດຽວ (ບໍ່ແຍກແຕ້ມ/ໂປຣ)
  assert.equal(b.beforeVat, 113500);
  assert.equal(b.vatAmount, 11350);
  assert.equal(b.systemTotal, 124850);
  assert.equal(b.rounding, 150);
  assert.equal(b.total, 125000);
  // ບິນຕ້ອງບວກລົງຕົວທັງສອງທ່ອນ
  assert.equal(b.itemsGross - b.discount, b.beforeVat);
  assert.equal(b.beforeVat + b.vatAmount + b.rounding, b.total);
  assert.equal(b.grandTotalLabel, 'ລວມທັງໝົດທີ່ຊຳລະ');
});

test('credit bills label the grand total as still owed', () => {
  const paid = { subtotal: 113500, vat_rate: 10, vat_amount: 11350, discount: 0, total: 125000 };
  assert.equal(orderVatBreakdown(paid, {}).grandTotalLabel, 'ລວມທັງໝົດທີ່ຊຳລະ');
  assert.equal(orderVatBreakdown({ ...paid, payment_method: 'credit' }, {}).grandTotalLabel, 'ລວມທັງໝົດທີ່ຕ້ອງຊຳລະ');
  // ບໍ່ໄດ້ປັດເສດ → ບໍ່ຕ້ອງເວົ້າເຖິງການຊຳລະ ໃຊ້ "ລວມທັງໝົດ" ຄືເກົ່າ
  assert.equal(orderVatBreakdown({ ...paid, total: 124850, payment_method: 'credit' }, {}).grandTotalLabel, 'ລວມທັງໝົດ');
});

test('receipt breakdown handles inclusive VAT and bills without rounding', () => {
  const incl = orderVatBreakdown({
    subtotal: 100000, vat_rate: 10, vat_mode: 'inclusive', vat_amount: 10000,
    discount: 20000, total: 110000,
  }, { label: 'VAT', itemsSum: 130000 });
  assert.equal(incl.systemTotal, 110000);
  assert.equal(incl.discount, 20000);      // ລາຄາລວມ ອມພ ແລ້ວ → ຫຼຸດຈາກຍອດລວມ ອມພ
  assert.equal(incl.beforeVat, 100000);
  assert.equal(incl.rounding, 0);
  assert.equal(incl.hasRounding, false);

  // ບິນເກົ່າທີ່ບໍ່ໄດ້ບັນທຶກ subtotal ໄວ້ — ຕ້ອງບໍ່ຂຶ້ນແຖວປັດເສດຫຼອກ
  const legacy = orderVatBreakdown({ total: 50000, discount: 0 }, {});
  assert.equal(legacy.rounding, 0);
  assert.equal(legacy.systemTotal, 50000);
  assert.equal(legacy.total, 50000);
});

test('bill rounding supports nearest, up, and down', () => {
  assert.equal(applyRounding(102, { rounding_mode: 'nearest', rounding_step: 5 }).rounded, 100);
  assert.equal(applyRounding(101, { rounding_mode: 'up', rounding_step: 5 }).rounded, 105);
  assert.equal(applyRounding(104, { rounding_mode: 'down', rounding_step: 5 }).rounded, 100);
});

test('login limiter blocks attempts above its configured limit', () => {
  const key = `test:${Date.now()}`;
  assert.equal(consumeRateLimit(key, { limit: 2 }).allowed, true);
  assert.equal(consumeRateLimit(key, { limit: 2 }).allowed, true);
  assert.equal(consumeRateLimit(key, { limit: 2 }).allowed, false);
  clearRateLimit(key);
});

test('Excel import reads the first worksheet without the vulnerable xlsx package', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Products');
  sheet.addRows([['product_code', 'product_name'], ['P001', 'Test product']]);
  const buffer = await workbook.xlsx.writeBuffer();
  const rows = await readFirstWorksheet({ arrayBuffer: async () => buffer });
  assert.deepEqual(rowsToObjects(rows), [{ product_code: 'P001', product_name: 'Test product' }]);
});

test('supplier sync fills only missing fields — it never overwrites existing product data', () => {
  const existing = {
    product_code: 'LOCAL-1', product_name: 'ຊື່ທີ່ພະນັກງານແກ້ໄວ້', barcode: '',
    category: 'ເຄື່ອງດື່ມ', brand: null, unit: 'ແກ້ວ', supplier_name: 'ຜູ້ສະໜອງ ກ',
  };
  const incoming = {
    product_code: 'REMOTE-9', product_name: 'remote name', barcode: '8850001',
    category: 'ອື່ນໆ', brand: 'Pepsi', unit: 'ຂວດ',
  };
  const merged = mergeExistingProduct(existing, incoming, 'ຜູ້ສະໜອງ ຂ');

  // ຄ່າທີ່ມີຢູ່ແລ້ວຄືເກົ່າໝົດ — ບໍ່ຖືກທັບ
  assert.equal(merged.product_code, 'LOCAL-1');
  assert.equal(merged.category, 'ເຄື່ອງດື່ມ');
  assert.equal(merged.unit, 'ແກ້ວ');
  assert.equal(merged.supplier_name, 'ຜູ້ສະໜອງ ກ');
  // ຊ່ອງທີ່ຫວ່າງ (barcode='' , brand=null) ຈຶ່ງຖືກຕື່ມ
  assert.equal(merged.barcode, '8850001');
  assert.equal(merged.brand, 'Pepsi');
  // ຊື່ບໍ່ຢູ່ໃນຊຸດທີ່ອັບເດດເລີຍ
  assert.equal(merged.product_name, undefined);
});

test('supplier sync leaves a product untouched when the feed has nothing new', () => {
  const existing = { product_code: 'A1', barcode: '111', category: 'ນ້ຳ', brand: 'B', unit: 'ອັນ', supplier_name: 'S' };
  const merged = mergeExistingProduct(existing, { product_code: 'A1', barcode: '111' }, 'S');
  for (const field of ['product_code', 'barcode', 'category', 'brand', 'unit', 'supplier_name']) {
    assert.equal(merged[field], existing[field]);
  }
});

test('member TIN accepts exactly 12 digits and keeps leading zeros as text', () => {
  assert.deepEqual(normalizeTaxId('012345678901'), { ok: true, value: '012345678901' });
  assert.deepEqual(normalizeTaxId(' 123-456-789-012 '), { ok: true, value: '123456789012' });
  assert.deepEqual(normalizeTaxId(''), { ok: true, value: null });
  assert.equal(normalizeTaxId('12345678901').ok, false);      // 11 ຕົວ
  assert.equal(normalizeTaxId('1234567890123').ok, false);    // 13 ຕົວ
  assert.equal(normalizeTaxId('12345678901A').ok, false);     // ມີຕົວອັກສອນ
  assert.equal(digitsOnly('12a34-5678901234'), '123456789012');
});

test('POS return button needs the "edit" tick on /admin/returns — "access" alone is not enough', () => {
  const cashier = (perm) => ({ role: 'cashier', permissions: normalizeRolePermissions({ '/admin/returns': perm }, 'cashier') });
  // ຕິກແຕ່ 👁 ເຂົ້າ → ເບິ່ງໄດ້ ແຕ່ຮັບຄືນບໍ່ໄດ້ (ປຸ່ມໃນ POS ບໍ່ຂຶ້ນ)
  assert.equal(pagePermission(cashier({ access: true }), '/admin/returns').edit, false);
  // ຕິກ ✏️ ແກ້ → ປຸ່ມ "ຮັບຄືນ" ຂຶ້ນ
  assert.equal(pagePermission(cashier({ access: true, edit: true }), '/admin/returns').edit, true);
  // ບໍ່ຕິກ 👁 ເຂົ້າ ແຕ່ຕິກ ✏️ ແກ້ → ຖືກດັບຕອນບັນທຶກ (edit ຕ້ອງມາຄູ່ກັບ access)
  assert.equal(pagePermission(cashier({ edit: true }), '/admin/returns').edit, false);
});

test('users who never had permissions set keep POS returns working (legacy fallback)', () => {
  assert.equal(pagePermission({ role: 'cashier', permissions: {} }, '/admin/returns').edit, true);
});
