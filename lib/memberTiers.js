import pool from './db';

// Compute and update every member's tier based on their `total_spent` and the
// current thresholds in company_profile. Idempotent — safe to run repeatedly.
//
// Returns the number of members whose tier changed.
export async function recomputeAllMemberTiers(client) {
  const q = client || pool;
  const settingsRes = await q.query(
    `SELECT tier_silver_threshold, tier_gold_threshold, tier_platinum_threshold
     FROM company_profile WHERE id = 1`
  );
  const s = settingsRes.rows[0] || {};
  const silver = Number(s.tier_silver_threshold) || 5000000;
  const gold = Number(s.tier_gold_threshold) || 20000000;
  const platinum = Number(s.tier_platinum_threshold) || 50000000;

  const res = await q.query(
    `UPDATE members
     SET tier = CASE
       WHEN total_spent >= $1 THEN 'platinum'
       WHEN total_spent >= $2 THEN 'gold'
       WHEN total_spent >= $3 THEN 'silver'
       ELSE 'standard'
     END,
     updated_at = NOW()
     WHERE tier IS DISTINCT FROM CASE
       WHEN total_spent >= $1 THEN 'platinum'
       WHEN total_spent >= $2 THEN 'gold'
       WHEN total_spent >= $3 THEN 'silver'
       ELSE 'standard'
     END`,
    [platinum, gold, silver]
  );
  return res.rowCount || 0;
}
