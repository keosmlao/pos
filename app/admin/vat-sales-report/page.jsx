'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { downloadWorkbookMulti } from '@/utils/excelClient';
import { printReportA4 } from '@/utils/reportPrint';
import { orderVatBreakdown, vatLineLabel } from '@/lib/vat';
import { formatDate } from '@/utils/formatDate';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;
const round = n => Math.round(Number(n) || 0);

const VAT_FILTERS = [
  { key: 'with', label: 'ບິນທີ່ມີ ອມພ' },
  { key: 'without', label: 'ບິນທີ່ບໍ່ມີ ອມພ' },
  { key: 'all', label: 'ທັງໝົດ' },
];

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

export default function VatSalesReportPage() {
  const initial = getRange('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [vatFilter, setVatFilter] = useState('with');
  const [query, setQuery] = useState({ ...initial, vat: 'with' });   // ຊ່ວງທີ່ຄົ້ນຫາໄປແລ້ວຈິງ
  const [search, setSearch] = useState('');
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
      params.set('vat', query.vat);
      const res = await fetch(`${API}/admin/vat-sales-report?${params}`, { cache: 'no-store' });
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
    setQuery({ from, to, vat: vatFilter });
  };
  const applyRange = (r) => { setFrom(r.from); setTo(r.to); setQuery({ ...r, vat: vatFilter }); };
  const applyVatFilter = (key) => { setVatFilter(key); setQuery(q => ({ ...q, vat: key })); };
  const pickMonth = (value) => {
    const [y, m] = String(value).split('-').map(Number);
    if (!y || !m) return;
    const last = new Date(y, m, 0).getDate();
    applyRange({ from: `${value}-01`, to: `${value}-${String(last).padStart(2, '0')}` });
  };

  const dirty = from !== query.from || to !== query.to;
  const monthValue = from && to && from.slice(0, 7) === to.slice(0, 7) ? from.slice(0, 7) : '';

  // ແຍກຍອດດ້ວຍຕົວດຽວກັບໃບບິນ — ຈຶ່ງບໍ່ຫຼົງກັນລະຫວ່າງລາຍງານ ແລະ ບິນທີ່ພິມອອກ
  const term = search.trim().toLowerCase();
  const lines = useMemo(() => {
    const rows = data?.rows || [];
    const all = rows.map(r => ({ row: r, b: orderVatBreakdown(r, { label: company.vat_label, itemsSum: Number(r.items_sum) || 0 }) }));
    if (!term) return all;
    return all.filter(({ row }) =>
      String(row.bill_number || row.id).toLowerCase().includes(term) ||
      String(row.customer_name || '').toLowerCase().includes(term)
    );
  }, [data, company.vat_label, term]);

  const totals = useMemo(() => lines.reduce((t, { b }) => ({
    beforeVat: t.beforeVat + b.beforeVat,
    vatAmount: t.vatAmount + b.vatAmount,
    systemTotal: t.systemTotal + b.systemTotal,
  }), { beforeVat: 0, vatAmount: 0, systemTotal: 0 }), [lines]);

  // ຫົວຖັນ ອມພ — ຖ້າທຸກບິນໃຊ້ອັດຕາດຽວກັນ ໃຫ້ຂຶ້ນອັດຕານັ້ນເລີຍ (ຕົວຢ່າງ "ອມພ VAT 10%")
  const vatHeader = useMemo(() => {
    const rates = [...new Set(lines.filter(l => l.b.hasVat).map(l => l.b.rate))];
    if (rates.length === 1) return vatLineLabel({ label: company.vat_label, rate: rates[0] });
    if (rates.length === 0 && Number(company.vat_rate) > 0 && query.vat !== 'without') {
      return vatLineLabel({ label: company.vat_label, rate: Number(company.vat_rate) });
    }
    return 'ອມພ (VAT)';
  }, [lines, company.vat_label, company.vat_rate, query.vat]);

  const filterLabel = VAT_FILTERS.find(f => f.key === query.vat)?.label || '';
  const rangeLabel = query.from === query.to ? (query.from || '—') : `${query.from || '—'} ຫາ ${query.to || '—'}`;
  const fileStamp = query.from === query.to ? query.from : `${query.from}_${query.to}`;
  const hasRows = lines.length > 0;

  const exportExcel = async () => {
    const money = { numFmt: '#,##0' };
    await downloadWorkbookMulti({
      fileName: `vat_sales_report_${query.vat}_${fileStamp}.xlsx`,
      sheets: [
        {
          name: 'ລາຍງານ ອມພ',
          title: `ລາຍງານການຂາຍສິນຄ້າ ອມພ (VAT) — ${filterLabel} · ${rangeLabel}`,
          columns: [
            { header: 'ລຳດັບ', key: 'no', width: 8 },
            { header: 'ວັນທີບິນ', key: 'date', width: 14 },
            { header: 'ເລກທີບິນ', key: 'bill', width: 20 },
            { header: 'ຊື່ລູກຄ້າ', key: 'customer', width: 28 },
            { header: 'ມູນຄ່າກ່ອນ ອມພ', key: 'before', width: 20, ...money },
            { header: vatHeader, key: 'vat', width: 18, ...money },
            { header: 'ລວມທັງໝົດ', key: 'total', width: 20, ...money },
          ],
          rows: [
            ...lines.map(({ row, b }, i) => ({
              no: i + 1,
              date: formatDate(row.created_at),
              bill: row.bill_number || `#${row.id}`,
              customer: row.customer_name || 'ລູກຄ້າທົ່ວໄປ',
              before: round(b.beforeVat),
              vat: round(b.vatAmount),
              total: round(b.systemTotal),
            })),
            {
              no: '', date: '', bill: '', customer: `ລວມ ${lines.length} ບິນ`,
              before: round(totals.beforeVat), vat: round(totals.vatAmount), total: round(totals.systemTotal),
            },
          ],
        },
      ],
    });
  };

  const exportPdf = () => {
    printReportA4({
      company,
      title: 'ລາຍງານການຂາຍສິນຄ້າ ອມພ (VAT)',
      subtitle: `${filterLabel} · ລວມທັງໝົດ = ມູນຄ່າກ່ອນ ອມພ + ອມພ`,
      meta: [
        { label: 'ຊ່ວງວັນທີ', value: rangeLabel },
        { label: 'ເງື່ອນໄຂ', value: filterLabel },
        { label: 'ຈຳນວນບິນ', value: fmtNum(lines.length) },
        ...(term ? [{ label: 'ຄົ້ນຫາ', value: search.trim() }] : []),
      ],
      kpis: [
        { label: 'ຈຳນວນບິນ', value: fmtNum(lines.length) },
        { label: 'ມູນຄ່າກ່ອນ ອມພ', value: fmtPrice(totals.beforeVat), accent: 'cyan' },
        { label: vatHeader, value: fmtPrice(totals.vatAmount), accent: 'rose' },
        { label: 'ລວມທັງໝົດ', value: fmtPrice(totals.systemTotal), accent: 'emerald' },
      ],
      tables: [
        {
          title: `${filterLabel} (${lines.length})`,
          columns: [
            { header: 'ລຳດັບ', align: 'right', width: '6%' },
            { header: 'ວັນທີບິນ', align: 'left', width: '12%' },
            { header: 'ເລກທີບິນ', align: 'left', width: '18%' },
            { header: 'ຊື່ລູກຄ້າ', align: 'left' },
            { header: 'ມູນຄ່າກ່ອນ ອມພ', align: 'right', width: '15%' },
            { header: vatHeader, align: 'right', width: '13%' },
            { header: 'ລວມທັງໝົດ', align: 'right', width: '15%' },
          ],
          rows: lines.map(({ row, b }, i) => [
            String(i + 1),
            formatDate(row.created_at),
            row.bill_number || `#${row.id}`,
            row.customer_name || 'ລູກຄ້າທົ່ວໄປ',
            fmtNum(b.beforeVat),
            fmtNum(b.vatAmount),
            fmtNum(b.systemTotal),
          ]),
          totals: hasRows
            ? ['', '', '', `ລວມ ${lines.length} ບິນ`, fmtNum(totals.beforeVat), fmtNum(totals.vatAmount), fmtNum(totals.systemTotal)]
            : null,
        },
      ],
    });
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="VAT sales report"
        title="🧾 ລາຍງານການຂາຍສິນຄ້າ ອມພ (VAT)"
        subtitle="ລາຍງານຕາມບິນຂາຍ — ເລືອກໄດ້ວ່າຈະເບິ່ງບິນທີ່ມີ ອມພ ຫຼື ບິນທີ່ບໍ່ມີ ອມພ"
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

        {/* ເງື່ອນໄຂ ອມພ */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-600 mr-1">ເງື່ອນໄຂ:</span>
          {VAT_FILTERS.map(f => {
            const count = f.key === 'with' ? data?.with_vat_bills
              : f.key === 'without' ? data?.without_vat_bills
              : (Number(data?.with_vat_bills) || 0) + (Number(data?.without_vat_bills) || 0);
            return (
              <button key={f.key} onClick={() => applyVatFilter(f.key)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
                  vatFilter === f.key ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}>
                {f.label}{data ? ` (${fmtNum(count)})` : ''}
              </button>
            );
          })}
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
            placeholder="ຄົ້ນຫາເລກທີບິນ / ຊື່ລູກຄ້າ ໃນລາຍງານ..."
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[240px] flex-1"
          />
        </div>

        <div className="text-xs text-slate-500">
          ກຳລັງສະແດງ: <b className="text-slate-800">{filterLabel} · {rangeLabel}</b>
          {dirty && <span className="ml-2 text-red-600 font-bold">· ວັນທີປ່ຽນແລ້ວ ກົດ “ຄົ້ນຫາ” ເພື່ອອັບເດດ</span>}
          {term && <span className="ml-2">· ກັ່ນຕອງ “{search.trim()}”</span>}
        </div>
        {data?.truncated && (
          <div className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ສະແດງ {fmtNum(data.rows.length)} ບິນ ຈາກ {fmtNum(data.total_bills)} ບິນ — ກະລຸນາແຄບຊ່ວງວັນທີລົງ
          </div>
        )}
        {error && <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="ຈຳນວນບິນ" value={fmtNum(lines.length)} />
        <Kpi label="ມູນຄ່າກ່ອນ ອມພ" value={fmtPrice(totals.beforeVat)} accent="cyan" />
        <Kpi label={vatHeader} value={fmtPrice(totals.vatAmount)} accent="rose" />
        <Kpi label="ລວມທັງໝົດ" value={fmtPrice(totals.systemTotal)} accent="emerald" highlight />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">{filterLabel} ({fmtNum(lines.length)})</div>
        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold text-slate-600 text-right whitespace-nowrap">ລຳດັບ</th>
                <th className="px-3 py-2 font-bold text-slate-600 whitespace-nowrap">ວັນທີບິນ</th>
                <th className="px-3 py-2 font-bold text-slate-600 whitespace-nowrap">ເລກທີບິນ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ຊື່ລູກຄ້າ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right whitespace-nowrap">ມູນຄ່າກ່ອນ ອມພ <span className="font-normal text-slate-400">(₭)</span></th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right whitespace-nowrap">{vatHeader} <span className="font-normal text-slate-400">(₭)</span></th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right whitespace-nowrap">ລວມທັງໝົດ <span className="font-normal text-slate-400">(₭)</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  {loading ? 'ກຳລັງໂຫຼດ...' : 'ບໍ່ມີບິນຕາມເງື່ອນໄຂນີ້'}
                </td></tr>
              ) : lines.map(({ row, b }, i) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-right font-mono text-slate-400">{i + 1}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-600 whitespace-nowrap">{formatDate(row.created_at)}</td>
                  <td className="px-3 py-1.5 font-mono font-bold text-slate-800 whitespace-nowrap">{row.bill_number || `#${row.id}`}</td>
                  <td className="px-3 py-1.5">
                    {row.customer_name
                      ? <span className="font-bold text-slate-700">{row.customer_name}</span>
                      : <span className="text-slate-400">ລູກຄ້າທົ່ວໄປ</span>}
                    {row.member_code && <span className="ml-1 text-[9px] text-slate-400 font-mono">{row.member_code}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtNum(b.beforeVat)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-rose-700 font-bold">{fmtNum(b.vatAmount)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-extrabold text-slate-900">{fmtNum(b.systemTotal)}</td>
                </tr>
              ))}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold">
                  <td className="px-3 py-2" colSpan={4}>ລວມ {fmtNum(lines.length)} ບິນ</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(totals.beforeVat)}</td>
                  <td className="px-3 py-2 text-right font-mono text-rose-700">{fmtNum(totals.vatAmount)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(totals.systemTotal)}</td>
                </tr>
              </tfoot>
            )}
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
    <div className={`rounded-xl border-2 ${cls} p-4 shadow-sm ${highlight ? 'ring-2 ring-emerald-100' : ''}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${valCls}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
