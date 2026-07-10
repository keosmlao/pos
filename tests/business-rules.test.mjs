import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVatSettings, applyVat } from '../lib/vat.js';
import { applyRounding } from '../lib/rounding.js';
import { consumeRateLimit, clearRateLimit } from '../lib/rateLimit.js';
import ExcelJS from 'exceljs';
import { readFirstWorksheet, rowsToObjects } from '../utils/excelClient.js';

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
