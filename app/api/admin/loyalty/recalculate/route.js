export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, fail, readJson } from '@/lib/api';
import { ensureOrdersSchema, ensureMembersSchema, ensureReturnsSchema, ensureCompanyProfileSchema } from '@/lib/migrations';

// ຄິດໄລ່ແຕ້ມສະສົມຄືນຍ້ອນຫຼັງ ຈາກປະຫວັດບິນຂາຍ + ໃບຄືນສິນຄ້າ ຕາມກົດເກນປັດຈຸບັນ
// (ອັດຕາແຕ້ມ + ຊ່ວງນັບສະສົມ + ອາຍຸແຕ້ມ) — ໃຊ້ຕອນຫາກໍ່ຕັ້ງຊ່ວງນັບແຕ້ມ ຫຼື ປ່ຽນອັດຕາ
// ແລ້ວຢາກໃຫ້ລູກຄ້າເກົ່າໄດ້ແຕ້ມຍ້ອນຫຼັງ.
//
// ສູດ:  ຍອດຄົງເຫຼືອ = Σ(ແຕ້ມທີ່ໄດ້) − Σ(ແຕ້ມທີ່ໃຊ້) − Σ(ຫັກຄືນຈາກການຄືນສິນຄ້າ) + Σ(ຄືນແຕ້ມທີ່ໃຊ້)
//
// ⚠ ຄິດຈາກປະຫວັດບິນເທົ່ານັ້ນ — ແຕ້ມທີ່ admin ແກ້ດ້ວຍມືຈະຖືກທັບ. ຈຶ່ງມີ dry_run
// ໃຫ້ເບິ່ງຜົນກ່ອນສະເໝີ.

