'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { downloadWorkbookMulti } from '@/utils/excelClient';
import { downloadTaxrisWorkbook } from '@/utils/taxrisExport';
import { printReportA4 } from '@/utils/reportPrint';
import { formatDate } from '@/utils/formatDate';
import {
  DEFAULT_TIN, STATUS_FILTERS, STATUS_LABEL, STATUS_SENT, QUICK_RANGES,
  getRange, buildVatInvoiceLines, sumVatInvoiceLines,
  taxrisDate, taxrisBillNumber, taxrisTin,
} from '@/utils/vatInvoices';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;
const round = n => Math.round(Number(n) || 0);

export default function VatInvoiceReportPage() {
  const initial = getRange('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState({ ...initial, status: 'all' });
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query.from) params.set('from', query.from);
      if (query.to) params.set('to', query.to);
      params.set('status', query.status);
      const res = await fetch(`${API}/admin/vat-invoice-report?${params}`, { cache: 'no-store' });
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
    setQuery({ from, to, status });
  };
  const applyRange = (r) => { setFrom(r.from); setTo(r.to); setQuery({ ...r, status }); };
  const applyStatus = (key) => { setStatus(key); setQuery(q => ({ ...q, status: key })); };
  const pickMonth = (value) => {
    const [y, m] = String(value).split('-').map(Number);
    if (!y || !m) return;
    const last = new Date(y, m, 0).getDate();
    applyRange({ from: `${value}-01`, to: `${value}-${String(last).padStart(2, '0')}` });
  };

  const dirty = from !== query.from || to !== query.to;
  const monthValue = from && to && from.slice(0, 7) === to.slice(0, 7) ? from.slice(0, 7) : '';

  const term = search.trim().toLowerCase();
  const lines = useMemo(() => {
    const all = buildVatInvoiceLines(data?.rows, company.vat_label);
    if (!term) return all;
    return all.filter(l =>
      l.billNumber.toLowerCase().includes(term) ||
      l.customerName.toLowerCase().includes(term) ||
      l.tin.toLowerCase().includes(term)
    );
  }, [data, company.vat_label, term]);

  const totals = useMemo(() => sumVatInvoiceLines(lines), [lines]);
  const vatHeader = useMemo(() => {
    const rates = [...new Set(lines.map(l => l.b.rate).filter(r => r > 0))];
    return rates.length === 1 ? `ອມພ ${rates[0]}%` : 'ອມພ';
  }, [lines]);

  const rangeLabel = query.from === query.to ? (query.from || '—') : `${query.from || '—'} ຫາ ${query.to || '—'}`;
  const fileStamp = query.from === query.to ? query.from : `${query.from}_${query.to}`;
  const hasRows = lines.length > 0;

  const exportExcel = async () => {
    const money = { numFmt: '#,##0' };
    await downloadWorkbookMulti({
      fileName: `vat_invoice_report_${fileStamp}.xlsx`,
      sheets: [{
        name: 'ບິນອາກອນ',
        title: `ລາຍງານອອກບິນອາກອນ · ${rangeLabel}`,
        columns: [
          { header: 'ລຳດັບ', key: 'no', width: 8 },
          { header: 'ວັນທີ', key: 'date', width: 14 },
          { header: 'ເລກທີ', key: 'bill', width: 20 },
          { header: 'ຊື່ລູກຄ້າ', key: 'customer', width: 28 },
          { header: 'TIN', key: 'tin', width: 16 },
          { header: 'ລວມມູນຄ່າສິນຄ້າ', key: 'gross', width: 18, ...money },
          { header: 'ສ່ວນຫຼຸດລວມ', key: 'discount', width: 16, ...money },
          { header: 'ມູນຄ່າກ່ອນ ອມພ', key: 'before', width: 18, ...money },
          { header: vatHeader, key: 'vat', width: 16, ...money },
          { header: 'ລວມທັງໝົດ', key: 'total', width: 18, ...money },
          { header: 'ສະຖານະ', key: 'status', width: 14 },
        ],
        rows: [
          ...lines.map((l, i) => ({
            no: i + 1,
            date: formatDate(l.date),
            bill: l.billNumber,
            customer: l.customerName,
            tin: taxrisTin(l.row),
            gross: round(l.itemsGross),
            discount: round(l.discount),
            before: round(l.beforeVat),
            vat: round(l.vatAmount),
            total: round(l.systemTotal),
            status: STATUS_LABEL[l.status],
          })),
          {
            no: '', date: '', bill: '', customer: `ລວມ ${lines.length} ບິນ`, tin: '',
            gross: round(totals.itemsGross), discount: round(totals.discount),
            before: round(totals.beforeVat), vat: round(totals.vatAmount), total: round(totals.systemTotal),
            status: '',
          },
        ],
      }],
    });
  };

  // ລາຍງານ TAXRIS — ຮູບແບບຕາມ template ຂອງກົມສ່ວຍສາອາກອນ
  const exportTaxris = async () => {
    setBusy(true);
    try {
      await downloadTaxrisWorkbook({
        fileName: `TAXRIS_${fileStamp}.xlsx`,
        rows: lines.map(l => ({
          tin: taxrisTin(l.row),                 // ວ່າງ/NULL → 999999999999
          name: l.customerName,
          billNumber: taxrisBillNumber(l.row),   // ຕັດຂີດອອກ
          date: taxrisDate(l.date),              // DDMMYYYY
          description: l.description,
          beforeVat: l.beforeVat,
          vatAmount: l.vatAmount,
        })),
      });
    } catch (e) {
      setError(`ສ້າງລາຍງານ TAXRIS ບໍ່ໄດ້: ${e.message}`);
    }
    setBusy(false);
  };

  const exportPdf = () => {
    printReportA4({
      company,
      title: 'ລາຍງານອອກບິນອາກອນ',
      subtitle: 'ບິນທີ່ມີ ອມພ ທັງໝົດ — ລວມທັງໝົດ = ມູນຄ່າກ່ອນ ອມພ + ອມພ',
      landscape: true,
      meta: [
        { label: 'ຊ່ວງວັນທີ', value: rangeLabel },
        { label: 'ຈຳນວນບິນ', value: fmtNum(lines.length) },
        ...(term ? [{ label: 'ຄົ້ນຫາ', value: search.trim() }] : []),
      ],
      kpis: [
        { label: 'ຈຳນວນບິນ', value: fmtNum(lines.length) },
        { label: 'ລວມມູນຄ່າສິນຄ້າ', value: fmtPrice(totals.itemsGross) },
        { label: 'ມູນຄ່າກ່ອນ ອມພ', value: fmtPrice(totals.beforeVat), accent: 'cyan' },
        { label: vatHeader, value: fmtPrice(totals.vatAmount), accent: 'rose' },
        { label: 'ລວມທັງໝົດ', value: fmtPrice(totals.systemTotal), accent: 'emerald' },
      ],
      tables: [{
        title: `ບິນທີ່ມີ ອມພ (${lines.length})`,
        columns: [
          { header: 'ລຳດັບ', align: 'right', width: '5%' },
          { header: 'ວັນທີ', align: 'left', width: '9%' },
          { header: 'ເລກທີ', align: 'left', width: '14%' },
          { header: 'ຊື່ລູກຄ້າ', align: 'left' },
          { header: 'TIN', align: 'left', width: '11%' },
          { header: 'ລວມມູນຄ່າສິນຄ້າ', align: 'right', width: '11%' },
          { header: 'ສ່ວນຫຼຸດລວມ', align: 'right', width: '10%' },
          { header: 'ມູນຄ່າກ່ອນ ອມພ', align: 'right', width: '11%' },
          { header: vatHeader, align: 'right', width: '9%' },
          { header: 'ລວມທັງໝົດ', align: 'right', width: '11%' },
          { header: 'ສະຖານະ', align: 'center', width: '9%' },
        ],
        rows: lines.map((l, i) => [
          String(i + 1), formatDate(l.date), l.billNumber, l.customerName, taxrisTin(l.row),
          fmtNum(l.itemsGross), l.discount > 0 ? `−${fmtNum(l.discount)}` : '—',
          fmtNum(l.beforeVat), fmtNum(l.vatAmount), fmtNum(l.systemTotal), STATUS_LABEL[l.status],
        ]),
        totals: hasRows
          ? ['', '', '', `ລວມ ${lines.length} ບິນ`, '', fmtNum(totals.itemsGross), `−${fmtNum(totals.discount)}`,
             fmtNum(totals.beforeVat), fmtNum(totals.vatAmount), fmtNum(totals.systemTotal), '']
          : null,
      }],
    });
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Tax invoice report"
        title="📊 ລາຍງານອອກບິນອາກອນ"
        subtitle="ບິນທີ່ມີ ອມພ ທັງໝົດ — ດຶງອອກເປັນ PDF, Excel ຫຼື ລາຍງານ TAXRIS"
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
          <div className="flex flex-wrap gap-2">
            <button onClick={exportTaxris} disabled={!hasRows || loading || busy}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-extrabold transition disabled:opacity-40">
              {busy ? 'ກຳລັງສ້າງ...' : '📑 ລາຍງານ TAXRIS'}
            </button>
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

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-600 mr-1">ສະຖານະ:</span>
          {STATUS_FILTERS.map(f => {
            const count = f.key === 'pending' ? data?.pending_bills
              : f.key === 'sent' ? data?.sent_bills
              : (Number(data?.pending_bills) || 0) + (Number(data?.sent_bills) || 0);
            return (
              <button key={f.key} onClick={() => applyStatus(f.key)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
                  status === f.key ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
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
            placeholder="ຄົ້ນຫາເລກທີບິນ / ຊື່ລູກຄ້າ / TIN..."
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[240px] flex-1"
          />
        </div>

        <div className="text-xs text-slate-500">
          ກຳລັງສະແດງ: <b className="text-slate-800">{rangeLabel}</b>
          {dirty && <span className="ml-2 text-red-600 font-bold">· ວັນທີປ່ຽນແລ້ວ ກົດ “ຄົ້ນຫາ” ເພື່ອອັບເດດ</span>}
          {term && <span className="ml-2">· ກັ່ນຕອງ “{search.trim()}”</span>}
        </div>
        <div className="text-[11px] text-slate-500">
          ລາຍງານ TAXRIS: ບິນທີ່ບໍ່ມີ TIN ຈະໃຊ້ <b className="font-mono text-slate-700">{DEFAULT_TIN}</b> ແທນ ·
          ເລກທີບິນຕັດຂີດອອກ · ວັນທີເປັນ DDMMYYYY
        </div>
        {data?.truncated && (
          <div className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ສະແດງ {fmtNum(data.rows.length)} ບິນ ຈາກ {fmtNum(data.total_bills)} ບິນ — ກະລຸນາແຄບຊ່ວງວັນທີລົງ
          </div>
        )}
        {error && <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="ຈຳນວນບິນ" value={fmtNum(lines.length)} />
        <Kpi label="ລວມມູນຄ່າສິນຄ້າ" value={fmtPrice(totals.itemsGross)} />
        <Kpi label="ສ່ວນຫຼຸດລວມ" value={fmtPrice(totals.discount)} accent="amber" />
        <Kpi label="ມູນຄ່າກ່ອນ ອມພ" value={fmtPrice(totals.beforeVat)} accent="cyan" />
        <Kpi label={vatHeader} value={fmtPrice(totals.vatAmount)} accent="rose" highlight />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">ບິນທີ່ມີ ອມພ ({fmtNum(lines.length)})</div>
        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold text-slate-600 text-right whitespace-nowrap">ລຳດັບ</th>
                <th className="px-3 py-2 font-bold text-slate-600 whitespace-nowrap">ວັນທີ</th>
                <th className="px-3 py-2 font-bold text-slate-600 whitespace-nowrap">ເລກທີ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ຊື່ລູກຄ້າ</th>
                <th className="px-3 py-2 font-bold text-slate-600 whitespace-nowrap">TIN</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right whitespace-nowrap">ລວມມູນຄ່າສິນຄ້າ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right whitespace-nowrap">ສ່ວນຫຼຸດລວມ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right whitespace-nowrap">ມູນຄ່າກ່ອນ ອມພ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right whitespace-nowrap">{vatHeader}</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right whitespace-nowrap">ລວມທັງໝົດ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-center whitespace-nowrap">ສະຖານະ</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                  {loading ? 'ກຳລັງໂຫຼດ...' : 'ບໍ່ມີບິນທີ່ມີ ອມພ ໃນຊ່ວງນີ້'}
                </td></tr>
              ) : lines.map((l, i) => (
                <tr key={l.id} className="border-t border-slate-100 hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-right font-mono text-slate-400">{i + 1}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-600 whitespace-nowrap">{formatDate(l.date)}</td>
                  <td className="px-3 py-1.5 font-mono font-bold text-slate-800 whitespace-nowrap">{l.billNumber}</td>
                  <td className="px-3 py-1.5">{l.customerName}</td>
                  <td className="px-3 py-1.5 font-mono whitespace-nowrap">
                    {l.tin
                      ? <span className="font-bold text-slate-700">{l.tin}</span>
                      : <span className="text-slate-400" title={`ບໍ່ມີ TIN — ຕອນສົ່ງອອກຈະໃຊ້ ${DEFAULT_TIN}`}>{DEFAULT_TIN}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtNum(l.itemsGross)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-amber-700">{l.discount > 0 ? `−${fmtNum(l.discount)}` : '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtNum(l.beforeVat)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-bold text-rose-700">{fmtNum(l.vatAmount)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-extrabold text-slate-900">{fmtNum(l.systemTotal)}</td>
                  <td className="px-3 py-1.5 text-center whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      l.status === STATUS_SENT ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                    }`}>{STATUS_LABEL[l.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold">
                  <td className="px-3 py-2" colSpan={5}>ລວມ {fmtNum(lines.length)} ບິນ</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(totals.itemsGross)}</td>
                  <td className="px-3 py-2 text-right font-mono text-amber-700">−{fmtNum(totals.discount)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(totals.beforeVat)}</td>
                  <td className="px-3 py-2 text-right font-mono text-rose-700">{fmtNum(totals.vatAmount)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(totals.systemTotal)}</td>
                  <td />
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
    amber: 'bg-white border-amber-200',
    rose: 'bg-white border-rose-200',
  }[accent] || 'bg-white border-slate-200';
  const valCls = {
    slate: 'text-slate-900',
    cyan: 'text-cyan-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
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
