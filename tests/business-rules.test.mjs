import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVatSettings, applyVat } from '../lib/vat.js';
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
