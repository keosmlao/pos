'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { downloadWorkbookMulti } from '@/utils/excelClient';
import { printReportA4 } from '@/utils/reportPrint';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;
const round = n => Math.round(Number(n) || 0);

const QUICK_RANGES = [
  { key: 'today', label: 'ມື້ນີ້' },
  { key: '7d', label: '7 ວັນ' },
  { key: 'month', label: 'ເດືອນນີ້' },
  { key: 'last_month', label: 'ເດືອນແລ້ວ' },
  { key: 'quarter', label: 'ໄຕມາດນີ້' },
  { key: 'ytd', label: 'ປີນີ້' },
];

// ວັນທີແບບ local — ຫ້າມໃຊ້ toISOString() ເພາະມັນປ່ຽນເປັນ UTC ແລ້ວວັນເລື່ອນ 1 ວັນ (ລາວ = UTC+7)
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function getRange(key) {
  const today = new Date();
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
  const [query, setQuery] = useState(initial);   // ຊ່ວງທີ່ຄົ້ນຫາໄປແລ້ວຈິງ
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('products');
  const [data, setData] = useState(null);
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query.from) params.set('from', query.from);
      if (query.to) params.set('to', query.to);
      params.set('limit', 'all');
      const res = await fetch(`${API}/admin/profit-report?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setData(null);
      setError(`ດຶງຂໍ້ມູນບໍ່ໄດ້: ${e.message}`);
    }
    setLoading(false);
  }, [query]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(`${API}/company`).then(r => r.json()).then(setCompany).catch(() => {});
  }, []);

  const runSearch = () => {
    if (from && to && from > to) { setError('ວັນທີເລີ່ມຕ້ອງບໍ່ຫຼັງວັນທີສິ້ນສຸດ'); return; }
    setQuery({ from, to });
  };
  const applyRange = (r) => { setFrom(r.from); setTo(r.to); setQuery(r); };
  const pickMonth = (value) => {
    const [y, m] = String(value).split('-').map(Number);
    if (!y || !m) return;
    const last = new Date(y, m, 0).getDate();
    applyRange({ from: `${value}-01`, to: `${value}-${String(last).padStart(2, '0')}` });
  };

  const dirty = from !== query.from || to !== query.to;
  const monthValue = from && to && from.slice(0, 7) === to.slice(0, 7) ? from.slice(0, 7) : '';

  const summary = data?.summary || {};
  const daily = data?.daily || [];
  const margin = useMemo(() => marginPct(summary.revenue, summary.profit), [summary]);

  const term = search.trim().toLowerCase();
  const products = useMemo(() => {
    const rows = data?.products || [];
    return term ? rows.filter(r => String(r.product_name || '').toLowerCase().includes(term)) : rows;
  }, [data, term]);
  const categories = useMemo(() => {
    const rows = data?.categories || [];
    return term ? rows.filter(r => String(r.category_name || '').toLowerCase().includes(term)) : rows;
  }, [data, term]);

  const rangeLabel = `${query.from || '—'} ຫາ ${query.to || '—'}`;
  const fileStamp = `${query.from || 'all'}_${query.to || 'all'}`;

  const sumOf = (rows, key) => rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
  const totalsOf = (rows) => ({
    qty: sumOf(rows, 'qty'), revenue: sumOf(rows, 'revenue'),
    cost: sumOf(rows, 'cost'), profit: sumOf(rows, 'profit'),
  });

  const exportExcel = async () => {
    const money = { numFmt: '#,##0' };
    const pct = { numFmt: '0.0"%"' };
    const pt = totalsOf(products);
    const ct = totalsOf(categories);
    await downloadWorkbookMulti({
      fileName: `profit_cogs_${fileStamp}.xlsx`,
      sheets: [
        {
          name: 'ສະຫຼຸບ',
          title: `ລາຍງານກຳໄລ / COGS · ${rangeLabel}`,
          columns: [{ header: 'ລາຍການ', key: 'k', width: 26 }, { header: 'ມູນຄ່າ', key: 'v', width: 22, ...money }],
          rows: [
            { k: 'ຊ່ວງວັນທີ', v: rangeLabel },
            { k: 'ຈຳນວນບິນຂາຍ', v: round(summary.orders) },
            { k: 'ລາຍຮັບ (ex-VAT)', v: round(summary.revenue) },
            { k: 'ຕົ້ນທຶນສິນຄ້າ (COGS)', v: round(summary.cost) },
            { k: 'ກຳໄລຂັ້ນຕົ້ນ', v: round(summary.profit) },
            { k: 'Margin %', v: Number(margin.toFixed(1)) },
            { k: 'ຈຳນວນສິນຄ້າ', v: products.length },
            { k: 'ຈຳນວນໝວດໝູ່', v: categories.length },
          ],
        },
        {
          name: 'ຕາມສິນຄ້າ',
          title: `ກຳໄລ / COGS ຕາມສິນຄ້າ · ${rangeLabel}`,
          columns: [
            { header: '#', key: 'no', width: 6 },
            { header: 'ສິນຄ້າ', key: 'name', width: 40 },
            { header: 'ຈຳນວນຂາຍ', key: 'qty', width: 14, ...money },
            { header: 'ລາຍຮັບ', key: 'revenue', width: 18, ...money },
            { header: 'ຕົ້ນທຶນ', key: 'cost', width: 18, ...money },
            { header: 'ກຳໄລ', key: 'profit', width: 18, ...money },
            { header: 'Margin %', key: 'margin', width: 12, ...pct },
          ],
          rows: [
            ...products.map((r, i) => ({
              no: i + 1, name: r.product_name, qty: round(r.qty), revenue: round(r.revenue),
              cost: round(r.cost), profit: round(r.profit), margin: Number(marginPct(r.revenue, r.profit).toFixed(1)),
            })),
            { no: '', name: 'ລວມທັງໝົດ', qty: round(pt.qty), revenue: round(pt.revenue), cost: round(pt.cost), profit: round(pt.profit), margin: Number(marginPct(pt.revenue, pt.profit).toFixed(1)) },
          ],
        },
        {
          name: 'ຕາມໝວດໝູ່',
          title: `ກຳໄລ / COGS ຕາມໝວດໝູ່ · ${rangeLabel}`,
          columns: [
            { header: '#', key: 'no', width: 6 },
            { header: 'ໝວດໝູ່', key: 'name', width: 32 },
            { header: 'ຈຳນວນຂາຍ', key: 'qty', width: 14, ...money },
            { header: 'ລາຍຮັບ', key: 'revenue', width: 18, ...money },
            { header: 'ຕົ້ນທຶນ', key: 'cost', width: 18, ...money },
            { header: 'ກຳໄລ', key: 'profit', width: 18, ...money },
            { header: 'Margin %', key: 'margin', width: 12, ...pct },
          ],
          rows: [
            ...categories.map((r, i) => ({
              no: i + 1, name: r.category_name, qty: round(r.qty), revenue: round(r.revenue),
              cost: round(r.cost), profit: round(r.profit), margin: Number(marginPct(r.revenue, r.profit).toFixed(1)),
            })),
            { no: '', name: 'ລວມທັງໝົດ', qty: round(ct.qty), revenue: round(ct.revenue), cost: round(ct.cost), profit: round(ct.profit), margin: Number(marginPct(ct.revenue, ct.profit).toFixed(1)) },
          ],
        },
      ],
    });
  };

  const exportPdf = () => {
    const cols = (firstHeader) => [
      { header: '#', align: 'right', width: '5%' },
      { header: firstHeader, align: 'left' },
      { header: 'ຈຳນວນ', align: 'right', width: '10%' },
      { header: 'ລາຍຮັບ', align: 'right', width: '15%' },
      { header: 'ຕົ້ນທຶນ', align: 'right', width: '15%' },
      { header: 'ກຳໄລ', align: 'right', width: '15%' },
      { header: 'Margin', align: 'right', width: '9%' },
    ];
    const body = (rows, nameKey) => rows.map((r, i) => [
      String(i + 1), r[nameKey] || '—', fmtNum(r.qty), fmtPrice(r.revenue),
      fmtPrice(r.cost), fmtPrice(r.profit), `${marginPct(r.revenue, r.profit).toFixed(1)}%`,
    ]);
    const totalRow = (rows) => {
      const t = totalsOf(rows);
      return ['', 'ລວມທັງໝົດ', fmtNum(t.qty), fmtPrice(t.revenue), fmtPrice(t.cost), fmtPrice(t.profit), `${marginPct(t.revenue, t.profit).toFixed(1)}%`];
    };
    printReportA4({
      company,
      title: 'ລາຍງານກຳໄລ / COGS',
      subtitle: 'ກຳໄລ = ລາຍຮັບ (ບໍ່ລວມ VAT) − ຕົ້ນທຶນສິນຄ້າ',
      meta: [
        { label: 'ຊ່ວງວັນທີ', value: rangeLabel },
        { label: 'ບິນຂາຍ', value: fmtNum(summary.orders) },
        ...(term ? [{ label: 'ຄົ້ນຫາ', value: search.trim() }] : []),
      ],
      kpis: [
        { label: 'ບິນຂາຍ', value: fmtNum(summary.orders) },
        { label: 'ລາຍຮັບ (ex-VAT)', value: fmtPrice(summary.revenue), accent: 'cyan' },
        { label: 'ຕົ້ນທຶນ (COGS)', value: fmtPrice(summary.cost), accent: 'amber' },
        { label: 'ກຳໄລ', value: fmtPrice(summary.profit), accent: 'emerald' },
        { label: 'Margin %', value: `${margin.toFixed(1)}%`, accent: margin >= 20 ? 'emerald' : margin >= 10 ? 'amber' : 'rose' },
      ],
      tables: [
        { title: `ກຳໄລ / COGS ຕາມສິນຄ້າ (${products.length})`, columns: cols('ສິນຄ້າ'), rows: body(products, 'product_name'), totals: products.length ? totalRow(products) : null },
        { title: `ກຳໄລ / COGS ຕາມໝວດໝູ່ (${categories.length})`, columns: cols('ໝວດໝູ່'), rows: body(categories, 'category_name'), totals: categories.length ? totalRow(categories) : null },
      ],
    });
  };

  const hasRows = products.length > 0 || categories.length > 0;

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Profit / COGS"
        title="📈 ລາຍງານກຳໄລ / COGS"
        subtitle="ກຳໄລ = ລາຍຮັບ (ບໍ່ລວມ VAT) − ຕົ້ນທຶນສິນຄ້າ"
      />

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ຈາກວັນທີ</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ຫາວັນທີ</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ເລືອກເດືອນ</label>
            <input type="month" value={monthValue} onChange={e => pickMonth(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <button onClick={runSearch} disabled={loading}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white transition disabled:opacity-50 ${dirty ? 'bg-red-600 hover:bg-red-700 ring-2 ring-red-200' : 'bg-slate-700 hover:bg-slate-800'}`}>
            {loading ? 'ກຳລັງຄົ້ນຫາ...' : '🔍 ຄົ້ນຫາ'}
          </button>
          <div className="flex-1" />
          <div className="flex gap-2">
            <button onClick={exportExcel} disabled={!hasRows || loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition disabled:opacity-40">
              ⬇ Excel
            </button>
            <button onClick={exportPdf} disabled={!hasRows || loading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold transition disabled:opacity-40">
              🖨 PDF
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_RANGES.map(r => (
              <button key={r.key} onClick={() => applyRange(getRange(r.key))}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition">{r.label}</button>
            ))}
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ຄົ້ນຫາຊື່ສິນຄ້າ / ໝວດໝູ່ ໃນລາຍງານ..."
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[240px] flex-1"
          />
        </div>

        <div className="text-xs text-slate-500">
          ກຳລັງສະແດງ: <b className="text-slate-800">{rangeLabel}</b>
          {dirty && <span className="ml-2 text-red-600 font-bold">· ວັນທີປ່ຽນແລ້ວ ກົດ “ຄົ້ນຫາ” ເພື່ອອັບເດດ</span>}
          {term && <span className="ml-2">· ກັ່ນຕອງ “{search.trim()}”</span>}
        </div>
        {error && <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
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
            {(tab === 'products' ? products : categories).length > 0 && (
              <tfoot className="sticky bottom-0">
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold">
                  {(() => {
                    const t = totalsOf(tab === 'products' ? products : categories);
                    return (
                      <>
                        <td className="px-3 py-2">ລວມທັງໝົດ</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtNum(t.qty)}</td>
                        <td className="px-3 py-2 text-right font-mono">{fmtPrice(t.revenue)}</td>
                        <td className="px-3 py-2 text-right font-mono text-amber-700">{fmtPrice(t.cost)}</td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-700">{fmtPrice(t.profit)}</td>
                        <td className="px-3 py-2 text-right font-mono">{marginPct(t.revenue, t.profit).toFixed(1)}%</td>
                      </>
                    );
                  })()}
                </tr>
              </tfoot>
            )}
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
