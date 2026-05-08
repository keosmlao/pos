export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensurePendingInvoicesSchema } from '@/lib/migrations';
import { resolveCustCodes, fetchSupplierJson } from '@/lib/supplierApi';

export const POST = handle(async (request) => {
  await ensurePendingInvoicesSchema();
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
    return fail(400, 'ຍັງບໍ່ມີຜູ້ສະໜອງທີ່ຕັ້ງ Supplier API');
  }

  const summary = {
    suppliers_checked: suppliersResult.rows.length,
    suppliers_synced: 0,
    inserted_count: 0,
    skipped_count: 0,
    failed_count: 0,
    results: [],
  };

  for (const supplier of suppliersResult.rows) {
    const result = { supplier_id: supplier.id, supplier_name: supplier.name, inserted: 0, skipped: 0, errors: [] };
    try {
      const custCodes = resolveCustCodes(supplier);

      for (const custCode of custCodes) {
        let invoices = [];
        try {
          invoices = await fetchSupplierJson(supplier, custCode, '', 'invoice');
          if (!Array.isArray(invoices)) invoices = [];
        } catch (e) {
          result.errors.push(`${custCode}: ${e.message}`);
          continue;
        }

        for (const inv of invoices) {
          const docNo = String(inv.doc_no || '').trim();
          if (!docNo) continue;

          const purchaseExists = await pool.query(
            `SELECT id FROM purchases WHERE supplier_id = $1 AND sml_doc_no = $2`,
            [supplier.id, docNo]
          );
          if (purchaseExists.rows.length > 0) {
            result.skipped += 1;
            continue;
          }

          const pendingExists = await pool.query(
            `SELECT id, items FROM pending_invoices WHERE supplier_id = $1 AND doc_no = $2`,
            [supplier.id, docNo]
          );

          if (pendingExists.rows.length > 0) {
            const existingItems = Array.isArray(pendingExists.rows[0].items) ? pendingExists.rows[0].items : [];
            const hasPriceData = existingItems.some((it) => Number(it?.price) > 0 || Number(it?.sum_amount) > 0);
            if (hasPriceData) {
              result.skipped += 1;
              continue;
            }
            let items = [];
            try {
              items = await fetchSupplierJson(supplier, custCode, docNo, 'invoice');
              if (!Array.isArray(items)) items = [];
            } catch (e) {
              result.errors.push(`${docNo}: ${e.message}`);
              continue;
            }
            await pool.query(
              `UPDATE pending_invoices SET items = $1::jsonb, header = $2::jsonb WHERE id = $3`,
              [JSON.stringify(items), JSON.stringify(inv), pendingExists.rows[0].id]
            );
            result.skipped += 1;
            continue;
          }

          let items = [];
          try {
            items = await fetchSupplierJson(supplier, custCode, docNo, 'invoice');
            if (!Array.isArray(items)) items = [];
          } catch (e) {
            result.errors.push(`${docNo}: ${e.message}`);
            continue;
          }

          await pool.query(
            `INSERT INTO pending_invoices (supplier_id, cust_code, doc_no, doc_date, sale_code, items, header)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
            [supplier.id, custCode, docNo, inv.doc_date || null, inv.sale_code || null, JSON.stringify(items), JSON.stringify(inv)]
          );
          result.inserted += 1;
          summary.inserted_count += 1;
        }
      }

      summary.suppliers_synced += 1;
      summary.skipped_count += result.skipped;
      summary.results.push({ ...result, success: true });
    } catch (error) {
      summary.failed_count += 1;
      summary.results.push({ ...result, success: false, error: error.message });
    }
  }

  return ok(summary);
});