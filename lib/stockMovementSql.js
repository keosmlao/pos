// ການເຄື່ອນໄຫວສິນຄ້າ — ແຫຼ່ງ SQL ດຽວ ໃຊ້ຮ່ວມກັນລະຫວ່າງ
// ໜ້າ "ການເຄື່ອນໄຫວສິນຄ້າ" (ຈຳນວນ) ແລະ "ຕົ້ນທຶນສິນຄ້າ" (ຈຳນວນ + ມູນຄ່າ)
//
// ລະບົບບໍ່ມີຕາຕະລາງ ledger ແຍກ — ຈຶ່ງປະກອບຂຶ້ນຈາກເອກະສານຈິງ
//
// ຕົ້ນທຶນຕໍ່ໜ່ວຍ (unit_cost) ມາຈາກໃສ:
//   ຊື້ເຂົ້າ / ສົ່ງຄືນຜູ້ສະໜອງ → ລາຄາຊື້ໃນເອກະສານນັ້ນ (ຄ່າຈິງ)
//   ບິນຂາຍ / ຮັບຄືນ           → ຕົ້ນທຶນ snapshot ຕອນຂາຍ (oi.cost_price)
//   ປັບປຸງ / ນັບ / ຝາກຂາຍ      → ບໍ່ມີບັນທຶກ → ໃຊ້ຕົ້ນທຶນປັດຈຸບັນຂອງສິນຄ້າ (ປະມານ)

export const DOC_TYPES = {
  opening: 'ຍອດຍົກມາ',
  sale: 'ບິນຂາຍ',
  return: 'ຮັບຄືນ',
  purchase: 'ຊື້ເຂົ້າ',
  adjustment: 'ປັບປຸງສະຕັອກ',
  stock_take: 'ນັບສິນຄ້າ',
  purchase_return: 'ສົ່ງຄືນຜູ້ສະໜອງ',
  layby: 'ຝາກຂາຍ (ຈອງ)',
  layby_cancel: 'ຍົກເລີກຝາກຂາຍ',
};

