export const dynamic = 'force-dynamic';

import pool from '@/lib/db';
import { handle, ok, getQuery } from '@/lib/api';
import { ensureCustomerDebtPaymentsSchema } from '@/lib/migrations';

export const GET = handle(async (request) => {
  await ensureCustomerDebtPaymentsSchema();
  const query = getQuery(request);
  const upcomingDays = Math.max(0, Math.min(60, parseInt(query.upcoming_days, 10) || 7));

  const result = await pool.query(
    `
    SELECT
      o.id,
      o.bill_number,
      o.customer_name,
      o.customer_phone,
      o.credit_due_date,
      o.created_at,
      o.member_id,
      m.member_code,
      m.name AS member_name,
      o.total,
      COALESCE(o.credit_paid, o.amount_paid, 0) AS paid,
      GREATEST(0, o.total - COALESCE(o.credit_paid, o.amount_paid, 0)) AS remaining,
      CASE
        WHEN o.credit_due_date IS NULL THEN NULL
        ELSE (o.credit_due_date - CURRENT_DATE)
      END AS days_until_due
    FROM orders o
    LEFT JOIN members m ON m.id = o.member_id
    WHERE o.payment_method = 'credit'
      AND o.credit_status IN ('outstanding', 'partial')
      AND GREATEST(0, o.total - COALESCE(o.credit_paid, o.amount_paid, 0)) > 0
    ORDER BY o.credit_due_date ASC NULLS LAST, o.created_at ASC
    `
  );

  const today = [];
  const overdue = [];
  const upcoming = [];
  const undated = [];

  for (const row of result.rows) {
    const remaining = Number(row.remaining) || 0;
    if (remaining <= 0) continue;
    const days = row.days_until_due == null ? null : Number(row.days_until_due);
    const item = {
      id: row.id,
      bill_number: row.bill_number,
      customer_name: row.customer_name || row.member_name || '—',
      customer_phone: row.customer_phone || null,
      member_code: row.member_code || null,
      credit_due_date: row.credit_due_date,
      created_at: row.created_at,
      total: Number(row.total) || 0,
      paid: Number(row.paid) || 0,
      remaining,
      days_until_due: days,
      status:
        days == null ? 'undated' :
        days < 0 ? 'overdue' :
        days === 0 ? 'today' :
        days <= upcomingDays ? 'upcoming' : 'later',
    };
    if (item.status === 'overdue') overdue.push(item);
    else if (item.status === 'today') today.push(item);
    else if (item.status === 'upcoming') upcoming.push(item);
    else if (item.status === 'undated') undated.push(item);
  }

  overdue.sort((a, b) => (a.days_until_due ?? 0) - (b.days_until_due ?? 0));
  upcoming.sort((a, b) => (a.days_until_due ?? 0) - (b.days_until_due ?? 0));

  const sumRemaining = (arr) => arr.reduce((s, x) => s + (Number(x.remaining) || 0), 0);

  return ok({
    upcoming_days: upcomingDays,
    counts: {
      overdue: overdue.length,
      today: today.length,
      upcoming: upcoming.length,
      undated: undated.length,
      total: overdue.length + today.length + upcoming.length + undated.length,
    },
    totals: {
      overdue: sumRemaining(overdue),
      today: sumRemaining(today),
      upcoming: sumRemaining(upcoming),
      undated: sumRemaining(undated),
    },
    overdue,
    today,
    upcoming,
    undated,
  });
});
