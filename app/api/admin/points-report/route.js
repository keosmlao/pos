export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { ensureOrdersSchema, ensureMembersSchema, ensureReturnsSchema, ensureCompanyProfileSchema } from '@/lib/migrations';

// ລາຍງານການເຄື່ອນໄຫວແຕ້ມສະສົມ
//   ໄດ້ແຕ້ມ   = orders.member_points_earned   (ບິນຂາຍ)
//   ໃຊ້ແຕ້ມ   = orders.member_points_used
//   ຫັກຄືນ    = returns.member_points_reverted (ຄືນສິນຄ້າ → ຫັກແຕ້ມທີ່ໄດ້)
//   ຄືນແຕ້ມ   = returns.member_points_restored (ຄືນສິນຄ້າ → ຄືນແຕ້ມທີ່ໃຊ້)
//   ເຄື່ອນໄຫວສຸດທິ = ໄດ້ − ໃຊ້ − ຫັກຄືນ + ຄືນແຕ້ມ
//
// ໝາຍເຫດ: ຍອດຄົງເຫຼືອ (members.points) ເປັນຍອດ ณ ປັດຈຸບັນ ບໍ່ຂຶ້ນກັບຊ່ວງວັນທີ
// ທີ່ເລືອກ — ຖ້າເລືອກຊ່ວງແຄບ ຕົວເລກເຄື່ອນໄຫວກັບຍອດຄົງເຫຼືອຈຶ່ງບໍ່ຈຳເປັນຕ້ອງກົງກັນ.

