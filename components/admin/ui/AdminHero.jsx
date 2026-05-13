'use client';

// Shared hero header for list / overview admin pages.
//   <AdminHero
//     tag="Document type"
//     title="ຫົວຂໍ້"
//     subtitle="..."
//     action={<button>...</button>}
//   />

import Link from 'next/link';

const TONE_CLS = {
  slate:   'text-slate-950 dark:text-slate-100',
  red:     'text-red-700 dark:text-red-400',
  amber:   'text-amber-700 dark:text-amber-400',
  emerald: 'text-emerald-700 dark:text-emerald-400',
  rose:    'text-rose-700 dark:text-rose-400',
  cyan:    'text-cyan-700 dark:text-cyan-400',
  violet:  'text-violet-700 dark:text-violet-400',
};

export function AdminHero({ tag, title, subtitle, action, backHref, metrics, allowOverflow = false }) {
  return (
    <div className={`${allowOverflow ? 'overflow-visible' : 'overflow-hidden'} rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm`}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-950 px-5 py-5 text-white">
        <div>
          {backHref && (
            <Link href={backHref} className="text-[11px] font-semibold text-slate-400 hover:text-white inline-flex items-center gap-1 mb-1">
              ← ກັບຄືນ
            </Link>
          )}
          {tag && <div className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-red-300">{tag}</div>}
          <h1 className="mt-1 text-2xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm font-semibold text-slate-300">{subtitle}</p>}
        </div>
        {action && <div className="relative z-50 shrink-0">{action}</div>}
      </div>

      {Array.isArray(metrics) && metrics.length > 0 && (
        <div className={`grid grid-cols-1 divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50/70 dark:bg-slate-900/50 md:divide-x md:divide-y-0 md:grid-cols-${Math.min(metrics.length, 6)}`}>
          {metrics.map((m, i) => (
            <Metric key={i} label={m.label} value={m.value} tone={m.tone} sub={m.sub} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Metric({ label, value, tone = 'slate', sub }) {
  const cls = TONE_CLS[tone] || TONE_CLS.slate;
  return (
    <div className="px-5 py-4">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${cls}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
