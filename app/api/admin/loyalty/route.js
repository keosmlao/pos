export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, readJson, fail } from '@/lib/api';
import { ensureCompanyProfileSchema, ensureMembersSchema } from '@/lib/migrations';
import { recomputeAllMemberTiers } from '@/lib/memberTiers';
import { LOYALTY_DATE_FIELDS, toDateOnly } from '@/lib/loyaltyWindow';

const LOYALTY_FIELDS = [
  'loyalty_enabled',
  'points_per_amount',
  'points_redeem_value',
  'min_points_to_redeem',
  'tier_silver_threshold',
  'tier_gold_threshold',
  'tier_platinum_threshold',
  'points_lifetime_months',
  ...LOYALTY_DATE_FIELDS,
];

// ວັນທີຕ້ອງອອກເປັນ string 'YYYY-MM-DD' ບໍ່ແມ່ນ Date object — ກັນ timezone ເລື່ອນວັນ
const SELECT_LIST = LOYALTY_FIELDS
  .map(f => (LOYALTY_DATE_FIELDS.includes(f) ? `to_char(${f}, 'YYYY-MM-DD') AS ${f}` : f))
  .join(', ');

export const GET = handle(async () => {
  await ensureCompanyProfileSchema();
  const result = await pool.query(
    `SELECT ${SELECT_LIST}, to_char(CURRENT_DATE, 'YYYY-MM-DD') AS server_date
     FROM company_profile WHERE id = 1`
  );
  return ok(result.rows[0] || {});
});

export const PUT = handle(async (request) => {
  await ensureCompanyProfileSchema();
  const body = await readJson(request);

  const enabled = body.loyalty_enabled !== false;
  const perAmount = Math.max(1, parseInt(body.points_per_amount, 10) || 10000);
  const redeemValue = Math.max(0, parseInt(body.points_redeem_value, 10) || 0);
  const minRedeem = Math.max(0, parseInt(body.min_points_to_redeem, 10) || 0);
  const silver = Math.max(0, parseInt(body.tier_silver_threshold, 10) || 0);
  const gold = Math.max(0, parseInt(body.tier_gold_threshold, 10) || 0);
  const platinum = Math.max(0, parseInt(body.tier_platinum_threshold, 10) || 0);
  const lifetimeMonths = Math.max(0, Math.min(120, parseInt(body.points_lifetime_months, 10) || 0));
  const earnStart = toDateOnly(body.points_earn_start);
  const earnEnd = toDateOnly(body.points_earn_end);
  const redeemDeadline = toDateOnly(body.points_redeem_deadline);

  if (!(silver <= gold && gold <= platinum)) {
    return fail(400, 'Tier thresholds must be silver <= gold <= platinum');
  }
  if (earnStart && earnEnd && earnStart > earnEnd) {
    return fail(400, 'ວັນເລີ່ມນັບແຕ້ມຕ້ອງບໍ່ຫຼັງວັນສິ້ນສຸດ');
  }

  const result = await pool.query(
    `UPDATE company_profile SET
       loyalty_enabled = $1,
       points_per_amount = $2,
       points_redeem_value = $3,
       min_points_to_redeem = $4,
       tier_silver_threshold = $5,
       tier_gold_threshold = $6,
       tier_platinum_threshold = $7,
       points_lifetime_months = $8,
       points_earn_start = $9::date,
       points_earn_end = $10::date,
       points_redeem_deadline = $11::date,
       updated_at = NOW()
     WHERE id = 1
     RETURNING ${SELECT_LIST}`,
    [enabled, perAmount, redeemValue, minRedeem, silver, gold, platinum, lifetimeMonths,
     earnStart, earnEnd, redeemDeadline]
  );

  await ensureMembersSchema();
  let promoted = 0;
  try { promoted = await recomputeAllMemberTiers(); } catch {}

  return ok({ ...result.rows[0], tiers_recomputed: promoted });
});
