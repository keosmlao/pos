export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { syncSingleSupplier } from '@/lib/supplierSync';

export const POST = handle(async (request) => {
  const { supplier_id } = await readJson(request);
  const params = [];
  let filter = `
    WHERE api_enabled = true
      AND COALESCE(TRIM(api_url), '') <> ''
      AND (
        jsonb_array_length(COALESCE(api_cust_codes, '[]'::jsonb)) > 0
        OR COALESCE(TRIM(api_cust_code), '') <> ''
      )
  `;
  if (supplier_id) {
    params.push(supplier_id);
    filter += ` AND id = $1`;
  }

  const suppliersResult = await pool.query(
    `SELECT * FROM suppliers ${filter} ORDER BY name`,
    params
  );

  if (suppliersResult.rows.length === 0) {
    return fail(400, supplier_id ? 'ຜູ້ສະໜອງນີ້ບໍ່ໄດ້ຕັ້ງ Supplier API' : 'ຍັງບໍ່ມີຜູ້ສະໜອງທີ່ຕັ້ງ Supplier API (api_url + cust_code)');
  }

  const summary = {
    suppliers_checked: suppliersResult.rows.length,
    suppliers_synced: 0,
    inserted_count: 0,
    updated_count: 0,
    skipped_count: 0,
    categories_added: 0,
    brands_added: 0,
    units_added: 0,
    failed_count: 0,
    results: [],
  };

  for (const supplier of suppliersResult.rows) {
    try {
      const result = await syncSingleSupplier(supplier);
      summary.suppliers_synced += 1;
      summary.inserted_count += result.inserted;
      summary.updated_count += result.updated;
      summary.skipped_count += result.skipped;
      summary.categories_added += result.categories_added;
      summary.brands_added += result.brands_added;
      summary.units_added += result.units_added;
      summary.results.push({ ...result, success: true });
    } catch (error) {
      summary.failed_count += 1;
      summary.results.push({
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        success: false,
        error: error.message,
      });
    }
  }

  return ok(summary);
});