const RECALC_SQL = `
WITH cfg AS (
  SELECT
    COALESCE(loyalty_enabled, TRUE) AS enabled,
    GREATEST(1, COALESCE(points_per_amount, 10000)) AS per_amount,
    points_earn_start AS earn_start,
    points_earn_end AS earn_end,
    GREATEST(0, COALESCE(points_lifetime_months, 0)) AS lifetime_months
  FROM company_profile WHERE id = 1
),
ord AS (
  SELECT
    o.id,
    o.member_id,
    o.created_at::date AS order_date,
    COALESCE((SELECT SUM(oi.quantity * oi.price) FROM order_items oi WHERE oi.order_id = o.id), 0)::numeric AS total,
    GREATEST(0, COALESCE(o.member_points_used, 0)) AS used,
    CASE
      WHEN cfg.enabled
       AND (cfg.earn_start IS NULL OR o.created_at::date >= cfg.earn_start)
       AND (cfg.earn_end   IS NULL OR o.created_at::date <= cfg.earn_end)
      THEN FLOOR(COALESCE(o.total, 0) / cfg.per_amount)::int
      ELSE 0
    END AS new_earned
  FROM orders o CROSS JOIN cfg
  WHERE o.member_id IS NOT NULL
    AND ($1::int IS NULL OR o.member_id = $1::int)
),
ret AS (
  -- ອີງມູນຄ່າສິນຄ້າທີ່ຄືນ (gross) ບໍ່ແມ່ນເງິນທີ່ຈ່າຍຄືນ ເພາະເງິນອາດຖືກຫັກສ່ວນຫຼຸດ/ຄ່າທຳນຽມ
  SELECT
    r.id,
    r.order_id,
    GREATEST(COALESCE(r.gross_amount, 0), COALESCE(r.refund_amount, 0))::numeric AS refund_amount,
    SUM(GREATEST(COALESCE(r.gross_amount, 0), COALESCE(r.refund_amount, 0))) OVER (
      PARTITION BY r.order_id ORDER BY r.created_at, r.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )::numeric AS cum_refund
  FROM returns r
  WHERE r.order_id IN (SELECT id FROM ord)
),
ret_calc AS (
  -- ຫັກ/ຄືນແບບຍອດສະສົມ ຄືກັນກັບຕອນສ້າງໃບຄືນ → ຄືນຄົບ 100% ບໍ່ເຫຼືອເສດ
  SELECT
    ret.id,
    ret.order_id,
    ord.member_id,
    CASE WHEN ord.total > 0 THEN
      ROUND(ord.new_earned * LEAST(1, ret.cum_refund / ord.total))
      - ROUND(ord.new_earned * LEAST(1, (ret.cum_refund - ret.refund_amount) / ord.total))
    ELSE 0 END::int AS reverted,
    CASE WHEN ord.total > 0 THEN
      ROUND(ord.used * LEAST(1, ret.cum_refund / ord.total))
      - ROUND(ord.used * LEAST(1, (ret.cum_refund - ret.refund_amount) / ord.total))
    ELSE 0 END::int AS restored
  FROM ret JOIN ord ON ord.id = ret.order_id
),
per_member AS (
  SELECT
    o.member_id,
    COALESCE(SUM(o.new_earned), 0)::int AS earned,
    COALESCE(SUM(o.used), 0)::int AS used,
    MAX(o.order_date) FILTER (WHERE o.new_earned > 0) AS last_earn_date,
    COUNT(*)::int AS orders
  FROM ord o GROUP BY o.member_id
),
per_member_ret AS (
  SELECT member_id,
         COALESCE(SUM(reverted), 0)::int AS reverted,
         COALESCE(SUM(restored), 0)::int AS restored
  FROM ret_calc GROUP BY member_id
)
SELECT
  m.id AS member_id,
  m.member_code,
  m.name,
  m.points::int AS old_points,
  to_char(m.points_expires_at, 'YYYY-MM-DD') AS old_expires_at,
  COALESCE(pm.orders, 0) AS orders,
  COALESCE(pm.earned, 0) AS earned,
  COALESCE(pm.used, 0) AS used,
  COALESCE(pr.reverted, 0) AS reverted,
  COALESCE(pr.restored, 0) AS restored,
  GREATEST(0,
    COALESCE(pm.earned, 0) - COALESCE(pm.used, 0)
    - COALESCE(pr.reverted, 0) + COALESCE(pr.restored, 0)
  ) AS raw_points,
  to_char(
    CASE WHEN cfg.lifetime_months > 0 AND pm.last_earn_date IS NOT NULL
      THEN (pm.last_earn_date + (cfg.lifetime_months || ' months')::interval)::date
      ELSE NULL END,
    'YYYY-MM-DD') AS new_expires_at,
  (cfg.lifetime_months > 0
     AND pm.last_earn_date IS NOT NULL
     AND (pm.last_earn_date + (cfg.lifetime_months || ' months')::interval)::date < CURRENT_DATE
  ) AS expired
FROM members m
CROSS JOIN cfg
LEFT JOIN per_member pm ON pm.member_id = m.id
LEFT JOIN per_member_ret pr ON pr.member_id = m.id
WHERE ($1::int IS NULL OR m.id = $1::int)
ORDER BY m.id
`;

// ຄ່າທີ່ຈະຂຽນກັບເຂົ້າ orders / returns ໃຫ້ຕົງກັບການຄິດໄລ່ໃໝ່
const ORDER_WRITEBACK_SQL = `
WITH cfg AS (
  SELECT COALESCE(loyalty_enabled, TRUE) AS enabled,
         GREATEST(1, COALESCE(points_per_amount, 10000)) AS per_amount,
         points_earn_start AS earn_start, points_earn_end AS earn_end
  FROM company_profile WHERE id = 1
)
UPDATE orders o
SET member_points_earned = CASE
      WHEN cfg.enabled
       AND (cfg.earn_start IS NULL OR o.created_at::date >= cfg.earn_start)
       AND (cfg.earn_end   IS NULL OR o.created_at::date <= cfg.earn_end)
      THEN FLOOR(COALESCE(o.total, 0) / cfg.per_amount)::int
      ELSE 0 END
FROM cfg
WHERE o.member_id IS NOT NULL AND ($1::int IS NULL OR o.member_id = $1::int)
`;

