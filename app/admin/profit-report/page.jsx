'use client';

import { useState, useEffect, useMemo } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;

const QUICK_RANGES = [
  { key: 'today', label: 'ມື້ນີ້' },
  { key: '7d', label: '7 ວັນ' },
  { key: 'month', label: 'ເດືອນນີ້' },
  { key: 'last_month', label: 'ເດືອນແລ້ວ' },
  { key: 'quarter', label: 'ໄຕມາດນີ້' },
  { key: 'ytd', label: 'ປີນີ້' },
];

function getRange(key) {
  const today = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  if (key === 'today') return { from: iso(today), to: iso(today) };
  if (key === '7d') { const from = new Date(today); from.setDate(today.getDate() - 6); return { from: iso(from), to: iso(today) }; }
  if (key === 'month') { const from = new Date(today.getFullYear(), today.getMonth(), 1); return { from: iso(from), to: iso(today) }; }
  if (key === 'last_month') { const from = new Date(today.getFullYear(), today.getMonth() - 1, 1); const to = new Date(today.getFullYear(), today.getMonth(), 0); return { from: iso(from), to: iso(to) }; }
  if (key === 'quarter') { const q = Math.floor(today.getMonth() / 3); const from = new Date(today.getFullYear(), q * 3, 1); return { from: iso(from), to: iso(today) }; }
  if (key === 'ytd') { const from = new Date(today.getFullYear(), 0, 1); return { from: iso(from), to: iso(today) }; }
  return { from: iso(today), to: iso(today) };
}

const marginPct = (revenue, profit) => {
  const r = Number(revenue) || 0;
  if (r <= 0) return 0;
  return ((Number(profit) || 0) / r) * 100;
};

export default function ProfitReportPage() {
  const initial = getRange('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [tab, setTab] = useState('products');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`${API}/admin/profit-report?${params}`);
      setData(await res.json());
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [from, to]);

  const summary = data?.summary || {};
  const products = data?.products || [];
  const categories = data?.categories || [];
  const daily = data?.daily || [];

  const margin = useMemo(() => marginPct(summary.revenue, summary.profit), [summary]);

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Profit / COGS"
        title="📈 ລາຍງານກຳໄລ / COGS"
        subtitle="ກຳໄລ = ລາຍຮັບ (ບໍ່ລວມ VAT) − ຕົ້ນທຶນສິນຄ້າ"
      />

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">ຈາກວັນທີ</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">ຫາວັນທີ</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_RANGES.map(r => (
            <button key={r.key} onClick={() => { const { from: f, to: t } = getRange(r.key); setFrom(f); setTo(t); }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition">{r.label}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="ບີນຂາຍ" value={fmtNum(summary.orders)} />
        <Kpi label="ລາຍຮັບ (ex-VAT)" value={fmtPrice(summary.revenue)} accent="cyan" />
        <Kpi label="ຕົ້ນທຶນ (COGS)" value={fmtPrice(summary.cost)} accent="amber" />
        <Kpi label="ກຳໄລ" value={fmtPrice(summary.profit)} accent="emerald" highlight />
        <Kpi label="Margin %" value={`${margin.toFixed(1)}%`} accent={margin >= 20 ? 'emerald' : margin >= 10 ? 'amber' : 'rose'} />
      </div>

      {/* Daily trend */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
        <div className="font-bold text-slate-900 mb-3">ກຳໄລລາຍວັນ</div>
        <DailyChart data={daily} />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          {[
            { key: 'products', label: `ສິນຄ້າ (${products.length})` },
            { key: 'categories', label: `ໝວດໝູ່ (${categories.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-bold transition ${tab === t.key ? 'border-b-2 border-red-600 text-red-600' : 'text-slate-600 hover:text-slate-900'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold text-slate-600">{tab === 'products' ? 'ສິນຄ້າ' : 'ໝວດໝູ່'}</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ຈຳນວນ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ລາຍຮັບ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ຕົ້ນທຶນ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ກຳໄລ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {(tab === 'products' ? products : categories).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">{loading ? 'ກຳລັງໂຫຼດ...' : 'ບໍ່ມີຂໍ້ມູນ'}</td></tr>
              ) : (tab === 'products' ? products : categories).map((row, i) => {
                const m = marginPct(row.revenue, row.profit);
                const mColor = m >= 20 ? 'text-emerald-700' : m >= 10 ? 'text-amber-700' : m >= 0 ? 'text-slate-600' : 'text-rose-700';
                return (
                  <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-1.5 font-bold">{tab === 'products' ? row.product_name : row.category_name}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmtNum(row.qty)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmtPrice(row.revenue)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-amber-700">{fmtPrice(row.cost)}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-extrabold text-emerald-700">{fmtPrice(row.profit)}</td>
                    <td className={`px-3 py-1.5 text-right font-mono font-bold ${mColor}`}>{m.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent = 'slate', highlight }) {
  const valCls = {
    slate: 'text-slate-900',
    cyan: 'text-cyan-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    amber: 'text-amber-700',
  }[accent];
  return (
    <div className={`rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm ${highlight ? 'ring-2 ring-emerald-100' : ''}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${valCls}`}>{value}</div>
    </div>
  );
}

function DailyChart({ data }) {
  if (!data || data.length === 0) return <div className="text-slate-400 text-sm text-center py-8">ບໍ່ມີຂໍ້ມູນ</div>;
  const rows = [...data].reverse();
  const maxProfit = Math.max(1, ...rows.map(r => Math.max(0, Number(r.profit) || 0)));
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1.5 min-w-max h-32 px-1">
        {rows.map((r, i) => {
          const p = Math.max(0, Number(r.profit) || 0);
          const h = (p / maxProfit) * 100;
          return (
            <div key={i} className="flex flex-col items-center gap-1 group" style={{ width: 18 }}>
              <div className="text-[9px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 whitespace-nowrap">
                {fmtPrice(p)}
              </div>
              <div className="w-full bg-emerald-500/60 hover:bg-emerald-600 rounded-t" style={{ height: `${h}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1 min-w-max px-1">
        {rows.map((r, i) => (
          <div key={i} className="text-[8px] font-mono text-slate-400 text-center" style={{ width: 18 }}>
            {String(r.d).slice(8, 10)}
          </div>
        ))}
      </div>
    </div>
  );
}
