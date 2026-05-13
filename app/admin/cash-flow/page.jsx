'use client';

import { useState, useEffect, useMemo } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = (n, c = 'LAK') => c === 'LAK' ? `${fmtNum(n)} ₭` : `${fmtNum(n)} ${c}`;
const fmtDateTime = s => s ? new Date(s).toLocaleString('lo-LA') : '—';
const fmtDate = s => s ? new Date(s).toLocaleDateString('lo-LA') : '—';

const SOURCE_LABEL = {
  sale: { label: '💰 ຂາຍ', tone: 'emerald' },
  customer_debt_payment: { label: '💵 ຊຳລະຈາກລູກໜີ້', tone: 'emerald' },
  supplier_debt_payment: { label: '💳 ຊຳລະໃຫ້ເຈົ້າໜີ້', tone: 'rose' },
  return: { label: '↩ ຄືນເງິນ', tone: 'rose' },
  manual: { label: '✏️ ບັນທຶກເອງ', tone: 'slate' },
};

const METHOD_LABEL = {
  cash: 'ເງິນສົດ', transfer: 'ໂອນ', qr: 'QR', cheque: 'ເຊັກ', store_credit: 'ເຄຣດິດ',
};

const QUICK_RANGES = [
  { key: 'today', label: 'ມື້ນີ້' },
  { key: '7d', label: '7 ວັນ' },
  { key: 'month', label: 'ເດືອນນີ້' },
  { key: 'last_month', label: 'ເດືອນແລ້ວ' },
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
  if (key === 'ytd') {
    const from = new Date(today.getFullYear(), 0, 1);
    return { from: iso(from), to: iso(today) };
  }
  return { from: iso(today), to: iso(today) };
}

