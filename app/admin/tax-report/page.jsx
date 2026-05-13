'use client';

import { useState, useEffect, useMemo } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;
const fmtDateTime = s => s ? new Date(s).toLocaleString('lo-LA') : '—';
const fmtDate = s => s ? new Date(s).toLocaleDateString('lo-LA') : '—';

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
  if (key === '7d') {
    const from = new Date(today); from.setDate(today.getDate() - 6);
    return { from: iso(from), to: iso(today) };
  }
  if (key === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: iso(from), to: iso(today) };
  }
  if (key === 'last_month') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: iso(from), to: iso(to) };
  }
  if (key === 'quarter') {
    const q = Math.floor(today.getMonth() / 3);
    const from = new Date(today.getFullYear(), q * 3, 1);
    return { from: iso(from), to: iso(today) };
  }
  if (key === 'ytd') {
    const from = new Date(today.getFullYear(), 0, 1);
    return { from: iso(from), to: iso(today) };
  }
  return { from: iso(today), to: iso(today) };
}

export default function TaxReportPage() {
  const initial = getRange('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(`${API}/admin/tax-report?${params}`);
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [from, to]);

  const summary = data?.summary || {};
  const byRate = data?.by_rate || [];
  const recent = data?.recent || [];

  const exportCSV = () => {
    const lines = [
      ['Bill', 'Date', 'Customer', 'Subtotal (ex-VAT)', 'Discount', 'VAT rate', 'VAT mode', 'VAT amount', 'Total'].join(','),
      ...recent.map(o => [
        o.bill_number || `#${o.id}`,
        new Date(o.created_at).toISOString(),
        (o.customer_name || '').replace(/,/g, ' '),
        o.subtotal || 0,
        o.discount || 0,
        o.vat_rate || 0,
        o.vat_mode || '',
        o.vat_amount || 0,
        o.total || 0,
      ].join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Tax report"
        title="🧾 ລາຍງານພາສີ / VAT"
        subtitle="ສະຫຼຸບການຄິດ VAT ຈາກບີນຂາຍ — ສຳລັບການແຈ້ງພາສີ"
        action={
          <button onClick={exportCSV} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-red-950/20 transition hover:bg-red-700">
            ⬇ Export CSV
          </button>
        }
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

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="ບີນທີ່ມີ VAT" value={fmtNum(summary.taxable_count)} accent="cyan" sub={`${fmtNum(summary.exempt_count)} ບໍ່ມີ VAT`} />
        <Kpi label="ມູນຄ່າກ່ອນ VAT" value={fmtPrice(summary.net_total)} accent="slate" />
        <Kpi label="VAT ລວມ" value={fmtPrice(summary.vat_total)} accent="rose" highlight />
        <Kpi label="ມູນຄ່າທັງໝົດ" value={fmtPrice(summary.gross_total)} accent="emerald" />
      </div>

      {/* By rate */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">ສະຫຼຸບຕາມອັດຕາ VAT</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="px-4 py-2 font-bold text-slate-600">ອັດຕາ</th>
                <th className="px-4 py-2 font-bold text-slate-600">ໂໝດ</th>
                <th className="px-4 py-2 font-bold text-slate-600 text-right">ຈຳນວນບີນ</th>
                <th className="px-4 py-2 font-bold text-slate-600 text-right">ມູນຄ່າກ່ອນ VAT</th>
                <th className="px-4 py-2 font-bold text-slate-600 text-right">VAT</th>
                <th className="px-4 py-2 font-bold text-slate-600 text-right">ມູນຄ່າທັງໝົດ</th>
              </tr>
            </thead>
            <tbody>
              {byRate.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{loading ? 'ກຳລັງໂຫຼດ...' : 'ບໍ່ມີຂໍ້ມູນ'}</td></tr>
              ) : byRate.map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-bold">{Number(r.rate) > 0 ? `${Number(r.rate)}%` : '—'}</td>
                  <td className="px-4 py-2 text-xs">{r.mode === 'inclusive' ? 'ລວມໃນ' : r.mode === 'exclusive' ? 'ແຍກນອກ' : '—'}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtNum(r.orders)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPrice(r.net)}</td>
                  <td className="px-4 py-2 text-right font-mono font-extrabold text-rose-700">{fmtPrice(r.vat)}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtPrice(r.gross)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">ບີນທີ່ມີ VAT ({recent.length})</div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold text-slate-600">ບີນ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ວັນທີ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ລູກຄ້າ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ກ່ອນ VAT</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ສ່ວນຫຼຸດ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">VAT</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ລວມ</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">{loading ? 'ກຳລັງໂຫຼດ...' : 'ບໍ່ມີບີນທີ່ມີ VAT'}</td></tr>
              ) : recent.map(o => (
                <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-mono font-bold">{o.bill_number || `#${o.id}`}</td>
                  <td className="px-3 py-1.5 text-slate-600">{fmtDateTime(o.created_at)}</td>
                  <td className="px-3 py-1.5">{o.customer_name || '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtPrice(o.subtotal)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-amber-700">{Number(o.discount) > 0 ? `−${fmtPrice(o.discount)}` : '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-bold text-rose-700">{Number(o.vat_rate)}% · {fmtPrice(o.vat_amount)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-extrabold">{fmtPrice(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, accent = 'slate', highlight }) {
  const cls = {
    slate: 'bg-white border-slate-200',
    cyan: 'bg-white border-cyan-200',
    emerald: 'bg-white border-emerald-200',
    rose: 'bg-white border-rose-200',
  }[accent] || 'bg-white border-slate-200';
  const valCls = {
    slate: 'text-slate-900',
    cyan: 'text-cyan-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
  }[accent] || 'text-slate-900';
  return (
    <div className={`rounded-xl border-2 ${cls} p-4 shadow-sm ${highlight ? 'ring-2 ring-rose-100' : ''}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${valCls}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
