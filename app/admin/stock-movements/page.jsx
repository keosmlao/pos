'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { downloadWorkbookMulti } from '@/utils/excelClient';
import { printReportA4 } from '@/utils/reportPrint';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Number(n) || 0);
const round = n => Math.round(Number(n) || 0);
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDate = v => String(v || '').slice(0, 10).split('-').reverse().join('/');
const fmtDateTime = v => `${fmtDate(v)} ${String(v || '').slice(11, 16)}`;

const QUICK_RANGES = [
  { key: 'month', label: 'ເດືອນນີ້' },
  { key: 'last_month', label: 'ເດືອນແລ້ວ' },
  { key: 'quarter', label: 'ໄຕມາດນີ້' },
  { key: 'ytd', label: 'ປີນີ້' },
  { key: 'all', label: 'ທັງໝົດ' },
];
function getRange(key) {
  const t = new Date();
  if (key === 'all') return { from: '', to: '' };
  if (key === 'month') return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) };
  if (key === 'last_month') return { from: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: iso(new Date(t.getFullYear(), t.getMonth(), 0)) };
  if (key === 'quarter') { const q = Math.floor(t.getMonth() / 3); return { from: iso(new Date(t.getFullYear(), q * 3, 1)), to: iso(t) }; }
  if (key === 'ytd') return { from: iso(new Date(t.getFullYear(), 0, 1)), to: iso(t) };
  return { from: '', to: '' };
}

const TYPE_STYLE = {
  sale: 'bg-rose-100 text-rose-800',
  return: 'bg-emerald-100 text-emerald-800',
  purchase: 'bg-cyan-100 text-cyan-800',
  adjustment: 'bg-amber-100 text-amber-800',
  stock_take: 'bg-violet-100 text-violet-800',
  layby: 'bg-orange-100 text-orange-800',
  layby_cancel: 'bg-slate-200 text-slate-700',
};

