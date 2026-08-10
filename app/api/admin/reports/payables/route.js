export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { buildDebtReport } from '@/lib/debtReport';

// ລາຍງານໜີ້ຄ້າງສົ່ງ (ຜູ້ສະໜອງ) — ບິນຊື້ທີ່ຍັງຈ່າຍບໍ່ຄົບ
const BASE_CTE = `
  WITH base AS (
    SELECT
      p.id,
      COALESCE(NULLIF(TRIM(p.ref_number), ''), '#' || p.id) AS ref,
      COALESCE(s.id::text, 'none') AS party_key,
      COALESCE(NULLIF(TRIM(s.name), ''), 'ບໍ່ລະບຸຜູ້ສະໜອງ') AS party_name,
      NULLIF(TRIM(COALESCE(s.phone, s.contact_phone, '')), '') AS party_sub,
      p.created_at AS doc_date,
      p.due_date,
      COALESCE(p.total, 0) AS total,
      COALESCE(p.paid, 0) AS paid,
      GREATEST(0, COALESCE(p.total, 0) - COALESCE(p.paid, 0)) AS remaining
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE COALESCE(p.total, 0) > COALESCE(p.paid, 0)
      AND ($1::date IS NULL OR p.created_at::date >= $1::date)
      AND ($2::date IS NULL OR p.created_at::date <= $2::date)
  )
`;

export const GET = handle(async (request) => {
  const { from, to, party, sort } = getQuery(request);
  const data = await buildDebtReport(pool, { baseCte: BASE_CTE, from, to, party, sort });
  return ok(data);
});
