// Shared admin design tokens. Use these instead of hand-rolling class strings
// so every admin page picks up the same Red brand + spacing/typography.
//
// Two layouts are supported:
//   - HERO  = list / overview pages. Big slate-950 hero strip + KPI metrics row.
//   - SHELL = form / detail pages. Sticky white top bar + compact 13px density.

// --- color tokens ---
export const TONES = {
  slate:   { text: 'text-slate-800',   chip: 'bg-slate-100 text-slate-700',   border: 'border-slate-200' },
  red:     { text: 'text-red-700',     chip: 'bg-red-50 text-red-700',        border: 'border-red-200' },
  emerald: { text: 'text-emerald-700', chip: 'bg-emerald-100 text-emerald-800', border: 'border-emerald-200' },
  amber:   { text: 'text-amber-700',   chip: 'bg-amber-100 text-amber-800',   border: 'border-amber-200' },
  rose:    { text: 'text-rose-700',    chip: 'bg-rose-100 text-rose-800',     border: 'border-rose-200' },
  cyan:    { text: 'text-cyan-700',    chip: 'bg-cyan-100 text-cyan-800',     border: 'border-cyan-200' },
  violet:  { text: 'text-violet-700',  chip: 'bg-violet-100 text-violet-800', border: 'border-violet-200' },
};

// --- button styles ---
export const btn = {
  primary:   'rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed',
  secondary: 'rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-extrabold text-slate-700 transition disabled:opacity-50',
  ghost:     'rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 transition',
  danger:    'rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 px-4 py-2.5 text-sm font-extrabold text-rose-700 transition',
  emerald:   'rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-extrabold text-white transition disabled:opacity-50',
};

// --- input/field styles ---
export const field = {
  input:  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/10',
  small:  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/10',
  label:  'block text-xs font-bold text-slate-700 mb-1',
  card:   'bg-white rounded-2xl border border-slate-200 shadow-sm',
  cardSm: 'bg-white rounded-xl border border-slate-200 shadow-sm',
};

// --- compact (form) variants — for sticky-top-bar pages ---
export const compact = {
  shell:    'min-h-screen bg-slate-50 text-slate-800 text-[13px] -m-3 sm:-m-4 md:-m-6',
  topbar:   'sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200',
  card:     'bg-white rounded-lg border border-slate-200',
  input:    'w-full px-2 py-0 h-7 bg-white border border-slate-200 rounded text-[12px] leading-none focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none transition',
  numInput: 'w-full px-1.5 py-0 h-6 bg-white border border-slate-200 rounded text-[12px] leading-none focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
  label:    'block text-[11px] font-medium text-slate-500 mb-1',
  btnPrimary: 'px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition',
  btnGhost:   'px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md text-[12px] transition',
  btnOutline: 'px-3 py-1.5 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-md text-[12px] font-semibold disabled:opacity-40 transition',
};