export default function StockMovementsPage() {
  const initial = getRange('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [search, setSearch] = useState('');
  const [types, setTypes] = useState([]);
  const [query, setQuery] = useState({ ...initial, search: '', types: [] });
  const [tab, setTab] = useState('doc');
  const [data, setData] = useState(null);
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams();
      if (query.from) p.set('from', query.from);
      if (query.to) p.set('to', query.to);
      if (query.search) p.set('search', query.search);
      if (query.types.length) p.set('types', query.types.join(','));
      const res = await fetch(`${API}/admin/stock-movements?${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setData(null);
      setError(`ດຶງຂໍ້ມູນບໍ່ໄດ້: ${e.message}`);
    }
    setLoading(false);
  }, [query]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch(`${API}/company`).then(r => r.json()).then(setCompany).catch(() => {}); }, []);

  const runSearch = () => {
    if (from && to && from > to) { setError('ວັນທີເລີ່ມຕ້ອງບໍ່ຫຼັງວັນທີສິ້ນສຸດ'); return; }
    setQuery({ from, to, search: search.trim(), types });
  };
  const applyRange = (r) => { setFrom(r.from); setTo(r.to); setQuery({ from: r.from, to: r.to, search: search.trim(), types }); };
  const toggleType = (t) => {
    const next = types.includes(t) ? types.filter(x => x !== t) : [...types, t];
    setTypes(next);
    setQuery(q => ({ ...q, types: next }));
  };

  const dirty = from !== query.from || to !== query.to || search.trim() !== query.search;
  const DOC_TYPES = data?.doc_types || {};
  const summary = data?.summary || {};
  const movements = data?.movements || [];
  const daily = data?.daily || [];
  const rangeLabel = query.from || query.to ? `${query.from || 'ເລີ່ມຕົ້ນ'} ຫາ ${query.to || 'ປັດຈຸບັນ'}` : 'ທັງໝົດ';
  const netTotal = (Number(summary.qty_in) || 0) - (Number(summary.qty_out) || 0);

  const byType = useMemo(() => (data?.by_type || []).map(t => ({ ...t, label: DOC_TYPES[t.doc_type] || t.doc_type })), [data, DOC_TYPES]);

  const exportExcel = async () => {
    const num = { numFmt: '#,##0' };
    await downloadWorkbookMulti({
      fileName: `stock_movements_${query.from || 'all'}_${query.to || 'all'}.xlsx`,
      sheets: [
        {
          name: 'ສະຫຼຸບ',
          title: `ການເຄື່ອນໄຫວສິນຄ້າ · ${rangeLabel}`,
          columns: [{ header: 'ລາຍການ', key: 'k', width: 28 }, { header: 'ມູນຄ່າ', key: 'v', width: 18, ...num }],
          rows: [
            { k: 'ຊ່ວງວັນທີ', v: rangeLabel },
            { k: 'ຈຳນວນລາຍການເຄື່ອນໄຫວ', v: round(summary.movements) },
            { k: 'ຈຳນວນສິນຄ້າ', v: round(summary.products) },
            { k: 'ຮັບເຂົ້າລວມ', v: round(summary.qty_in) },
            { k: 'ຈ່າຍອອກລວມ', v: round(summary.qty_out) },
            { k: 'ສຸດທິ', v: round(netTotal) },
            ...byType.map(t => ({ k: `— ${t.label}`, v: round(t.qty_in) - round(t.qty_out) })),
          ],
        },
        {
          name: 'ຕາມເອກະສານ',
          title: `ການເຄື່ອນໄຫວຕາມລາຍລະອຽດເອກະສານ · ${rangeLabel}`,
          columns: [
            { header: 'ວັນທີ', key: 'date', width: 18 },
            { header: 'ປະເພດເອກະສານ', key: 'type', width: 18 },
            { header: 'ເລກທີເອກະສານ', key: 'no', width: 22 },
            { header: 'ຄູ່ຄ້າ / ເຫດຜົນ', key: 'partner', width: 24 },
            { header: 'ລະຫັດສິນຄ້າ', key: 'code', width: 16 },
            { header: 'ຊື່ສິນຄ້າ', key: 'name', width: 38 },
            { header: 'ຫົວໜ່ວຍ', key: 'unit', width: 10 },
            { header: 'balance_begin', key: 'bb', width: 14, ...num },
            { header: 'qty_in', key: 'qi', width: 10, ...num },
            { header: 'qty_out', key: 'qo', width: 10, ...num },
            { header: 'balance_end', key: 'be', width: 14, ...num },
          ],
          rows: movements.map(m => ({
            date: fmtDateTime(m.doc_at), type: DOC_TYPES[m.doc_type] || m.doc_type, no: m.doc_no,
            partner: m.partner || '', code: m.product_code || '', name: m.product_name || '', unit: m.unit || '',
            bb: round(m.balance_begin), qi: round(m.qty_in), qo: round(m.qty_out), be: round(m.balance_end),
          })),
        },
        {
          name: 'ຕາມວັນທີ',
          title: `ການເຄື່ອນໄຫວຕາມແຕ່ລະວັນທີ · ${rangeLabel}`,
          columns: [
            { header: 'ວັນທີ', key: 'date', width: 14 },
            { header: 'ລະຫັດສິນຄ້າ', key: 'code', width: 16 },
            { header: 'ຊື່ສິນຄ້າ', key: 'name', width: 38 },
            { header: 'ຫົວໜ່ວຍ', key: 'unit', width: 10 },
            { header: 'balance_begin', key: 'bb', width: 14, ...num },
            { header: 'qty_in', key: 'qi', width: 10, ...num },
            { header: 'qty_out', key: 'qo', width: 10, ...num },
            { header: 'qty_net', key: 'qn', width: 10, ...num },
            { header: 'balance_end', key: 'be', width: 14, ...num },
          ],
          rows: daily.map(d => ({
            date: fmtDate(d.d), code: d.product_code || '', name: d.product_name || '', unit: d.unit || '',
            bb: round(d.balance_begin), qi: round(d.qty_in), qo: round(d.qty_out),
            qn: round(d.qty_net), be: round(d.balance_end),
          })),
        },
      ],
    });
  };

  const exportPdf = () => {
    const docTable = {
      title: `ຕາມລາຍລະອຽດເອກະສານ (${movements.length})`,
      columns: [
        { header: 'ວັນທີ', align: 'left', width: '11%' },
        { header: 'ປະເພດ', align: 'left', width: '10%' },
        { header: 'ເລກທີເອກະສານ', align: 'left', width: '14%' },
        { header: 'ລະຫັດ', align: 'left', width: '10%' },
        { header: 'ຊື່ສິນຄ້າ', align: 'left' },
        { header: 'ຫົວໜ່ວຍ', align: 'left', width: '7%' },
        { header: 'ຍອດຍົກມາ', align: 'right', width: '9%' },
        { header: 'ຮັບເຂົ້າ', align: 'right', width: '8%' },
        { header: 'ຈ່າຍອອກ', align: 'right', width: '8%' },
        { header: 'ຄົງເຫຼືອ', align: 'right', width: '9%' },
      ],
      rows: movements.map(m => [
        fmtDateTime(m.doc_at), DOC_TYPES[m.doc_type] || m.doc_type, m.doc_no || '—',
        m.product_code || '—', m.product_name || '—', m.unit || '—',
        fmtNum(m.balance_begin), fmtNum(m.qty_in), fmtNum(m.qty_out), fmtNum(m.balance_end),
      ]),
      totals: movements.length ? ['', '', '', '', 'ລວມ', '',
        '', fmtNum(movements.reduce((s, m) => s + (Number(m.qty_in) || 0), 0)),
        fmtNum(movements.reduce((s, m) => s + (Number(m.qty_out) || 0), 0)), ''] : null,
    };
    const dailyTable = {
      title: `ຕາມແຕ່ລະວັນທີ (${daily.length})`,
      columns: [
        { header: 'ວັນທີ', align: 'left', width: '11%' },
        { header: 'ລະຫັດ', align: 'left', width: '12%' },
        { header: 'ຊື່ສິນຄ້າ', align: 'left' },
        { header: 'ຫົວໜ່ວຍ', align: 'left', width: '8%' },
        { header: 'ຍອດຍົກມາ', align: 'right', width: '10%' },
        { header: 'ຮັບເຂົ້າ', align: 'right', width: '9%' },
        { header: 'ຈ່າຍອອກ', align: 'right', width: '9%' },
        { header: 'ສຸດທິ', align: 'right', width: '8%' },
        { header: 'ຄົງເຫຼືອ', align: 'right', width: '10%' },
      ],
      rows: daily.map(d => [
        fmtDate(d.d), d.product_code || '—', d.product_name || '—', d.unit || '—',
        fmtNum(d.balance_begin), fmtNum(d.qty_in), fmtNum(d.qty_out), fmtNum(d.qty_net), fmtNum(d.balance_end),
      ]),
      totals: daily.length ? ['', '', 'ລວມ', '',
        '', fmtNum(daily.reduce((s, d) => s + (Number(d.qty_in) || 0), 0)),
        fmtNum(daily.reduce((s, d) => s + (Number(d.qty_out) || 0), 0)), '', ''] : null,
    };
    printReportA4({
      company,
      landscape: true,
      title: 'ລາຍງານການເຄື່ອນໄຫວສິນຄ້າ',
      subtitle: 'ຍອດຄົງເຫຼືອຄິດຖອຍຫຼັງຈາກສະຕັອກປັດຈຸບັນ',
      meta: [
        { label: 'ຊ່ວງວັນທີ', value: rangeLabel },
        { label: 'ສິນຄ້າ', value: `${fmtNum(summary.products)} ລາຍການ` },
        ...(query.search ? [{ label: 'ຄົ້ນຫາ', value: query.search }] : []),
        ...(query.types.length ? [{ label: 'ປະເພດ', value: query.types.map(t => DOC_TYPES[t] || t).join(', ') }] : []),
      ],
      kpis: [
        { label: 'ລາຍການເຄື່ອນໄຫວ', value: fmtNum(summary.movements) },
        { label: 'ຮັບເຂົ້າ', value: fmtNum(summary.qty_in), accent: 'emerald' },
        { label: 'ຈ່າຍອອກ', value: fmtNum(summary.qty_out), accent: 'rose' },
        { label: 'ສຸດທິ', value: `${netTotal >= 0 ? '+' : ''}${fmtNum(netTotal)}`, accent: 'cyan' },
        { label: 'ສິນຄ້າ', value: fmtNum(summary.products), accent: 'amber' },
      ],
      tables: tab === 'doc' ? [docTable] : [dailyTable],
    });
  };

  const hasRows = movements.length > 0 || daily.length > 0;

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Stock Movement"
        title="🔄 ການເຄື່ອນໄຫວສິນຄ້າ"
        subtitle="ຮັບເຂົ້າ / ຈ່າຍອອກ ພ້ອມຍອດຄົງເຫຼືອທຸກເອກະສານ ແລະ ທຸກວັນທີ"
      />

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ຈາກວັນທີ</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ຫາວັນທີ</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-bold text-slate-600 mb-1">ສິນຄ້າ (ລະຫັດ / ຊື່ / ບາໂຄດ)</label>
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder="ວ່າງໄວ້ = ທຸກສິນຄ້າ"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <button onClick={runSearch} disabled={loading}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white transition disabled:opacity-50 ${dirty ? 'bg-red-600 hover:bg-red-700 ring-2 ring-red-200' : 'bg-slate-700 hover:bg-slate-800'}`}>
            {loading ? 'ກຳລັງຄົ້ນຫາ...' : '🔍 ຄົ້ນຫາ'}
          </button>
          <div className="flex gap-2">
            <button onClick={exportExcel} disabled={!hasRows || loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition disabled:opacity-40">⬇ Excel</button>
            <button onClick={exportPdf} disabled={!hasRows || loading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold transition disabled:opacity-40">🖨 PDF</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_RANGES.map(r => (
              <button key={r.key} onClick={() => applyRange(getRange(r.key))}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition">{r.label}</button>
            ))}
          </div>
          <div className="h-5 w-px bg-slate-200" />
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(DOC_TYPES).map(([k, label]) => {
              const on = types.includes(k);
              return (
                <button key={k} onClick={() => toggleType(k)}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition ${on ? `${TYPE_STYLE[k]} border-transparent ring-2 ring-slate-300` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                  {label}
                </button>
              );
            })}
            {types.length > 0 && (
              <button onClick={() => { setTypes([]); setQuery(q => ({ ...q, types: [] })); }}
                className="px-2.5 py-1.5 rounded-full text-[11px] font-bold text-slate-400 hover:text-rose-600">✕ ລ້າງ</button>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-500">
          ກຳລັງສະແດງ: <b className="text-slate-800">{rangeLabel}</b>
          {query.search && <span className="ml-2">· ສິນຄ້າ “{query.search}”</span>}
          {dirty && <span className="ml-2 text-red-600 font-bold">· ເງື່ອນໄຂປ່ຽນແລ້ວ ກົດ “ຄົ້ນຫາ”</span>}
        </div>
        {error && <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
        {data?.truncated && (
          <div className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠ ຂໍ້ມູນຫຼາຍເກີນ — ສະແດງບາງສ່ວນເທົ່ານັ້ນ ກະລຸນາແຄບຊ່ວງວັນທີ ຫຼື ລະບຸສິນຄ້າ
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="ລາຍການເຄື່ອນໄຫວ" value={fmtNum(summary.movements)} />
        <Kpi label="ຮັບເຂົ້າ" value={fmtNum(summary.qty_in)} accent="emerald" />
        <Kpi label="ຈ່າຍອອກ" value={fmtNum(summary.qty_out)} accent="rose" />
        <Kpi label="ສຸດທິ" value={`${netTotal >= 0 ? '+' : ''}${fmtNum(netTotal)}`} accent="cyan" highlight />
        <Kpi label="ຈຳນວນສິນຄ້າ" value={fmtNum(summary.products)} accent="amber" />
      </div>

      {byType.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byType.map(t => (
            <div key={t.doc_type} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${TYPE_STYLE[t.doc_type] || 'bg-slate-100 text-slate-700'}`}>
              {t.label} · {fmtNum(t.documents)} ລາຍການ
              {Number(t.qty_in) > 0 && <span className="ml-1">↑{fmtNum(t.qty_in)}</span>}
              {Number(t.qty_out) > 0 && <span className="ml-1">↓{fmtNum(t.qty_out)}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          {[
            { key: 'doc', label: `ຕາມລາຍລະອຽດເອກະສານ (${movements.length})` },
            { key: 'day', label: `ຕາມແຕ່ລະວັນທີ (${daily.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-bold transition ${tab === t.key ? 'border-b-2 border-red-600 text-red-600' : 'text-slate-600 hover:text-slate-900'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto max-h-[640px]">
          {tab === 'doc' ? (
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-bold text-slate-600">ວັນທີ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ປະເພດເອກະສານ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ເລກທີເອກະສານ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ລະຫັດສິນຄ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ຊື່ສິນຄ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ຫົວໜ່ວຍ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຍອດຍົກມາ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຮັບເຂົ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຈ່າຍອອກ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຄົງເຫຼືອ</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">{loading ? 'ກຳລັງໂຫຼດ...' : 'ບໍ່ມີການເຄື່ອນໄຫວ'}</td></tr>
                ) : movements.map((m, i) => (
                  <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-1.5 font-mono text-slate-600">{fmtDateTime(m.doc_at)}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TYPE_STYLE[m.doc_type] || 'bg-slate-100 text-slate-700'}`}>
                        {DOC_TYPES[m.doc_type] || m.doc_type}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono">
                      {m.doc_no}
                      {m.partner && <span className="ml-1 text-[10px] text-slate-400">{m.partner}</span>}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-slate-600">{m.product_code || '—'}</td>
                    <td className="px-3 py-1.5 font-bold text-slate-900 max-w-[280px] truncate" title={m.product_name}>{m.product_name}</td>
                    <td className="px-3 py-1.5 text-slate-500">{m.unit || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-500">{fmtNum(m.balance_begin)}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700">{Number(m.qty_in) > 0 ? fmtNum(m.qty_in) : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold text-rose-700">{Number(m.qty_out) > 0 ? fmtNum(m.qty_out) : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-extrabold text-slate-900">{fmtNum(m.balance_end)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-bold text-slate-600">ວັນທີ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ລະຫັດສິນຄ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ຊື່ສິນຄ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ຫົວໜ່ວຍ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຍອດຍົກມາ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຮັບເຂົ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຈ່າຍອອກ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ສຸດທິ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຄົງເຫຼືອ</th>
                </tr>
              </thead>
              <tbody>
                {daily.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">{loading ? 'ກຳລັງໂຫຼດ...' : 'ບໍ່ມີການເຄື່ອນໄຫວ'}</td></tr>
                ) : daily.map((d, i) => (
                  <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-1.5 font-mono text-slate-600">{fmtDate(d.d)}</td>
                    <td className="px-3 py-1.5 font-mono text-slate-600">{d.product_code || '—'}</td>
                    <td className="px-3 py-1.5 font-bold text-slate-900 max-w-[320px] truncate" title={d.product_name}>{d.product_name}</td>
                    <td className="px-3 py-1.5 text-slate-500">{d.unit || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-500">{fmtNum(d.balance_begin)}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700">{Number(d.qty_in) > 0 ? fmtNum(d.qty_in) : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-bold text-rose-700">{Number(d.qty_out) > 0 ? fmtNum(d.qty_out) : '—'}</td>
                    <td className={`px-3 py-1.5 text-right font-mono font-bold ${Number(d.qty_net) > 0 ? 'text-emerald-700' : Number(d.qty_net) < 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                      {Number(d.qty_net) > 0 ? `+${fmtNum(d.qty_net)}` : fmtNum(d.qty_net)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-extrabold text-slate-900">{fmtNum(d.balance_end)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-500 leading-relaxed">
        <b className="text-slate-700">ວິທີຄິດຍອດຄົງເຫຼືອ:</b> ນັບຖອຍຫຼັງຈາກສະຕັອກປັດຈຸບັນ ຍອດແຖວລ່າສຸດຈຶ່ງກົງກັບສະຕັອກຈິງສະເໝີ.
        ການປ່ຽນສະຕັອກທີ່ບໍ່ມີເອກະສານ (ແກ້ຈຳນວນໃນໜ້າຈັດການສິນຄ້າ, ນຳເຂົ້າ CSV, ຍອດຍົກມາຕອນສ້າງສິນຄ້າ)
        ຈະລວມຢູ່ໃນ “ຍອດຍົກມາ” ຂອງແຖວທຳອິດ. ການໂອນລະຫວ່າງສາຂາໃຊ້ຍອດແຍກຕ່າງຫາກ ຈຶ່ງບໍ່ປາກົດຢູ່ນີ້.
      </div>
    </div>
  );
}

function Kpi({ label, value, accent = 'slate', highlight }) {
  const valCls = {
    slate: 'text-slate-900', cyan: 'text-cyan-700', emerald: 'text-emerald-700',
    rose: 'text-rose-700', amber: 'text-amber-700',
  }[accent];
  return (
    <div className={`rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm ${highlight ? 'ring-2 ring-cyan-100' : ''}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${valCls}`}>{value}</div>
    </div>
  );
}
