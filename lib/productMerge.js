// ກົດເກນລວມຂໍ້ມູນສິນຄ້າຕອນ sync — ແຍກອອກມາຈາກ supplierSync.js ເພື່ອໃຫ້ test ໄດ້
// ໂດຍບໍ່ຕ້ອງຕໍ່ຖານຂໍ້ມູນ

export const isEmpty = (value) => value === null || value === undefined || String(value).trim() === '';

// ຊ່ອງທີ່ sync ແຕະໄດ້ — ນອກນັ້ນ (ຊື່, ລາຄາ, ຈຳນວນ, ສະຖານະ) ບໍ່ຖືກແຕະເລີຍ
export const MERGED_FIELDS = ['product_code', 'barcode', 'category', 'brand', 'unit', 'supplier_name'];

// ອັບເດດແບບ "ຕື່ມສ່ວນທີ່ຂາດ" ເທົ່ານັ້ນ — ຂໍ້ມູນເກົ່າທີ່ມີຢູ່ແລ້ວບໍ່ຖືກທັບ ຫຼື ລຶບ
export function mergeExistingProduct(existingProduct, normalizedProduct, supplierName) {
  const keepOrFill = (field, incoming) => (
    isEmpty(existingProduct?.[field]) ? (incoming ?? null) : existingProduct[field]
  );
  return {
    product_code: keepOrFill('product_code', normalizedProduct.product_code),
    barcode: keepOrFill('barcode', normalizedProduct.barcode),
    category: keepOrFill('category', normalizedProduct.category),
    brand: keepOrFill('brand', normalizedProduct.brand),
    unit: keepOrFill('unit', normalizedProduct.unit),
    supplier_name: keepOrFill('supplier_name', supplierName),
  };
}
