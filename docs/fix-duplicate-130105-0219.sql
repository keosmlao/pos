-- ລວມສິນຄ້າຊ້ຳ 130105-0219 (ກ໋ອກຂາແດງ SW 1/2 Fancy ສີບົວ)
-- id 928  = ບາໂຄດ 8858799702641, ສະຕັອກ 19 (ຕົວຫຼັກ — ເກັບໄວ້)
-- id 1140 = ບາໂຄດ 8858799702528, ສະຕັອກ 16 (ຕົວຊ້ຳ — ລວມແລ້ວລຶບ)
--
-- ໝາຍເຫດ: ບາໂຄດ 8858799702641 ຖືກໃຊ້ຊ້ຳກັບ id 1288 (ກ໋ອກສະໜາມ SW 1/2) ນຳ
-- ສະນັ້ນຫຼັງລວມ ຈະໃຫ້ id 928 ໃຊ້ບາໂຄດ 8858799702528 ແທນ
-- ເພື່ອໃຫ້ບາໂຄດໜຶ່ງຊີ້ຫາສິນຄ້າດຽວ (ຖ້າຕົວຈິງແມ່ນກົງກັນຂ້າມ ໃຫ້ສະຫຼັບບາໂຄດ 928/1288 ພາຍຫຼັງ)
--
-- ວິທີແລ່ນ (ອ່ານຄ່າເຊື່ອມຕໍ່ຈາກ .env ຂອງໂປຣເຈັກ ຢ່າຝັງລະຫັດໃນຄຳສັ່ງ):
--   set -a; source .env; set +a
--   PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -p "${PGPORT:-5432}" -f docs/fix-duplicate-130105-0219.sql

BEGIN;

-- ຍ້າຍປະຫວັດທັງໝົດຈາກ 1140 ໄປ 928
UPDATE order_items   SET product_id = 928 WHERE product_id = 1140;
UPDATE price_history SET product_id = 928 WHERE product_id = 1140;

-- ລວມສະຕັອກ (19 + 16 = 35) ແລະ ໃຊ້ບາໂຄດຂອງ 1140
UPDATE products
SET qty_on_hand = qty_on_hand + (SELECT qty_on_hand FROM products WHERE id = 1140),
    barcode = '8858799702528'
WHERE id = 928;

-- ລຶບຕົວຊ້ຳ
DELETE FROM products WHERE id = 1140;

COMMIT;

-- ສ້າງ unique index ກັນຊ້ຳຖາວອນ (ຈະສຳເລັດໄດ້ກໍຕໍ່ເມື່ອບໍ່ມີຂໍ້ມູນຊ້ຳຄ້າງຢູ່)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_code_unique
  ON products (product_code) WHERE product_code IS NOT NULL AND product_code <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode_unique
  ON products (barcode) WHERE barcode IS NOT NULL AND barcode <> '';

-- ກວດຜົນ
SELECT id, product_code, barcode, product_name, qty_on_hand FROM products WHERE id IN (928, 1288);
