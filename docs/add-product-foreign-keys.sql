-- ລຶບແຖວກຳພ້າ + ເພີ່ມ foreign key ໃຫ້ທຸກຕາຕະລາງທີ່ອ້າງອີງ products
-- ວິທີແລ່ນ (ອ່ານຄ່າເຊື່ອມຕໍ່ຈາກ .env ຂອງໂປຣເຈັກ ຢ່າຝັງລະຫັດໃນຄຳສັ່ງ):
--   set -a; source .env; set +a
--   PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" -p "${PGPORT:-5432}" -f docs/add-product-foreign-keys.sql

BEGIN;

-- ລຶບແຖວກຳພ້າ (18 ແຖວ ຊີ້ຫາສິນຄ້າທີ່ຖືກລຶບໄປແລ້ວ)
DELETE FROM price_history ph WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = ph.product_id);

-- ຂໍ້ມູນ operational: ລຶບຕາມສິນຄ້າ (CASCADE)
ALTER TABLE price_history        ADD CONSTRAINT price_history_product_id_fkey        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE branch_stocks        ADD CONSTRAINT branch_stocks_product_id_fkey        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE stock_adjustments    ADD CONSTRAINT stock_adjustments_product_id_fkey    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE stock_take_items     ADD CONSTRAINT stock_take_items_product_id_fkey     FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE stock_transfer_items ADD CONSTRAINT stock_transfer_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- ເອກະສານທຸລະກິດ: ຫ້າມລຶບສິນຄ້າທີ່ຍັງຖືກອ້າງອີງ (RESTRICT)
ALTER TABLE layby_items            ADD CONSTRAINT layby_items_product_id_fkey            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
ALTER TABLE purchase_order_items   ADD CONSTRAINT purchase_order_items_product_id_fkey   FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
ALTER TABLE purchase_request_items ADD CONSTRAINT purchase_request_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

COMMIT;