// Parameters: $1 = product_id (int|null) · $2 = search pattern (text|null)
export const MOVEMENTS_CTE = `
  prod AS (
    SELECT p.id, p.product_code, p.product_name, COALESCE(p.unit, '') AS unit,
           COALESCE(p.qty_on_hand, 0)::numeric AS qty_on_hand,
           COALESCE(p.cost_price, 0)::numeric AS cost_now
    FROM products p
    WHERE ($1::int IS NULL OR p.id = $1::int)
      AND ($2::text IS NULL
           OR LOWER(p.product_name) LIKE $2
           OR LOWER(COALESCE(p.product_code, '')) LIKE $2
           OR LOWER(COALESCE(p.barcode, '')) LIKE $2)
  ),
  mv AS (
    -- ບິນຂາຍ (ຍົກເວັ້ນບິນທີ່ເກີດຈາກການປິດຝາກຂາຍແບບຈອງສິນຄ້າ)
    SELECT o.created_at AS doc_at, 'sale' AS doc_type,
           COALESCE(NULLIF(o.bill_number, ''), '#' || o.id) AS doc_no,
           oi.product_id, 0::numeric AS qty_in, oi.quantity::numeric AS qty_out,
           COALESCE(NULLIF(o.customer_name, ''), 'ລູກຄ້າທົ່ວໄປ') AS partner,
           o.id AS ref_id,
           COALESCE(oi.cost_price, 0)::numeric AS unit_cost
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE oi.product_id IN (SELECT id FROM prod)
      AND NOT EXISTS (
        SELECT 1 FROM laybys l JOIN layby_items li ON li.layby_id = l.id
        WHERE l.completed_order_id = o.id
      )

    UNION ALL
    -- ຮັບຄືນຈາກລູກຄ້າ (ຕົ້ນທຶນເອົາຈາກລາຍການຂາຍເດີມ)
    SELECT r.created_at, 'return',
           COALESCE(NULLIF(r.return_number, ''), '#' || r.id),
           ri.product_id, ri.quantity::numeric, 0::numeric,
           COALESCE(NULLIF(o.customer_name, ''), 'ລູກຄ້າທົ່ວໄປ'), r.id,
           COALESCE(oi.cost_price, 0)::numeric
    FROM return_items ri
    JOIN returns r ON r.id = ri.return_id
    LEFT JOIN orders o ON o.id = r.order_id
    LEFT JOIN order_items oi ON oi.id = ri.order_item_id
    WHERE ri.product_id IN (SELECT id FROM prod)

    UNION ALL
    -- ຊື້ເຂົ້າ
    SELECT pu.created_at, 'purchase',
           COALESCE(NULLIF(pu.ref_number, ''), NULLIF(pu.sml_doc_no, ''), '#' || pu.id),
           pi.product_id, pi.quantity::numeric, 0::numeric,
           COALESCE(s.name, '—'), pu.id,
           COALESCE(pi.cost_price, 0)::numeric
    FROM purchase_items pi
    JOIN purchases pu ON pu.id = pi.purchase_id
    LEFT JOIN suppliers s ON s.id = pu.supplier_id
    WHERE pi.product_id IN (SELECT id FROM prod)

    UNION ALL
    -- ສົ່ງເຄື່ອງຄືນຜູ້ສະໜອງ
    SELECT pr.created_at, 'purchase_return',
           COALESCE(NULLIF(pr.return_number, ''), '#' || pr.id),
           pri.product_id, 0::numeric, pri.quantity::numeric,
           COALESCE(s2.name, '—'), pr.id,
           COALESCE(pri.net_price, pri.cost_price, 0)::numeric
    FROM purchase_return_items pri
    JOIN purchase_returns pr ON pr.id = pri.purchase_return_id
    LEFT JOIN suppliers s2 ON s2.id = pr.supplier_id
    WHERE pri.product_id IN (SELECT id FROM prod)

    UNION ALL
    -- ປັບປຸງສະຕັອກ · ນັບສິນຄ້າ · ຍອດຍົກມາ (ນັບສິນຄ້າຂຽນ mirror ໄວ້ໃນຕາຕະລາງນີ້ຢູ່ແລ້ວ)
    SELECT COALESCE(sa.approved_at, sa.created_at),
           CASE sa.adjustment_type
             WHEN 'stock_take' THEN 'stock_take'
             WHEN 'opening' THEN 'opening'
             ELSE 'adjustment' END,
           COALESCE(NULLIF(sa.adjustment_number, ''), '#' || sa.id),
           sa.product_id,
           GREATEST(COALESCE(sa.delta, 0), 0)::numeric,
           GREATEST(-COALESCE(sa.delta, 0), 0)::numeric,
           COALESCE(NULLIF(sa.reason, ''), COALESCE(sa.username, '—')), sa.id,
           (SELECT COALESCE(p2.cost_price, 0) FROM products p2 WHERE p2.id = sa.product_id)::numeric
    FROM stock_adjustments sa
    WHERE sa.product_id IN (SELECT id FROM prod)
      AND (sa.status = 'approved' OR sa.status IS NULL)
      AND COALESCE(sa.delta, 0) <> 0

    UNION ALL
    -- ຝາກຂາຍ — ຕັດສະຕັອກຕອນຈອງ
    SELECT l.created_at, 'layby',
           COALESCE(NULLIF(l.layby_number, ''), '#' || l.id),
           li.product_id, 0::numeric, li.quantity::numeric,
           COALESCE(NULLIF(l.customer_name, ''), 'ລູກຄ້າທົ່ວໄປ'), l.id,
           (SELECT COALESCE(p3.cost_price, 0) FROM products p3 WHERE p3.id = li.product_id)::numeric
    FROM layby_items li
    JOIN laybys l ON l.id = li.layby_id
    WHERE li.product_id IN (SELECT id FROM prod)

    UNION ALL
    -- ຍົກເລີກຝາກຂາຍ
    SELECT COALESCE(l.cancelled_at, l.updated_at, l.created_at), 'layby_cancel',
           COALESCE(NULLIF(l.layby_number, ''), '#' || l.id),
           li.product_id, li.quantity::numeric, 0::numeric,
           COALESCE(NULLIF(l.customer_name, ''), 'ລູກຄ້າທົ່ວໄປ'), l.id,
           (SELECT COALESCE(p4.cost_price, 0) FROM products p4 WHERE p4.id = li.product_id)::numeric
    FROM layby_items li
    JOIN laybys l ON l.id = li.layby_id
    WHERE li.product_id IN (SELECT id FROM prod)
      AND l.status = 'cancelled'
  ),
  mv_run AS (
    SELECT m.*, p.product_code, p.product_name, p.unit, p.qty_on_hand, p.cost_now,
           (m.qty_in - m.qty_out) AS qty_net,
           SUM(m.qty_in - m.qty_out) OVER (
             PARTITION BY m.product_id ORDER BY m.doc_at, m.doc_type, m.ref_id
             ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum_net,
           SUM(m.qty_in - m.qty_out) OVER (PARTITION BY m.product_id) AS total_net
    FROM mv m JOIN prod p ON p.id = m.product_id
  )
`;