export default function CashFlowPage() {
  const initialRange = getRange('month');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [currency, setCurrency] = useState('');
  const [account, setAccount] = useState('');
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterType, setFilterType] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState([]);

  useEffect(() => {
    fetch(`${API}/currencies`).then(r => r.json()).then(list => setCurrencies(Array.isArray(list) ? list : []));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (currency) params.set('currency', currency);
      if (account) params.set('account', account);
      const res = await fetch(`${API}/admin/cash-flow?${params}`);
      setData(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, currency, account]);

  const filtered = useMemo(() => {
    if (!data?.transactions) return [];
    let txns = data.transactions;
    if (filterSource) txns = txns.filter(t => t.source === filterSource);
    if (filterType) txns = txns.filter(t => t.txn_type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      txns = txns.filter(t => [t.description, t.source_label, t.ref, t.account, t.note]
        .some(v => String(v || '').toLowerCase().includes(q)));
    }
    return txns;
  }, [data, filterSource, filterType, search]);

  const filteredTotals = useMemo(() => {
    const inflow = filtered.filter(t => t.txn_type === 'income').reduce((s, t) => s + (Number(t.amount_lak) || 0), 0);
    const outflow = filtered.filter(t => t.txn_type === 'expense').reduce((s, t) => s + (Number(t.amount_lak) || 0), 0);
    return { inflow, outflow, net: inflow - outflow, count: filtered.length };
  }, [filtered]);

  const allCurrencies = currencies.length > 0 ? currencies : [{ code: 'LAK', symbol: '₭', rate: 1 }];

  const exportCsv = () => {
    if (!filtered.length) return;
    const rows = [
      ['ວັນທີ', 'ປະເພດ', 'ແຫຼ່ງ', 'ລາຍລະອຽດ', 'ບັນຊີ', 'ວິທີ', 'ສະກຸນ', 'ຈຳນວນ', 'LAK'],
      ...filtered.map(t => [
        new Date(t.date).toISOString(),
        t.txn_type,
        t.source,
        t.description || '',
        t.account || '',
        t.payment_method || '',
        t.currency || 'LAK',
        Number(t.amount) || 0,
        Number(t.amount_lak) || 0,
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-flow_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Cash flow"
        title="💸 ການເຄື່ອນໄຫວເງິນສົດ"
        subtitle="ສະຫຼຸບການເຄື່ອນໄຫວເງິນສົດທັງໝົດ — ຂາຍ, ຊຳລະໜີ້, ຄືນເງິນ, ບັນທຶກເອງ"
        action={
          <div className="flex gap-2">
            <button onClick={load} disabled={loading}
              className="rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">
              {loading ? 'ໂຫຼດ...' : 'ໂຫຼດໃໝ່'}
            </button>
            <button onClick={exportCsv} disabled={!filtered.length}
              className="rounded-xl bg-red-600 hover:bg-red-700 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-red-950/20 disabled:opacity-50">
              📥 Export CSV
            </button>
          </div>
        }
      />

      {/* Period & filters */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
            {QUICK_RANGES.map(q => (
              <button key={q.key} onClick={() => { const r = getRange(q.key); setFrom(r.from); setTo(r.to); }}
                className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white">
                {q.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 ml-1">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-2 py-2 border border-slate-300 rounded-lg text-sm" />
            <span className="text-slate-400 text-xs">→</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-2 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <select value={currency} onChange={e => setCurrency(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
            <option value="">ທຸກສະກຸນ</option>
            {allCurrencies.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
          </select>
          <select value={account} onChange={e => setAccount(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
            <option value="">ທຸກບັນຊີ</option>
            {(data?.by_account || []).map(a => <option key={a.account} value={a.account}>{a.account}</option>)}
          </select>
        </div>
      </section>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <KpiCard label="ລາຍຮັບເຂົ້າ (LAK)" value={fmtPrice(data?.totals?.inflow || 0)} sub={`${fmtNum(filtered.filter(t => t.txn_type === 'income').length)} ລາຍການ`} tone="emerald" icon="↑" />
        <KpiCard label="ລາຍຈ່າຍອອກ (LAK)" value={fmtPrice(data?.totals?.outflow || 0)} sub={`${fmtNum(filtered.filter(t => t.txn_type === 'expense').length)} ລາຍການ`} tone="rose" icon="↓" />
        <KpiCard label="ສຸດທິ (LAK)" value={fmtPrice(data?.totals?.net || 0)} sub={data?.totals?.net >= 0 ? 'ບວກ' : 'ລົບ'} tone={data?.totals?.net >= 0 ? 'blue' : 'amber'} icon={data?.totals?.net >= 0 ? '+' : '−'} />
        <KpiCard label="ໄລຍະ" value={`${fmtDate(from)} → ${fmtDate(to)}`} sub={`${fmtNum(data?.totals?.count || 0)} ລາຍການລວມ`} tone="slate" icon="📅" />
      </div>

      {/* By account + currency */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-extrabold text-slate-900">📂 ແຍກຕາມບັນຊີ / ບ່ອນເກັບ</h2>
            <span className="text-[10px] text-slate-400">LAK equivalent</span>
          </div>
          <div className="space-y-1">
            {(data?.by_account || []).map(a => {
              const net = a.inflow - a.outflow;
              return (
                <div key={a.account} className="rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setAccount(account === a.account ? '' : a.account)}>
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                      <span>{a.account}</span>
                      {account === a.account && <span className="text-[9px] font-bold text-red-600">✓ ກອງ</span>}
                    </div>
                    <div className="flex gap-3 text-[11px] mt-0.5">
                      <span className="text-emerald-600">+{fmtPrice(a.inflow)}</span>
                      <span className="text-rose-600">−{fmtPrice(a.outflow)}</span>
                      <span className="text-slate-500">{a.count} ລາຍການ</span>
                    </div>
                  </div>
                  <div className={`text-right font-mono text-base font-extrabold ${net >= 0 ? 'text-red-700' : 'text-rose-700'}`}>
                    {fmtPrice(net)}
                  </div>
                </div>
              );
            })}
            {(!data?.by_account || data.by_account.length === 0) && <div className="py-6 text-center text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-extrabold text-slate-900">💱 ແຍກຕາມສະກຸນເງິນ</h2>
            <span className="text-[10px] text-slate-400">ຈຳນວນຕົ້ນສະບັບ</span>
          </div>
          <div className="space-y-1">
            {(data?.by_currency || []).map(c => (
              <div key={c.currency} className="rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 cursor-pointer"
                onClick={() => setCurrency(currency === c.currency ? '' : c.currency)}>
                <div>
                  <div className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                    <span>{c.currency}</span>
                    {currency === c.currency && <span className="text-[9px] font-bold text-red-600">✓ ກອງ</span>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{c.count} ລາຍການ</div>
                </div>
                <div className="text-right">
                  <div className="text-emerald-600 font-mono text-sm font-extrabold">+{fmtNum(c.inflow)} {c.currency}</div>
                  <div className="text-rose-600 font-mono text-xs">−{fmtNum(c.outflow)} {c.currency}</div>
                </div>
              </div>
            ))}
            {(!data?.by_currency || data.by_currency.length === 0) && <div className="py-6 text-center text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>}
          </div>
        </section>
      </div>

      {/* Sources breakdown */}
      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <h2 className="text-sm font-extrabold text-slate-900 mb-2">📊 ແຍກຕາມແຫຼ່ງ</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {(data?.by_source || []).map(s => {
            const meta = SOURCE_LABEL[s.source] || { label: s.source, tone: 'slate' };
            const net = s.inflow - s.outflow;
            return (
              <button key={s.source} onClick={() => setFilterSource(filterSource === s.source ? '' : s.source)}
                className={`rounded-lg border-2 p-2 text-left transition ${
                  filterSource === s.source ? 'border-red-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}>
                <div className="text-xs font-extrabold text-slate-700">{meta.label}</div>
                <div className="mt-1 text-base font-extrabold font-mono text-slate-900">{fmtPrice(Math.abs(net))}</div>
                <div className={`text-[10px] font-bold ${net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {net >= 0 ? '+' : '−'} {s.count} ລາຍການ
                </div>
              </button>
            );
          })}
          {(!data?.by_source || data.by_source.length === 0) && <div className="col-span-full py-6 text-center text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>}
        </div>
      </section>

      {/* Transactions list */}
      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h2 className="text-sm font-extrabold text-slate-900 mr-auto">ລາຍລະອຽດທຸລະກຳ · {fmtNum(filtered.length)} ລາຍການ</h2>
          <div className="flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
            {[
              { key: '', label: 'ທັງໝົດ' },
              { key: 'income', label: '🟢 ເຂົ້າ' },
              { key: 'expense', label: '🔴 ອອກ' },
            ].map(t => (
              <button key={t.key} onClick={() => setFilterType(t.key)}
                className={`px-3 py-1.5 text-xs font-bold transition ${filterType === t.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ຄົ້ນຫາ..."
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm outline-none focus:border-red-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">ວັນທີ</th>
                <th className="px-3 py-2">ແຫຼ່ງ</th>
                <th className="px-3 py-2">ລາຍລະອຽດ</th>
                <th className="px-3 py-2">ບັນຊີ</th>
                <th className="px-3 py-2">ວິທີ</th>
                <th className="px-3 py-2 text-right">ຈຳນວນ</th>
                <th className="px-3 py-2 text-right">LAK</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="7" className="py-10 text-center text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="7" className="py-10 text-center text-slate-400">ບໍ່ມີຂໍ້ມູນ</td></tr>
              ) : filtered.map((t, i) => {
                const meta = SOURCE_LABEL[t.source] || { label: t.source };
                return (
                  <tr key={`${t.source}-${t.source_id}-${i}`} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] text-slate-600">{fmtDateTime(t.date)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{meta.label}</td>
                    <td className="px-3 py-2 max-w-[280px]">
                      <div className="font-bold text-slate-800 truncate">{t.description || t.source_label || '—'}</div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {t.source_label}{t.ref ? ` · ${t.ref}` : ''}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{t.account}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{METHOD_LABEL[t.payment_method] || t.payment_method}</td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right font-mono font-extrabold ${t.txn_type === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {t.txn_type === 'income' ? '+' : '−'}{fmtPrice(t.amount, t.currency)}
                    </td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right font-mono text-xs ${t.txn_type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.txn_type === 'income' ? '+' : '−'}{fmtPrice(t.amount_lak)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-slate-50">
                <tr>
                  <td colSpan="5" className="px-3 py-2 text-right text-xs font-bold text-slate-500">ສຸດທິ (LAK)</td>
                  <td className={`px-3 py-2 text-right font-mono font-extrabold ${filteredTotals.net >= 0 ? 'text-red-700' : 'text-rose-700'}`}>
                    {fmtPrice(filteredTotals.net)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value, sub, tone = 'slate', icon }) {
  const tones = {
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-800',
    rose: 'border-rose-100 bg-rose-50 text-rose-800',
    blue: 'border-blue-100 bg-blue-50 text-red-800',
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
    slate: 'border-slate-200 bg-white text-slate-900',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-widest opacity-70">
        <span>{label}</span>
        <span className="text-base opacity-50">{icon}</span>
      </div>
      <div className="mt-1 text-xl font-extrabold leading-tight">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold opacity-70">{sub}</div>
    </div>
  );
}