export const GET = handle(async (request) => {
  await ensureOrdersSchema();
  await ensureMembersSchema();
  await ensureReturnsSchema();
  await ensureCompanyProfileSchema();

  const { from, to, search, member_id } = getQuery(request);
  const memberId = Number(member_id) > 0 ? Number(member_id) : null;
  const term = String(search || '').trim().toLowerCase();

  // PG ຈະ error ຖ້າສົ່ງ parameter ທີ່ query ບໍ່ໄດ້ໃຊ້ — ຈຶ່ງແຍກສອງຊຸດ
  const params3 = [from || null, to || null, memberId];
  const params = [...params3, term ? `%${term}%` : null];
  const dateFilter = (col) => `
    ($1::date IS NULL OR ${col}::date >= $1::date)
    AND ($2::date IS NULL OR ${col}::date <= $2::date)`;

  const baseCTE = `
    WITH ord AS (
      SELECT o.member_id,
             GREATEST(0, COALESCE(o.member_points_earned, 0)) AS earned,
             GREATEST(0, COALESCE(o.member_points_used, 0)) AS used,
             COALESCE(o.total, 0) AS total
      FROM orders o
      WHERE o.member_id IS NOT NULL
        AND ($3::int IS NULL OR o.member_id = $3::int)
        AND ${dateFilter('o.created_at')}
    ),
    ret AS (
      SELECT COALESCE(r.member_id, o.member_id) AS member_id,
             GREATEST(0, COALESCE(r.member_points_reverted, 0)) AS reverted,
             GREATEST(0, COALESCE(r.member_points_restored, 0)) AS restored
      FROM returns r
      JOIN orders o ON o.id = r.order_id
      WHERE COALESCE(r.member_id, o.member_id) IS NOT NULL
        AND ($3::int IS NULL OR COALESCE(r.member_id, o.member_id) = $3::int)
        AND ${dateFilter('r.created_at')}
    ),
    agg AS (
      SELECT member_id, SUM(earned)::int AS earned, SUM(used)::int AS used,
             0::int AS reverted, 0::int AS restored, SUM(total)::numeric AS spent,
             COUNT(*)::int AS orders
      FROM ord GROUP BY member_id
      UNION ALL
      SELECT member_id, 0, 0, SUM(reverted)::int, SUM(restored)::int, 0::numeric, 0
      FROM ret GROUP BY member_id
    ),
    rolled AS (
      SELECT member_id,
             SUM(earned)::int AS earned, SUM(used)::int AS used,
             SUM(reverted)::int AS reverted, SUM(restored)::int AS restored,
             SUM(spent)::numeric AS spent, SUM(orders)::int AS orders
      FROM agg GROUP BY member_id
    )
  `;

  const membersRes = await pool.query(
    `${baseCTE}
     SELECT m.id, m.member_code, m.name, m.phone, m.tier,
            m.points::int AS balance,
            to_char(m.points_expires_at, 'YYYY-MM-DD') AS points_expires_at,
            COALESCE(r.orders, 0) AS orders,
            COALESCE(r.spent, 0)::float AS spent,
            COALESCE(r.earned, 0) AS earned,
            COALESCE(r.used, 0) AS used,
            COALESCE(r.reverted, 0) AS reverted,
            COALESCE(r.restored, 0) AS restored,
            (COALESCE(r.earned, 0) - COALESCE(r.used, 0)
             - COALESCE(r.reverted, 0) + COALESCE(r.restored, 0)) AS net
     FROM members m
     LEFT JOIN rolled r ON r.member_id = m.id
     WHERE ($3::int IS NULL OR m.id = $3::int)
       AND ($4::text IS NULL OR LOWER(m.name) LIKE $4 OR LOWER(COALESCE(m.member_code, '')) LIKE $4
            OR LOWER(COALESCE(m.phone, '')) LIKE $4)
       AND (COALESCE(r.orders, 0) > 0 OR COALESCE(r.reverted, 0) > 0
            OR COALESCE(r.restored, 0) > 0 OR m.points > 0)
     ORDER BY net DESC, m.points DESC, m.id`,
    params
  );

  const summaryRes = await pool.query(
    `${baseCTE}
     SELECT COALESCE(SUM(earned), 0)::int AS earned,
            COALESCE(SUM(used), 0)::int AS used,
            COALESCE(SUM(reverted), 0)::int AS reverted,
            COALESCE(SUM(restored), 0)::int AS restored,
            COALESCE(SUM(orders), 0)::int AS orders,
            COUNT(*)::int AS active_members
     FROM rolled`,
    params3
  );

  const balanceRes = await pool.query(
    `SELECT COALESCE(SUM(points), 0)::int AS balance_total,
            COUNT(*) FILTER (WHERE points > 0)::int AS members_with_points,
            COUNT(*) FILTER (WHERE points > 0 AND points_expires_at IS NOT NULL
                             AND points_expires_at < CURRENT_DATE)::int AS members_expired,
            COUNT(*) FILTER (WHERE points > 0 AND points_expires_at IS NOT NULL
                             AND points_expires_at >= CURRENT_DATE
                             AND points_expires_at <= CURRENT_DATE + 30)::int AS members_expiring_soon
     FROM members WHERE active IS NOT FALSE`
  );

  // ລາຍການເຄື່ອນໄຫວ (ສະແດງເມື່ອເລືອກລູກຄ້າ 1 ຄົນ ຫຼື ເບິ່ງລວມ 200 ລາຍການລ່າສຸດ)
  const movementsRes = await pool.query(
    `SELECT * FROM (
       SELECT 'sale' AS kind, o.id AS ref_id, o.bill_number AS ref_no,
              o.created_at, o.member_id, m.name AS member_name, m.member_code,
              COALESCE(o.total, 0)::float AS amount,
              GREATEST(0, COALESCE(o.member_points_earned, 0)) AS points_in,
              GREATEST(0, COALESCE(o.member_points_used, 0)) AS points_out
       FROM orders o JOIN members m ON m.id = o.member_id
       WHERE ($3::int IS NULL OR o.member_id = $3::int)
         AND ${dateFilter('o.created_at')}
         AND (COALESCE(o.member_points_earned, 0) <> 0 OR COALESCE(o.member_points_used, 0) <> 0)
       UNION ALL
       SELECT 'return', r.id, r.return_number, r.created_at,
              COALESCE(r.member_id, o.member_id), m.name, m.member_code,
              -COALESCE(r.refund_amount, 0)::float,
              GREATEST(0, COALESCE(r.member_points_restored, 0)),
              GREATEST(0, COALESCE(r.member_points_reverted, 0))
       FROM returns r
       JOIN orders o ON o.id = r.order_id
       JOIN members m ON m.id = COALESCE(r.member_id, o.member_id)
       WHERE ($3::int IS NULL OR COALESCE(r.member_id, o.member_id) = $3::int)
         AND ${dateFilter('r.created_at')}
         AND (COALESCE(r.member_points_reverted, 0) <> 0 OR COALESCE(r.member_points_restored, 0) <> 0)
     ) x
     ORDER BY created_at DESC, ref_id DESC
     LIMIT 300`,
    params3
  );

  return ok({
    range: { from: from || null, to: to || null },
    summary: { ...summaryRes.rows[0], ...balanceRes.rows[0] },
    members: membersRes.rows,
    movements: movementsRes.rows,
  });
});