const RETURN_WRITEBACK_SQL = `
WITH ord AS (
  SELECT o.id, o.member_id,
         COALESCE((SELECT SUM(oi.quantity * oi.price) FROM order_items oi WHERE oi.order_id = o.id), 0)::numeric AS total,
         GREATEST(0, COALESCE(o.member_points_earned, 0)) AS earned,
         GREATEST(0, COALESCE(o.member_points_used, 0)) AS used
  FROM orders o
  WHERE o.member_id IS NOT NULL AND ($1::int IS NULL OR o.member_id = $1::int)
),
ret AS (
  SELECT r.id, r.order_id,
         GREATEST(COALESCE(r.gross_amount, 0), COALESCE(r.refund_amount, 0))::numeric AS refund_amount,
         SUM(GREATEST(COALESCE(r.gross_amount, 0), COALESCE(r.refund_amount, 0))) OVER (
           PARTITION BY r.order_id ORDER BY r.created_at, r.id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)::numeric AS cum_refund
  FROM returns r WHERE r.order_id IN (SELECT id FROM ord)
)
UPDATE returns tgt
SET member_id = ord.member_id,
    member_points_reverted = CASE WHEN ord.total > 0 THEN
      ROUND(ord.earned * LEAST(1, ret.cum_refund / ord.total))
      - ROUND(ord.earned * LEAST(1, (ret.cum_refund - ret.refund_amount) / ord.total)) ELSE 0 END::int,
    member_points_restored = CASE WHEN ord.total > 0 THEN
      ROUND(ord.used * LEAST(1, ret.cum_refund / ord.total))
      - ROUND(ord.used * LEAST(1, (ret.cum_refund - ret.refund_amount) / ord.total)) ELSE 0 END::int
FROM ret JOIN ord ON ord.id = ret.order_id
WHERE tgt.id = ret.id
`;

export const POST = handle(async (request) => {
  await ensureOrdersSchema();
  await ensureMembersSchema();
  await ensureReturnsSchema();
  await ensureCompanyProfileSchema();

  const body = await readJson(request).catch(() => ({}));
  const apply = body?.apply === true;
  const memberId = Number(body?.member_id) > 0 ? Number(body.member_id) : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (apply) {
      // ຂຽນຄ່າໃໝ່ລົງບິນກ່ອນ ແລ້ວຄ່ອຍຄິດໃບຄືນຈາກຄ່າໃໝ່ນັ້ນ ລຳດັບສຳຄັນ
      await client.query(ORDER_WRITEBACK_SQL, [memberId]);
      await client.query(RETURN_WRITEBACK_SQL, [memberId]);
    }

    const rows = (await client.query(RECALC_SQL, [memberId])).rows;
    const preview = rows.map((r) => {
      const newPoints = r.expired ? 0 : Number(r.raw_points) || 0;
      return {
        member_id: r.member_id,
        member_code: r.member_code,
        name: r.name,
        orders: Number(r.orders) || 0,
        earned: Number(r.earned) || 0,
        used: Number(r.used) || 0,
        reverted: Number(r.reverted) || 0,
        restored: Number(r.restored) || 0,
        old_points: Number(r.old_points) || 0,
        new_points: newPoints,
        delta: newPoints - (Number(r.old_points) || 0),
        old_expires_at: r.old_expires_at,
        new_expires_at: r.new_expires_at,
        expired: !!r.expired,
      };
    });

    if (apply) {
      for (const p of preview) {
        if (p.new_points === p.old_points && p.new_expires_at === p.old_expires_at) continue;
        await client.query(
          `UPDATE members SET points = $1, points_expires_at = $2::date, updated_at = NOW() WHERE id = $3`,
          [p.new_points, p.new_expires_at, p.member_id]
        );
      }
      await client.query('COMMIT');
    } else {
      // dry run — ບໍ່ເກັບຫຍັງໄວ້
      await client.query('ROLLBACK');
    }

    const changed = preview.filter(p => p.delta !== 0 || p.new_expires_at !== p.old_expires_at);
    return ok({
      applied: apply,
      members_total: preview.length,
      members_changed: changed.length,
      points_delta: changed.reduce((s, p) => s + p.delta, 0),
      changes: changed,
      all: preview,
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
});

export const GET = handle(async () => fail(405, 'ໃຊ້ POST'));
