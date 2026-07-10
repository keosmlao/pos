import pool from '@/lib/db';

// ກວດວ່າ product_code ຫຼື barcode ຊ້ຳກັບສິນຄ້າຕົວອື່ນບໍ
// excludeId: ຂ້າມສິນຄ້າຕົວເອງ (ໃຊ້ຕອນແກ້ໄຂ)
export async function findDuplicateProduct({ product_code, barcode, excludeId = null }) {
  const code = String(product_code || '').trim();
  const bc = String(barcode || '').trim();
  if (!code && !bc) return null;

  const result = await pool.query(
    `SELECT id, product_code, barcode, product_name FROM products
     WHERE (($1 <> '' AND product_code = $1) OR ($2 <> '' AND barcode = $2))
       AND ($3::int IS NULL OR id <> $3::int)
     LIMIT 1`,
    [code, bc, excludeId]
  );
  const existing = result.rows[0];
  if (!existing) return null;

  const field = code && existing.product_code === code
    ? `ລະຫັດສິນຄ້າ "${code}"`
    : `ບາໂຄດ "${bc}"`;
  return {
    existing,
    message: `${field} ຖືກໃຊ້ແລ້ວໂດຍສິນຄ້າ "${existing.product_name}" (ID ${existing.id}) — ກະລຸນາໃຊ້ລະຫັດ/ບາໂຄດອື່ນ`,
  };
}
