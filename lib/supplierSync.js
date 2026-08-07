import pool from './db';
import { isEmpty, MERGED_FIELDS, mergeExistingProduct } from './productMerge';

function cleanText(value) {
  if (value == null) return undefined;
  const str = String(value).trim();
  return str ? str : undefined;
}

function cleanNumber(value) {
  if (value == null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function buildSupplierUrl(supplier, custCode, subPath = '') {
  const base = String(supplier.api_url || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('Supplier API URL is empty');
  if (!custCode) throw new Error('cust_code is empty');
  const encoded = encodeURIComponent(String(custCode).trim());
  const hashkey = supplier.api_hashkey ? `?hashkey=${encodeURIComponent(String(supplier.api_hashkey).trim())}` : '';
  const suffix = subPath ? `/${subPath.replace(/^\/+/, '')}` : '';
  return `${base}/${encoded}${suffix}${hashkey}`;
}

export function resolveCustCodes(supplier) {
  const raw = supplier.api_cust_codes;
  const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw || '[]') : []);
  const cleaned = (arr || []).map((c) => String(c).trim()).filter(Boolean);
  if (cleaned.length > 0) return cleaned;
  if (supplier.api_cust_code && String(supplier.api_cust_code).trim()) {
    return [String(supplier.api_cust_code).trim()];
  }
  return [];
}

async function fetchSupplierJson(supplier, custCode, subPath = '') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const url = buildSupplierUrl(supplier, custCode, subPath);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Supplier API responded with ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Supplier API request timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

const fetchSupplierPayload = (supplier, custCode) => fetchSupplierJson(supplier, custCode);

async function fetchMasterList(supplier, custCode, subPath) {
  try {
    const data = await fetchSupplierJson(supplier, custCode, subPath);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function extractRemoteProducts(payload) {
  const extracted = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data) ? payload.data
    : Array.isArray(payload?.items) ? payload.items
    : Array.isArray(payload?.products) ? payload.products
    : null;
  if (!extracted) throw new Error('Supplier API response must be an array');
  return extracted;
}

function normalizeRemoteProduct(remoteProduct) {
  const productName = cleanText(remoteProduct?.name_1);
  if (!productName) return null;
  return {
    product_code: cleanText(remoteProduct?.code),
    product_name: productName,
    barcode: cleanText(remoteProduct?.barcode),
    category: cleanText(remoteProduct?.cat_name) || cleanText(remoteProduct?.cat_code),
    brand: cleanText(remoteProduct?.item_brand),
    cost_price: cleanNumber(remoteProduct?.unit_code),
    selling_price: undefined,
    qty_on_hand: undefined,
    unit: undefined,
  };
}

async function findExistingProduct(client, supplierName, normalizedProduct) {
  if (normalizedProduct.barcode) {
    const byBarcode = await client.query('SELECT * FROM products WHERE barcode = $1 LIMIT 1', [normalizedProduct.barcode]);
    if (byBarcode.rows.length > 0) return byBarcode.rows[0];
  }
  if (normalizedProduct.product_code) {
    const byCode = await client.query('SELECT * FROM products WHERE product_code = $1 LIMIT 1', [normalizedProduct.product_code]);
    if (byCode.rows.length > 0) return byCode.rows[0];
  }
  const byName = await client.query(
    'SELECT * FROM products WHERE supplier_name = $1 AND product_name = $2 LIMIT 1',
    [supplierName, normalizedProduct.product_name]
  );
  return byName.rows[0] || null;
}

// ຫາສິນຄ້າ "ຕົວອື່ນ" ທີ່ໃຊ້ລະຫັດ ຫຼື ບາໂຄດຊ້ຳກັນ (ບໍ່ນັບຕົວເອງ)
// ໃຊ້ client ດຽວກັນກັບ transaction ເພື່ອໃຫ້ເຫັນແຖວທີ່ຫາກໍ insert ໃນຮອບ sync ນີ້
async function findConflictingProduct(client, { product_code, barcode }, excludeId = null) {
  const code = String(product_code || '').trim();
  const bc = String(barcode || '').trim();
  if (!code && !bc) return null;
  const result = await client.query(
    `SELECT * FROM products
      WHERE (($1 <> '' AND product_code = $1) OR ($2 <> '' AND barcode = $2))
        AND ($3::int IS NULL OR id <> $3::int)
      LIMIT 1`,
    [code, bc, excludeId]
  );
  return result.rows[0] || null;
}

function mergeProductData(existingProduct, normalizedProduct, supplierName) {
  return {
    product_code: normalizedProduct.product_code ?? existingProduct?.product_code ?? null,
    product_name: normalizedProduct.product_name ?? existingProduct?.product_name,
    barcode: normalizedProduct.barcode ?? existingProduct?.barcode ?? null,
    category: normalizedProduct.category ?? existingProduct?.category ?? null,
    brand: normalizedProduct.brand ?? existingProduct?.brand ?? null,
    cost_price: normalizedProduct.cost_price ?? existingProduct?.cost_price ?? 0,
    selling_price: normalizedProduct.selling_price ?? existingProduct?.selling_price ?? 0,
    qty_on_hand: normalizedProduct.qty_on_hand ?? existingProduct?.qty_on_hand ?? 0,
    min_stock: existingProduct?.min_stock ?? 5,
    unit: normalizedProduct.unit ?? existingProduct?.unit ?? 'ອັນ',
    expiry_date: existingProduct?.expiry_date ?? null,
    supplier_name: supplierName,
    status: existingProduct?.status ?? true,
  };
}

export async function syncSingleSupplier(supplier) {
  const custCodes = resolveCustCodes(supplier);
  if (custCodes.length === 0) throw new Error('ບໍ່ມີ cust_code ສຳລັບ sync');

  const allRemoteProducts = [];
  const masterCategories = new Set();
  const masterBrands = new Set();
  const masterUnits = new Set();

  for (const custCode of custCodes) {
    const payload = await fetchSupplierPayload(supplier, custCode);
    const items = extractRemoteProducts(payload);
    allRemoteProducts.push(...items);

    const [cats, brands, units] = await Promise.all([
      fetchMasterList(supplier, custCode, 'categories'),
      fetchMasterList(supplier, custCode, 'brands'),
      fetchMasterList(supplier, custCode, 'units'),
    ]);
    for (const row of cats) {
      const name = cleanText(row?.cat_name) || cleanText(row?.cat_code);
      if (name) masterCategories.add(name);
    }
    for (const row of brands) {
      const name = cleanText(row?.brand);
      if (name) masterBrands.add(name);
    }
    for (const row of units) {
      const name = cleanText(row?.unit);
      if (name) masterUnits.add(name);
    }
  }

  const client = await pool.connect();
  const result = {
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    cust_codes: custCodes,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    duplicates_prevented: 0,
    conflicts: 0,
    skipped: 0,
    categories_added: 0,
    brands_added: 0,
    units_added: 0,
  };

  try {
    await client.query('BEGIN');

    const distinctCategories = new Set(masterCategories);
    const distinctBrands = new Set(masterBrands);
    const distinctUnits = new Set(masterUnits);
    const normalized = [];
    for (const remoteProduct of allRemoteProducts) {
      const n = normalizeRemoteProduct(remoteProduct);
      if (!n) { result.skipped += 1; continue; }
      normalized.push(n);
      if (n.category) distinctCategories.add(n.category);
      if (n.brand) distinctBrands.add(n.brand);
      if (n.unit) distinctUnits.add(n.unit);
    }

    for (const name of distinctCategories) {
      const r = await client.query(
        `INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [name]
      );
      result.categories_added += r.rowCount;
    }
    for (const name of distinctBrands) {
      const r = await client.query(
        `INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [name]
      );
      result.brands_added += r.rowCount;
    }
    for (const name of distinctUnits) {
      const r = await client.query(
        `INSERT INTO units (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [name]
      );
      result.units_added += r.rowCount;
    }

    for (const normalizedProduct of normalized) {
      let existingProduct = await findExistingProduct(client, supplier.name, normalizedProduct);

      // ບໍ່ພົບຕົວກົງ ແຕ່ລະຫັດ/ບາໂຄດຊ້ຳກັບສິນຄ້າຕົວອື່ນ → ຖືວ່າເປັນຕົວດຽວກັນ
      // ບໍ່ສ້າງຕົວໃໝ່ (ກັນບາໂຄດຊ້ຳໃນຖານຂໍ້ມູນ)
      if (!existingProduct) {
        const conflict = await findConflictingProduct(client, normalizedProduct);
        if (conflict) {
          existingProduct = conflict;
          result.duplicates_prevented += 1;
        }
      }

      if (existingProduct) {
        const patch = mergeExistingProduct(existingProduct, normalizedProduct, supplier.name);

        // ຢ່າ "ຍາດ" ລະຫັດ/ບາໂຄດຂອງສິນຄ້າຕົວອື່ນມາໃສ່ຕົວນີ້
        for (const field of ['product_code', 'barcode']) {
          if (isEmpty(patch[field]) || patch[field] === existingProduct[field]) continue;
          const taken = await findConflictingProduct(client, { [field]: patch[field] }, existingProduct.id);
          if (taken) {
            patch[field] = existingProduct[field] ?? null;
            result.conflicts += 1;
          }
        }

        const changed = MERGED_FIELDS.some(f => patch[f] !== (existingProduct[f] ?? null));
        if (!changed) { result.unchanged += 1; continue; }

        await client.query(
          `UPDATE products SET
            product_code=$1, barcode=$2, category=$3, brand=$4, unit=$5, supplier_name=$6
           WHERE id=$7`,
          [
            patch.product_code, patch.barcode, patch.category,
            patch.brand, patch.unit, patch.supplier_name, existingProduct.id
          ]
        );
        result.updated += 1;
      } else {
        const mergedProduct = mergeProductData(null, normalizedProduct, supplier.name);
        await client.query(
          `INSERT INTO products (
            product_code, product_name, barcode, category, brand, cost_price, selling_price,
            qty_on_hand, min_stock, unit, expiry_date, supplier_name, status
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            mergedProduct.product_code, mergedProduct.product_name, mergedProduct.barcode, mergedProduct.category,
            mergedProduct.brand, mergedProduct.cost_price, mergedProduct.selling_price, mergedProduct.qty_on_hand,
            mergedProduct.min_stock, mergedProduct.unit, mergedProduct.expiry_date, mergedProduct.supplier_name,
            mergedProduct.status
          ]
        );
        result.inserted += 1;
      }
    }

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
