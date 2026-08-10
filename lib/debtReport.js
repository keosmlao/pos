// ຕົວສ້າງລາຍງານໜີ້ຄ້າງ — ໃຊ້ຮ່ວມກັນລະຫວ່າງ
//   ໜີ້ຄ້າງສົ່ງ (ຜູ້ສະໜອງ)  → /api/admin/reports/payables
//   ໜີ້ຄ້າງຮັບ (ລູກຄ້າ)     → /api/admin/reports/receivables
// ທັງສອງສົ່ງ CTE ຊື່ `base` ເຂົ້າມາ ທີ່ມີຖັນ:
//   id, ref, party_key, party_name, party_sub, doc_date, due_date, total, paid, remaining
// ແລ້ວທີ່ນີ້ຈັດການ ຄັດຕາມຄູ່ຄ້າ · ຈັດລຽງ · ສະຫຼຸບ ໃຫ້ຄືກັນທັງສອງລາຍງານ.

// ຈັດລຽງ — whitelist ເທົ່ານັ້ນ (ຄ່າຈາກ query ບໍ່ເຄີຍຖືກຕໍ່ເຂົ້າ SQL ໂດຍກົງ)
export const DEBT_SORTS = {
  amount_desc: 'remaining DESC, doc_date DESC',
  amount_asc: 'remaining ASC, doc_date DESC',
};

// ຄົ້ນຫາແບບປອດໄພ — hasOwnProperty ກັນຄ່າຈາກ prototype ('constructor', '__proto__' ...)
export function resolveSort(sort) {
  return Object.prototype.hasOwnProperty.call(DEBT_SORTS, sort)
    ? DEBT_SORTS[sort]
    : DEBT_SORTS.amount_desc;
}

export async function buildDebtReport(pool, { baseCte, from, to, party, sort }) {
  const dates = [from || null, to || null];
  const partyKey = String(party || '').trim() || null;
  const orderBy = resolveSort(sort);

  // ລາຍການຄູ່ຄ້າ — ນັບຈາກຊ່ວງວັນທີເທົ່ານັ້ນ (ບໍ່ເອົາຕົວຄັດຄູ່ຄ້າມາຄິດ)
  // ເພື່ອບໍ່ໃຫ້ dropdown ຫຼຸບເຫຼືອອັນດຽວຫຼັງຜູ້ໃຊ້ເລືອກ
  const partiesRes = await pool.query(
    `${baseCte}
     SELECT party_key AS key, MIN(party_name) AS name, COUNT(*)::int AS bills,
            COALESCE(SUM(remaining), 0) AS remaining
     FROM base GROUP BY party_key ORDER BY remaining DESC, name ASC`,
    dates
  );

  const params = [...dates, partyKey];
  const filter = `WHERE ($3::text IS NULL OR party_key = $3::text)`;

  const rowsRes = await pool.query(
    `${baseCte}
     SELECT id, ref, party_key, party_name, party_sub,
            to_char(doc_date, 'YYYY-MM-DD') AS doc_date,
            to_char(due_date, 'YYYY-MM-DD') AS due_date,
            total, paid, remaining,
            CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE
                 THEN (CURRENT_DATE - due_date)::int ELSE 0 END AS days_overdue
     FROM base ${filter} ORDER BY ${orderBy}`,
    params
  );

  const summaryRes = await pool.query(
    `${baseCte}
     SELECT COUNT(*)::int AS bills,
            COUNT(DISTINCT party_key)::int AS parties,
            COALESCE(SUM(total), 0) AS total,
            COALESCE(SUM(paid), 0) AS paid,
            COALESCE(SUM(remaining), 0) AS remaining,
            COUNT(*) FILTER (WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE)::int AS overdue_bills,
            COALESCE(SUM(remaining) FILTER (WHERE due_date IS NOT NULL AND due_date < CURRENT_DATE), 0) AS overdue_remaining
     FROM base ${filter}`,
    params
  );

  return {
    summary: summaryRes.rows[0],
    parties: partiesRes.rows,
    rows: rowsRes.rows,
  };
}
