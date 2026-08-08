// ສູດລາຍຮັບ/ຕົ້ນທຶນຕໍ່ລາຍການ — ແຫຼ່ງດຽວ ໃຊ້ຮ່ວມກັນລະຫວ່າງ
// ລາຍງານກຳໄລ/COGS ແລະ ແຜງຄວບຄຸມ ເພື່ອບໍ່ໃຫ້ຕົວເລກສອງໜ້າຂັດກັນ
//
// ຫຼັກການ: ສ່ວນຫຼຸດຕາມບິນ (ລວມຫຼຸດດ້ວຍແຕ້ມ) ແລະ VAT ແບບລວມໃນລາຄາ ຖືກ
// "ປັນສ່ວນ" ລົງແຕ່ລະລາຍການຕາມສັດສ່ວນມູນຄ່າ ກ່ອນຄິດກຳໄລ — ບໍ່ດັ່ງນັ້ນຈະນັບ
// ເງິນສ່ວນຫຼຸດທີ່ບໍ່ໄດ້ຮັບເປັນລາຍຮັບ ແລ້ວກຳໄລເກີນຈິງ
//
// ຊື່ຄໍລຳທີ່ໃຊ້ໄດ້ຈາກ line_net:
//   line_gross            ມູນຄ່າຕາມລາຄາປ້າຍ (ຈຳນວນ × ລາຄາ)
//   line_cost             ຕົ້ນທຶນ (ໃຊ້ snapshot ຕອນຂາຍ ຖ້າມີ)
//   line_revenue_inc_vat  ຫຼັງຫັກສ່ວນຫຼຸດ (ຍັງລວມ VAT)
//   line_revenue_ex_vat   ຫຼັງຫັກສ່ວນຫຼຸດ ແລະ VAT → ໃຊ້ຄິດກຳໄລ

/**
 * @param {string} whereSql  ເງື່ອນໄຂກັ່ນຕອງບິນ ເຊັ່ນ "WHERE o.created_at >= ..."
 * @returns {string} ຕົວ CTE (ບໍ່ມີຄຳວ່າ WITH) — ໃຊ້ເປັນ `WITH ${lineRevenueCTE(w)} SELECT ...`
 */
export function lineRevenueCTE(whereSql = '') {
  return `
    order_totals AS (
      SELECT o.id, o.created_at,
             COALESCE(SUM(oi.quantity * oi.price), 0) AS gross,
             COALESCE(o.discount, 0) AS discount,
             COALESCE(o.vat_amount, 0) AS vat_amount,
             o.vat_mode
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      ${whereSql}
      GROUP BY o.id, o.created_at, o.discount, o.vat_amount, o.vat_mode
    ),
    line_items AS (
      SELECT oi.order_id,
             oi.product_id,
             oi.quantity,
             oi.price,
             p.product_name,
             p.product_code,
             p.cost_price,
             p.category AS category_name,
             (oi.quantity * oi.price) AS line_gross,
             (oi.quantity * COALESCE(oi.cost_price, p.cost_price, 0)) AS line_cost,
             ot.gross AS order_gross,
             ot.discount AS order_discount,
             ot.vat_amount AS order_vat,
             ot.vat_mode,
             ot.created_at,
             CASE WHEN ot.gross > 0
               THEN (oi.quantity * oi.price) / ot.gross
               ELSE 0
             END AS line_share
      FROM order_items oi
      JOIN order_totals ot ON ot.id = oi.order_id
      LEFT JOIN products p ON p.id = oi.product_id
    ),
    line_net AS (
      SELECT *,
             (line_gross - line_share * order_discount) AS line_revenue_inc_vat,
             CASE WHEN vat_mode = 'inclusive'
               THEN (line_gross - line_share * order_discount) - line_share * order_vat
               ELSE (line_gross - line_share * order_discount)
             END AS line_revenue_ex_vat
      FROM line_items
    )
  `;
}

/** ເງື່ອນໄຂ "ເດືອນນີ້" ທີ່ແຜງຄວບຄຸມໃຊ້ */
export const THIS_MONTH_WHERE = `WHERE o.created_at >= DATE_TRUNC('month', CURRENT_DATE)`;
