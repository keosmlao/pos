'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { downloadWorkbookMulti } from '@/utils/excelClient';
import { printReportA4 } from '@/utils/reportPrint';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Number(n) || 0);
const fmtCost = n => new Intl.NumberFormat('lo-LA', { maximumFractionDigits: 2 }).format(Number(n) || 0);
const round = n => Math.round(Number(n) || 0);
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
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
  opening: 'bg-slate-200 text-slate-700',
  sale: 'bg-rose-100 text-rose-800',
  return: 'bg-emerald-100 text-emerald-800',
  purchase: 'bg-cyan-100 text-cyan-800',
  purchase_return: 'bg-fuchsia-100 text-fuchsia-800',
  adjustment: 'bg-amber-100 text-amber-800',
  stock_take: 'bg-violet-100 text-violet-800',
  layby: 'bg-orange-100 text-orange-800',
  layby_cancel: 'bg-slate-200 text-slate-700',
};

export default function StockCostPage() {
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
      const res = await fetch(`${API}/admin/stock-cost?${p}`);
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
  const products = data?.products || [];
  const rangeLabel = query.from || query.to ? `${query.from || 'ເລີ່ມຕົ້ນ'} ຫາ ${query.to || 'ປັດຈຸບັນ'}` : 'ທັງໝົດ';
  const valueChange = (Number(summary.close_value) || 0) - (Number(summary.open_value) || 0);

  // ສິນຄ້າທີ່ຕົ້ນທຶນປ່ຽນແປງແຮງທີ່ສຸດໃນຊ່ວງນີ້
  const topMovers = useMemo(() => (
    [...products]
      .filter(p => Math.abs(Number(p.cost_change) || 0) > 0.005)
      .sort((a, b) => Math.abs(b.cost_change) - Math.abs(a.cost_change))
      .slice(0, 8)
  ), [products]);

  const exportExcel = async () => {
    const num = { numFmt: '#,##0' };
    const num2 = { numFmt: '#,##0.00' };
    await downloadWorkbookMulti({
      fileName: `stock_cost_${query.from || 'all'}_${query.to || 'all'}.xlsx`,
      sheets: [
        {
          name: 'ສະຫຼຸບ',
          title: `ການເຄື່ອນໄຫວສິນຄ້າ ພ້ອມຕົ້ນທຶນ · ${rangeLabel}`,
          columns: [{ header: 'ລາຍການ', key: 'k', width: 32 }, { header: 'ມູນຄ່າ', key: 'v', width: 20, ...num }],
          rows: [
            { k: 'ຊ່ວງວັນທີ', v: rangeLabel },
            { k: 'ຈຳນວນສິນຄ້າ', v: round(summary.products) },
            { k: 'ລາຍການເຄື່ອນໄຫວ', v: round(summary.movements) },
            { k: 'ມູນຄ່າຍົກມາ', v: round(summary.open_value) },
            { k: 'ຮັບເຂົ້າ (ຈຳນວນ)', v: round(summary.in_qty) },
            { k: 'ຮັບເຂົ້າ (ມູນຄ່າ)', v: round(summary.in_value) },
            { k: 'ຈ່າຍອອກ (ຈຳນວນ)', v: round(summary.out_qty) },
            { k: 'ຈ່າຍອອກ (ຕົ້ນທຶນ)', v: round(summary.out_value) },
            { k: 'ມູນຄ່າຍົກໄປ', v: round(summary.close_value) },
            { k: 'ມູນຄ່າປ່ຽນແປງ', v: round(valueChange) },
          ],
        },
        {
          name: 'ຕາມເອກະສານ',
          title: `ການເຄື່ອນໄຫວຕາມເອກະສານ ພ້ອມຕົ້ນທຶນ · ${rangeLabel}`,
          columns: [
            { header: 'ວັນທີ', key: 'date', width: 18 },
            { header: 'ປະເພດເອກະສານ', key: 'type', width: 18 },
            { header: 'ເລກທີເອກະສານ', key: 'no', width: 22 },
            { header: 'ຄູ່ຄ້າ / ເຫດຜົນ', key: 'partner', width: 24 },
            { header: 'ລະຫັດສິນຄ້າ', key: 'code', width: 16 },
            { header: 'ຊື່ສິນຄ້າ', key: 'name', width: 38 },
            { header: 'ຫົວໜ່ວຍ', key: 'unit', width: 10 },
            { header: 'ຮັບເຂົ້າ', key: 'qi', width: 10, ...num },
            { header: 'ຈ່າຍອອກ', key: 'qo', width: 10, ...num },
            { header: 'ຕົ້ນທຶນ/ໜ່ວຍ', key: 'uc', width: 14, ...num2 },
            { header: 'ມູນຄ່າຮັບເຂົ້າ', key: 'vi', width: 16, ...num },
            { header: 'ມູນຄ່າຈ່າຍອອກ', key: 'vo', width: 16, ...num },
            { header: 'ຄົງເຫຼືອ', key: 'bq', width: 12, ...num },
            { header: 'ຕົ້ນທຶນສະເລ່ຍ', key: 'ac', width: 14, ...num2 },
            { header: 'ມູນຄ່າຄົງເຫຼືອ', key: 'bv', width: 16, ...num },
          ],
          rows: movements.map(m => ({
            date: fmtDateTime(m.doc_at), type: DOC_TYPES[m.doc_type] || m.doc_type, no: m.doc_no,
            partner: m.partner || '', code: m.product_code || '', name: m.product_name || '', unit: m.unit || '',
            qi: round(m.qty_in), qo: round(m.qty_out), uc: round2(m.unit_cost),
            vi: round(m.value_in), vo: round(m.value_out),
            bq: round(m.balance_qty), ac: round2(m.avg_cost), bv: round(m.balance_value),
          })),
        },
        {
          name: 'ສະຫຼຸບຕໍ່ສິນຄ້າ',
          title: `ຕົ້ນທຶນຍົກມາ / ຍົກໄປ ຕໍ່ສິນຄ້າ · ${rangeLabel}`,
          columns: [
            { header: 'ລະຫັດສິນຄ້າ', key: 'code', width: 16 },
            { header: 'ຊື່ສິນຄ້າ', key: 'name', width: 40 },
            { header: 'ຫົວໜ່ວຍ', key: 'unit', width: 10 },
            { header: 'ຈຳນວນຍົກມາ', key: 'oq', width: 14, ...num },
            { header: 'ຕົ້ນທຶນຍົກມາ', key: 'oc', width: 14, ...num2 },
            { header: 'ມູນຄ່າຍົກມາ', key: 'ov', width: 16, ...num },
            { header: 'ຮັບເຂົ້າ', key: 'iq', width: 12, ...num },
            { header: 'ມູນຄ່າຮັບເຂົ້າ', key: 'iv', width: 16, ...num },
            { header: 'ຈ່າຍອອກ', key: 'oq2', width: 12, ...num },
            { header: 'ຕົ້ນທຶນຈ່າຍອອກ', key: 'ov2', width: 16, ...num },
            { header: 'ຈຳນວນຍົກໄປ', key: 'cq', width: 14, ...num },
            { header: 'ຕົ້ນທຶນຍົກໄປ', key: 'cc', width: 14, ...num2 },
            { header: 'ມູນຄ່າຍົກໄປ', key: 'cv', width: 16, ...num },
            { header: 'ຕົ້ນທຶນປ່ຽນແປງ', key: 'ch', width: 16, ...num2 },
          ],
          rows: products.map(p => ({
            code: p.product_code || '', name: p.product_name || '', unit: p.unit || '',
            oq: round(p.open_qty), oc: round2(p.open_cost), ov: round(p.open_value),
            iq: round(p.in_qty), iv: round(p.in_value),
            oq2: round(p.out_qty), ov2: round(p.out_value),
            cq: round(p.close_qty), cc: round2(p.close_cost), cv: round(p.close_value),
            ch: round2(p.cost_change),
          })),
        },
      ],
    });
  };

  const exportPdf = () => {
    const docTable = {
      title: `ຕາມເອກະສານຮັບ-ຈ່າຍ (${movements.length})`,
      columns: [
        { header: 'ວັນທີ', align: 'left', width: '9%' },
        { header: 'ປະເພດ', align: 'left', width: '9%' },
        { header: 'ເລກທີ', align: 'left', width: '12%' },
        { header: 'ລະຫັດ', align: 'left', width: '9%' },
        { header: 'ຊື່ສິນຄ້າ', align: 'left' },
        { header: 'ຮັບເຂົ້າ', align: 'right', width: '6%' },
        { header: 'ຈ່າຍອອກ', align: 'right', width: '6%' },
        { header: 'ຕົ້ນທຶນ/ໜ່ວຍ', align: 'right', width: '8%' },
        { header: 'ມູນຄ່າເຂົ້າ', align: 'right', width: '8%' },
        { header: 'ມູນຄ່າອອກ', align: 'right', width: '8%' },
        { header: 'ຄົງເຫຼືອ', align: 'right', width: '6%' },
        { header: 'ຕົ້ນທຶນສະເລ່ຍ', align: 'right', width: '8%' },
        { header: 'ມູນຄ່າຄົງເຫຼືອ', align: 'right', width: '9%' },
      ],
      rows: movements.map(m => [
        fmtDate(m.doc_at), DOC_TYPES[m.doc_type] || m.doc_type, m.doc_no || '—',
        m.product_code || '—', m.product_name || '—',
        Number(m.qty_in) > 0 ? fmtNum(m.qty_in) : '—',
        Number(m.qty_out) > 0 ? fmtNum(m.qty_out) : '—',
        fmtCost(m.unit_cost),
        Number(m.value_in) > 0 ? fmtNum(m.value_in) : '—',
        Number(m.value_out) > 0 ? fmtNum(m.value_out) : '—',
        fmtNum(m.balance_qty), fmtCost(m.avg_cost), fmtNum(m.balance_value),
      ]),
      totals: movements.length ? ['', '', '', '', 'ລວມ',
        fmtNum(summary.in_qty), fmtNum(summary.out_qty), '',
        fmtNum(summary.in_value), fmtNum(summary.out_value), '', '', fmtNum(summary.close_value)] : null,
    };
    const prodTable = {
      title: `ສະຫຼຸບຕົ້ນທຶນຕໍ່ສິນຄ້າ (${products.length})`,
      columns: [
        { header: 'ລະຫັດ', align: 'left', width: '10%' },
        { header: 'ຊື່ສິນຄ້າ', align: 'left' },
        { header: 'ຫົວໜ່ວຍ', align: 'left', width: '6%' },
        { header: 'ຈຳນວນຍົກມາ', align: 'right', width: '8%' },
        { header: 'ຕົ້ນທຶນຍົກມາ', align: 'right', width: '8%' },
        { header: 'ມູນຄ່າຍົກມາ', align: 'right', width: '9%' },
        { header: 'ຮັບເຂົ້າ', align: 'right', width: '6%' },
        { header: 'ຈ່າຍອອກ', align: 'right', width: '6%' },
        { header: 'ຈຳນວນຍົກໄປ', align: 'right', width: '8%' },
        { header: 'ຕົ້ນທຶນຍົກໄປ', align: 'right', width: '8%' },
        { header: 'ມູນຄ່າຍົກໄປ', align: 'right', width: '9%' },
        { header: 'ຕົ້ນທຶນ +/−', align: 'right', width: '8%' },
      ],
      rows: products.map(p => [
        p.product_code || '—', p.product_name || '—', p.unit || '—',
        fmtNum(p.open_qty), fmtCost(p.open_cost), fmtNum(p.open_value),
        fmtNum(p.in_qty), fmtNum(p.out_qty),
        fmtNum(p.close_qty), fmtCost(p.close_cost), fmtNum(p.close_value),
        `${Number(p.cost_change) > 0 ? '+' : ''}${fmtCost(p.cost_change)}`,
      ]),
      totals: products.length ? ['', 'ລວມ', '', '', '', fmtNum(summary.open_value),
        fmtNum(summary.in_qty), fmtNum(summary.out_qty), '', '', fmtNum(summary.close_value), ''] : null,
    };
    printReportA4({
      company,
      landscape: true,
      title: 'ລາຍງານການເຄື່ອນໄຫວສິນຄ້າ ພ້ອມຕົ້ນທຶນ',
      subtitle: 'ຕົ້ນທຶນຄິດແບບຖົວສະເລ່ຍເຄື່ອນທີ່ (moving average)',
      meta: [
        { label: 'ຊ່ວງວັນທີ', value: rangeLabel },
        { label: 'ສິນຄ້າ', value: `${fmtNum(summary.products)} ລາຍການ` },
        ...(query.search ? [{ label: 'ຄົ້ນຫາ', value: query.search }] : []),
        ...(query.types.length ? [{ label: 'ປະເພດ', value: query.types.map(t => DOC_TYPES[t] || t).join(', ') }] : []),
      ],
      kpis: [
        { label: 'ມູນຄ່າຍົກມາ', value: fmtNum(summary.open_value) },
        { label: 'ມູນຄ່າຮັບເຂົ້າ', value: fmtNum(summary.in_value), accent: 'emerald' },
        { label: 'ຕົ້ນທຶນຈ່າຍອອກ', value: fmtNum(summary.out_value), accent: 'rose' },
        { label: 'ມູນຄ່າຍົກໄປ', value: fmtNum(summary.close_value), accent: 'cyan' },
        { label: 'ປ່ຽນແປງ', value: `${valueChange >= 0 ? '+' : ''}${fmtNum(valueChange)}`, accent: 'amber' },
      ],
      tables: tab === 'doc' ? [docTable] : [prodTable],
    });
  };

  const hasRows = movements.length > 0 || products.length > 0;

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Stock Cost"
        title="💰 ການເຄື່ອນໄຫວສິນຄ້າ (ຕົ້ນທຶນ)"
        subtitle="ປະຫວັດຮັບເຂົ້າ-ຈ່າຍອອກຕາມເອກະສານ ພ້ອມຕົ້ນທຶນສະເລ່ຍທີ່ຂຶ້ນ-ລົງແຕ່ລະຊ່ວງ"
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
            ⚠ ຂໍ້ມູນຫຼາຍເກີນ — ສະແດງບາງສ່ວນເທົ່ານັ້ນ ກະລຸນາລະບຸສິນຄ້າ ຫຼື ແຄບຊ່ວງວັນທີ
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="ມູນຄ່າຍົກມາ" value={fmtNum(summary.open_value)} />
        <Kpi label="ມູນຄ່າຮັບເຂົ້າ" value={fmtNum(summary.in_value)} accent="emerald" sub={`${fmtNum(summary.in_qty)} ໜ່ວຍ`} />
        <Kpi label="ຕົ້ນທຶນຈ່າຍອອກ" value={fmtNum(summary.out_value)} accent="rose" sub={`${fmtNum(summary.out_qty)} ໜ່ວຍ`} />
        <Kpi label="ມູນຄ່າຍົກໄປ" value={fmtNum(summary.close_value)} accent="cyan" highlight />
        <Kpi label="ມູນຄ່າປ່ຽນແປງ" value={`${valueChange >= 0 ? '+' : ''}${fmtNum(valueChange)}`} accent="amber" />
      </div>

      {topMovers.length > 0 && (
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">ຕົ້ນທຶນປ່ຽນແປງແຮງທີ່ສຸດໃນຊ່ວງນີ້</div>
          <div className="flex flex-wrap gap-2">
            {topMovers.map(p => {
              const up = Number(p.cost_change) > 0;
              return (
                <div key={p.product_id} className={`px-3 py-1.5 rounded-lg text-[11px] font-bold ${up ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'}`}>
                  {p.product_code ? `${p.product_code} · ` : ''}{p.product_name}
                  <span className="ml-1.5 font-mono">{up ? '▲' : '▼'} {fmtCost(Math.abs(p.cost_change))}</span>
                  <span className="ml-1 opacity-60 font-mono">({fmtCost(p.open_cost)} → {fmtCost(p.close_cost)})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          {[
            { key: 'doc', label: `ຕາມເອກະສານຮັບ-ຈ່າຍ (${movements.length})` },
            { key: 'prod', label: `ສະຫຼຸບຕໍ່ສິນຄ້າ (${products.length})` },
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
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-left">
                  <th className="px-3 py-2 font-bold text-slate-600">ວັນທີ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ປະເພດເອກະສານ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ເລກທີເອກະສານ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ລະຫັດສິນຄ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ຊື່ສິນຄ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right bg-emerald-50/60">ຮັບເຂົ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right bg-rose-50/60">ຈ່າຍອອກ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຕົ້ນທຶນ/ໜ່ວຍ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right bg-emerald-50/60">ມູນຄ່າເຂົ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right bg-rose-50/60">ມູນຄ່າອອກ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຄົງເຫຼືອ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຕົ້ນທຶນສະເລ່ຍ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ມູນຄ່າຄົງເຫຼືອ</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan={13} className="px-4 py-12 text-center text-slate-400">{loading ? 'ກຳລັງໂຫຼດ...' : 'ບໍ່ມີການເຄື່ອນໄຫວ'}</td></tr>
                ) : movements.map((m, i) => {
                  const prev = movements[i - 1];
                  const newProduct = !prev || prev.product_id !== m.product_id;
                  return (
                    <tr key={i} className={`border-t hover:bg-slate-50 ${newProduct ? 'border-slate-300' : 'border-slate-100'}`}>
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
                      <td className="px-3 py-1.5 font-bold text-slate-900 max-w-[240px] truncate" title={m.product_name}>{m.product_name}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700">{Number(m.qty_in) > 0 ? fmtNum(m.qty_in) : '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-rose-700">{Number(m.qty_out) > 0 ? fmtNum(m.qty_out) : '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-700">{fmtCost(m.unit_cost)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-emerald-700">{Number(m.value_in) > 0 ? fmtNum(m.value_in) : '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-rose-700">{Number(m.value_out) > 0 ? fmtNum(m.value_out) : '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-600">{fmtNum(m.balance_qty)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-extrabold text-cyan-800">{fmtCost(m.avg_cost)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-extrabold text-slate-900">{fmtNum(m.balance_value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs whitespace-nowrap">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr className="text-left">
                  <th className="px-3 py-2 font-bold text-slate-600">ລະຫັດສິນຄ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ຊື່ສິນຄ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ຫົວໜ່ວຍ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຈຳນວນຍົກມາ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຕົ້ນທຶນຍົກມາ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ມູນຄ່າຍົກມາ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right bg-emerald-50/60">ຮັບເຂົ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right bg-rose-50/60">ຈ່າຍອອກ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຈຳນວນຍົກໄປ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຕົ້ນທຶນຍົກໄປ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ມູນຄ່າຍົກໄປ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຕົ້ນທຶນ +/−</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-12 text-center text-slate-400">{loading ? 'ກຳລັງໂຫຼດ...' : 'ບໍ່ມີການເຄື່ອນໄຫວ'}</td></tr>
                ) : products.map(p => {
                  const ch = Number(p.cost_change) || 0;
                  return (
                    <tr key={p.product_id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-1.5 font-mono text-slate-600">{p.product_code || '—'}</td>
                      <td className="px-3 py-1.5 font-bold text-slate-900 max-w-[300px] truncate" title={p.product_name}>{p.product_name}</td>
                      <td className="px-3 py-1.5 text-slate-500">{p.unit || '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-600">{fmtNum(p.open_qty)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-600">{fmtCost(p.open_cost)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-slate-600">{fmtNum(p.open_value)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700">{fmtNum(p.in_qty)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-rose-700">{fmtNum(p.out_qty)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-900">{fmtNum(p.close_qty)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-extrabold text-cyan-800">{fmtCost(p.close_cost)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-extrabold text-slate-900">{fmtNum(p.close_value)}</td>
                      <td className={`px-3 py-1.5 text-right font-mono font-bold ${ch > 0 ? 'text-rose-700' : ch < 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {ch === 0 ? '—' : `${ch > 0 ? '▲ +' : '▼ '}${fmtCost(ch)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] text-slate-500 leading-relaxed">
        <b className="text-slate-700">ວິທີຄິດຕົ້ນທຶນ:</b> ຖົວສະເລ່ຍເຄື່ອນທີ່ (moving average) —
        ຮັບເຂົ້າໃຊ້ລາຄາຊື້ໃນເອກະສານນັ້ນ, ຈ່າຍອອກຕັດຕາມຕົ້ນທຶນສະເລ່ຍ ณ ຕອນນັ້ນ,
        ຕົ້ນທຶນສະເລ່ຍ = ມູນຄ່າຄົງເຫຼືອ ÷ ຈຳນວນຄົງເຫຼືອ. ຈຶ່ງເຫັນໄດ້ວ່າຕົ້ນທຶນຂຶ້ນ-ລົງຕອນໃດ ແລະ ຍ້ອນເອກະສານໃດ.
        <br />
        <b className="text-slate-700">ໝາຍເຫດ:</b> ເອກະສານປັບປຸງສະຕັອກ / ນັບສິນຄ້າ / ຝາກຂາຍ ບໍ່ໄດ້ບັນທຶກຕົ້ນທຶນໄວ້ —
        ໃຊ້ຕົ້ນທຶນປັດຈຸບັນຂອງສິນຄ້າແທນ ຈຶ່ງເປັນຄ່າປະມານ. ຕົວເລກກຳໄລໃນລາຍງານ COGS
        ຍັງອີງຕົ້ນທຶນທີ່ບັນທຶກໄວ້ຕອນຂາຍຄືເກົ່າ ບໍ່ໄດ້ປ່ຽນຕາມໜ້ານີ້.
      </div>
    </div>
  );
}

function Kpi({ label, value, accent = 'slate', highlight, sub }) {
  const valCls = {
    slate: 'text-slate-900', cyan: 'text-cyan-700', emerald: 'text-emerald-700',
    rose: 'text-rose-700', amber: 'text-amber-700',
  }[accent];
  return (
    <div className={`rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm ${highlight ? 'ring-2 ring-cyan-100' : ''}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${valCls}`}>{value}</div>
      {sub && <div className="text-[10px] font-bold text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
