'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { useCompanyProfile } from '@/utils/useCompanyProfile';
import { formatDate } from '@/utils/formatDate';
import {
  DEFAULT_TIN, STATUS_FILTERS, STATUS_LABEL, STATUS_SENT, QUICK_RANGES,
  getRange, buildVatInvoiceLines, sumVatInvoiceLines,
} from '@/utils/vatInvoices';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;

export default function VatInvoiceSubmitPage() {
  const company = useCompanyProfile();
  const initial = getRange('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState({ ...initial, status: 'all' });
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (query.from) params.set('from', query.from);
      if (query.to) params.set('to', query.to);
      params.set('status', query.status);
      const res = await fetch(`${API}/admin/vat-invoices?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setData(null);
      setError(`ດຶງຂໍ້ມູນບໍ່ໄດ້: ${e.message}`);
    }
    setLoading(false);
  }, [query]);

  useEffect(() => { load(); }, [load]);

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

  // ຍັງບໍ່ທັນເຊື່ອມຕໍ່ກັບລະບົບພາຍນອກ — ປຸ່ມມີໄວ້ກ່ອນ ພໍ API ພ້ອມຈຶ່ງຕໍ່ໃສ່ບ່ອນນີ້
  const onSubmitBill = (line) => {
    setNotice(`ບິນ ${line.billNumber} — ຍັງບໍ່ທັນເຊື່ອມຕໍ່ກັບລະບົບສົ່ງຂໍ້ມູນອາກອນ`);
    setTimeout(() => setNotice(''), 4000);
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Tax invoice submit"
        title="📤 ສົ່ງຂໍ້ມູນບິນອາກອນ"
        subtitle="ບິນທີ່ມີ ອມພ ທັງໝົດ — ກຽມສົ່ງເຂົ້າລະບົບອາກອນ"
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
        {data?.truncated && (
          <div className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ສະແດງ {fmtNum(data.rows.length)} ບິນ ຈາກ {fmtNum(data.total_bills)} ບິນ — ກະລຸນາແຄບຊ່ວງວັນທີລົງ
          </div>
        )}
        {error && <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
        {notice && <div className="text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">{notice}</div>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="ຈຳນວນບິນ" value={fmtNum(lines.length)} />
        <Kpi label="ຍັງບໍ່ໄດ້ສົ່ງ" value={fmtNum(data?.pending_bills)} accent="amber" />
        <Kpi label="ສົ່ງແລ້ວ" value={fmtNum(data?.sent_bills)} accent="emerald" />
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
                <th className="px-3 py-2 font-bold text-slate-600 text-center whitespace-nowrap">ຈັດການ</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-400">
                  {loading ? 'ກຳລັງໂຫຼດ...' : 'ບໍ່ມີບິນທີ່ມີ ອມພ ໃນຊ່ວງນີ້'}
                </td></tr>
              ) : lines.map(l => (
                <tr key={l.id} className="border-t border-slate-100 hover:bg-red-50/40">
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
                    <StatusBadge status={l.status} />
                  </td>
                  <td className="px-3 py-1.5 text-center whitespace-nowrap">
                    <button onClick={() => onSubmitBill(l)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold transition">
                      ກົດສົ່ງຂໍ້ມູນ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold">
                  <td className="px-3 py-2" colSpan={4}>ລວມ {fmtNum(lines.length)} ບິນ</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(totals.itemsGross)}</td>
                  <td className="px-3 py-2 text-right font-mono text-amber-700">−{fmtNum(totals.discount)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(totals.beforeVat)}</td>
                  <td className="px-3 py-2 text-right font-mono text-rose-700">{fmtNum(totals.vatAmount)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtNum(totals.systemTotal)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const sent = status === STATUS_SENT;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
      sent ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
    }`}>
      {STATUS_LABEL[status]}
    </span>
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
