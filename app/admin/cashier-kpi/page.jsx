'use client';

import { useState, useEffect } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;

const QUICK = [
  { key: 'today', label: 'ມື້ນີ້' },
  { key: '7d', label: '7 ວັນ' },
  { key: 'month', label: 'ເດືອນນີ້' },
  { key: 'last_month', label: 'ເດືອນແລ້ວ' },
];

function getRange(key) {
  const today = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  if (key === 'today') return { from: iso(today), to: iso(today) };
  if (key === '7d') { const f = new Date(today); f.setDate(today.getDate() - 6); return { from: iso(f), to: iso(today) }; }
  if (key === 'month') { const f = new Date(today.getFullYear(), today.getMonth(), 1); return { from: iso(f), to: iso(today) }; }
  if (key === 'last_month') { const f = new Date(today.getFullYear(), today.getMonth() - 1, 1); const t = new Date(today.getFullYear(), today.getMonth(), 0); return { from: iso(f), to: iso(t) }; }
  return { from: iso(today), to: iso(today) };
}

export default function CashierKpiPage() {
  const init = getRange('month');
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`${API}/admin/cashier-kpi?${params}`);
      setData(await res.json());
    } catch { setData(null); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [from, to]);

  const cashiers = data?.cashiers || [];
  const totalRevenue = Number(data?.summary?.revenue) || 0;
  const totalCommission = cashiers.reduce((s, c) => s + Number(c.commission_amount || 0), 0);

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Cashier KPI"
        title="🎯 KPI ພະນັກງານຂາຍ"
        subtitle="ຍອດຂາຍ, ເປົ້າໝາຍ ແລະ ຄ່າຄອມຂອງແຕ່ລະຄົນ"
      />

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">ຈາກວັນທີ</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">ຫາວັນທີ</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map(r => (
            <button key={r.key} onClick={() => { const { from: f, to: t } = getRange(r.key); setFrom(f); setTo(t); }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold">{r.label}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="ພະນັກງານ" value={fmtNum(cashiers.length)} />
        <Kpi label="ບີນທັງໝົດ" value={fmtNum(data?.summary?.orders || 0)} />
        <Kpi label="ຍອດຂາຍ" value={fmtPrice(totalRevenue)} accent="emerald" />
        <Kpi label="ຄ່າຄອມລວມ" value={fmtPrice(totalCommission)} accent="amber" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">
          ຣາຍລະອຽດພະນັກງານ
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr className="text-left">
            <th className="px-3 py-2 font-bold">ພະນັກງານ</th>
            <th className="px-3 py-2 font-bold text-right">ບີນ</th>
            <th className="px-3 py-2 font-bold text-right">ຍອດຂາຍ</th>
            <th className="px-3 py-2 font-bold text-right">ບີນເສລ່ຍ</th>
            <th className="px-3 py-2 font-bold text-right">ສ່ວນຫຼຸດ</th>
            <th className="px-3 py-2 font-bold text-right">ຕິດໜີ້</th>
            <th className="px-3 py-2 font-bold">ເປົ້າ %</th>
            <th className="px-3 py-2 font-bold text-right">ຄ່າຄອມ</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
            : cashiers.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">ບໍ່ມີຂໍ້ມູນ</td></tr>
            : cashiers.map((c, i) => (
              <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-1.5">
                  <div className="font-bold">{c.display_name}</div>
                  <div className="text-[10px] text-slate-500">{c.username} · {c.role}</div>
                </td>
                <td className="px-3 py-1.5 text-right font-mono">{fmtNum(c.orders)}</td>
                <td className="px-3 py-1.5 text-right font-mono font-extrabold text-emerald-700">{fmtPrice(c.revenue)}</td>
                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{fmtPrice(c.avg_order)}</td>
                <td className="px-3 py-1.5 text-right font-mono text-amber-700">{fmtPrice(c.discount_given)}</td>
                <td className="px-3 py-1.5 text-right font-mono text-rose-700">{fmtNum(c.credit_orders)}</td>
                <td className="px-3 py-1.5">
                  {c.target_pct != null ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded overflow-hidden">
                        <div className={`h-full ${c.target_pct >= 100 ? 'bg-emerald-500' : c.target_pct >= 75 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, c.target_pct)}%` }} />
                      </div>
                      <span className="text-[10px] font-bold w-10 text-right">{c.target_pct.toFixed(0)}%</span>
                    </div>
                  ) : <span className="text-[10px] text-slate-400">ບໍ່ກຳນົດ</span>}
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-bold text-amber-700">
                  {Number(c.commission_rate) > 0 ? <>{fmtPrice(c.commission_amount)} <span className="text-[10px] text-slate-400">({c.commission_rate}%)</span></> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-slate-500">
        ⚙ ປ່ຽນ <b>commission_rate</b> ແລະ <b>sales_target</b> ໃນໜ້າ Users (1 ຄົນຕໍ່ 1 ຄ່າ)
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }) {
  const cls = accent === 'emerald' ? 'text-emerald-700' : accent === 'amber' ? 'text-amber-700' : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${cls}`}>{value}</div>
    </div>
  );
}
