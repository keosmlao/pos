'use client';

// ໜ້າຈໍລາຍງານໜີ້ຄ້າງ — ໃຊ້ຮ່ວມກັນ 2 ລາຍງານ (ຜູ້ສະໜອງ / ລູກຄ້າ)
// ໂຄງສ້າງຂໍ້ມູນຈາກ API ຄືກັນ ({ summary, parties, rows }) ຈຶ່ງໃຊ້ component ດຽວໄດ້

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { downloadWorkbookMulti } from '@/utils/excelClient';
import { printReportA4 } from '@/utils/reportPrint';

const API = '/api';
const num = n => Number(n) || 0;
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(num(n)));
const fmtPrice = n => `${fmtNum(n)} ₭`;

const fmtDate = (v) => {
  const s = String(v || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '—';
  const [y, m, d] = s.split('-');
  return `${d}-${m}-${y}`;
};

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const QUICK_RANGES = [
  { key: 'all', label: 'ທັງໝົດ' },
  { key: 'month', label: 'ເດືອນນີ້' },
  { key: 'last_month', label: 'ເດືອນແລ້ວ' },
  { key: 'quarter', label: 'ໄຕມາດນີ້' },
  { key: 'ytd', label: 'ປີນີ້' },
];

function getRange(key) {
  const t = new Date();
  if (key === 'month') return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) };
  if (key === 'last_month') return { from: iso(new Date(t.getFullYear(), t.getMonth() - 1, 1)), to: iso(new Date(t.getFullYear(), t.getMonth(), 0)) };
  if (key === 'quarter') { const q = Math.floor(t.getMonth() / 3); return { from: iso(new Date(t.getFullYear(), q * 3, 1)), to: iso(t) }; }
  if (key === 'ytd') return { from: iso(new Date(t.getFullYear(), 0, 1)), to: iso(t) };
  return { from: '', to: '' };
}

// ເລືອກເປັນເດືອນ (YYYY-MM) → ວັນທຳອິດ ຫາ ວັນສຸດທ້າຍຂອງເດືອນນັ້ນ
function monthToRange(ym) {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!y || !m) return null;
  return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
}

const SORTS = [
  { key: 'amount_desc', label: 'ຍອດຄ້າງ: ຫຼາຍ → ນ້ອຍ' },
  { key: 'amount_asc', label: 'ຍອດຄ້າງ: ນ້ອຍ → ຫຼາຍ' },
];

export default function DebtReport({
  endpoint, tag, title, subtitle,
  partyLabel, refLabel, paidLabel, remainingLabel, fileBase,
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [month, setMonth] = useState('');
  const [party, setParty] = useState('');
  const [sort, setSort] = useState('amount_desc');
  const [query, setQuery] = useState({ from: '', to: '' });
  const [search, setSearch] = useState('');
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
      if (party) p.set('party', party);
      p.set('sort', sort);
      const res = await fetch(`${API}${endpoint}?${p}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setData(null);
      setError(`ດຶງຂໍ້ມູນບໍ່ໄດ້: ${e.message}`);
    }
    setLoading(false);
  }, [endpoint, query, party, sort]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch(`${API}/company`).then(r => r.json()).then(setCompany).catch(() => {}); }, []);

  const runSearch = () => {
    if (from && to && from > to) { setError('ວັນທີເລີ່ມຕ້ອງບໍ່ຫຼັງວັນທີສິ້ນສຸດ'); return; }
    setQuery({ from, to });
  };
  const applyRange = (r) => { setFrom(r.from); setTo(r.to); setMonth(''); setQuery(r); };
  const applyMonth = (ym) => {
    setMonth(ym);
    const r = monthToRange(ym);
    if (r) { setFrom(r.from); setTo(r.to); setQuery(r); }
  };
  const dirty = from !== query.from || to !== query.to;

  const summary = data?.summary || {};
  const parties = data?.parties || [];
  const term = search.trim().toLowerCase();
  const rows = useMemo(() => {
    const all = data?.rows || [];
    if (!term) return all;
    return all.filter(r => [r.ref, r.party_name, r.party_sub].some(v => String(v || '').toLowerCase().includes(term)));
  }, [data, term]);

  const shown = useMemo(() => ({
    bills: rows.length,
    total: rows.reduce((s, r) => s + num(r.total), 0),
    paid: rows.reduce((s, r) => s + num(r.paid), 0),
    remaining: rows.reduce((s, r) => s + num(r.remaining), 0),
  }), [rows]);

  const rangeLabel = query.from || query.to
    ? `${query.from || 'ເລີ່ມຕົ້ນ'} ຫາ ${query.to || 'ປັດຈຸບັນ'}`
    : 'ທັງໝົດ (ບໍ່ຈຳກັດຊ່ວງ)';
  const partyName = party ? (parties.find(p => p.key === party)?.name || party) : `ທຸກ${partyLabel}`;
  const sortLabel = SORTS.find(s => s.key === sort)?.label || '';
  const hasRows = rows.length > 0;

  const exportExcel = async () => {
    const money = { numFmt: '#,##0' };
    await downloadWorkbookMulti({
      fileName: `${fileBase}_${query.from || 'all'}_${query.to || 'all'}.xlsx`,
      sheets: [
        {
          name: 'ສະຫຼຸບ',
          title: `${title} · ${rangeLabel}`,
          columns: [
            { header: partyLabel, key: 'name', width: 34 },
            { header: 'ຈຳນວນບິນ', key: 'bills', width: 12 },
            { header: remainingLabel, key: 'remaining', width: 18, ...money },
          ],
          rows: parties.map(p => ({ name: p.name, bills: p.bills, remaining: Math.round(num(p.remaining)) })),
        },
        {
          name: 'ລາຍລະອຽດ',
          title: `${title} · ${partyName} · ${rangeLabel}`,
          columns: [
            { header: '#', key: 'no', width: 6 },
            { header: refLabel, key: 'ref', width: 20 },
            { header: partyLabel, key: 'party', width: 30 },
            { header: 'ວັນທີບິນ', key: 'doc', width: 14 },
            { header: 'ຄົບກຳນົດ', key: 'due', width: 14 },
            { header: 'ເກີນກຳນົດ (ວັນ)', key: 'over', width: 15 },
            { header: 'ຍອດບິນ', key: 'total', width: 18, ...money },
            { header: paidLabel, key: 'paid', width: 18, ...money },
            { header: remainingLabel, key: 'remaining', width: 18, ...money },
          ],
          rows: rows.map((r, i) => ({
            no: i + 1, ref: r.ref, party: r.party_name,
            doc: fmtDate(r.doc_date), due: fmtDate(r.due_date),
            over: num(r.days_overdue) > 0 ? num(r.days_overdue) : '',
            total: Math.round(num(r.total)), paid: Math.round(num(r.paid)),
            remaining: Math.round(num(r.remaining)),
          })),
        },
      ],
    });
  };

  const exportPdf = () => {
    printReportA4({
      company,
      landscape: true,
      title,
      subtitle: `${subtitle} · ຈັດລຽງ: ${sortLabel}`,
      meta: [
        { label: 'ຊ່ວງວັນທີ', value: rangeLabel },
        { label: partyLabel, value: partyName },
        ...(term ? [{ label: 'ຄົ້ນຫາ', value: search.trim() }] : []),
      ],
      kpis: [
        { label: 'ບິນຄ້າງ', value: fmtNum(shown.bills) },
        { label: `ຈຳນວນ${partyLabel}`, value: fmtNum(summary.parties) },
        { label: 'ຍອດບິນລວມ', value: fmtPrice(shown.total) },
        { label: paidLabel, value: fmtPrice(shown.paid), accent: 'emerald' },
        { label: remainingLabel, value: fmtPrice(shown.remaining), accent: 'rose' },
      ],
      tables: [{
        title: `ລາຍລະອຽດ (${rows.length} ບິນ)`,
        columns: [
          { header: '#', align: 'right', width: '4%' },
          { header: refLabel, align: 'left', width: '13%' },
          { header: partyLabel, align: 'left' },
          { header: 'ວັນທີບິນ', align: 'right', width: '10%' },
          { header: 'ຄົບກຳນົດ', align: 'right', width: '10%' },
          { header: 'ເກີນ (ວັນ)', align: 'right', width: '8%' },
          { header: 'ຍອດບິນ', align: 'right', width: '13%' },
          { header: paidLabel, align: 'right', width: '13%' },
          { header: remainingLabel, align: 'right', width: '13%' },
        ],
        rows: rows.map((r, i) => [
          String(i + 1), r.ref, r.party_name, fmtDate(r.doc_date), fmtDate(r.due_date),
          num(r.days_overdue) > 0 ? fmtNum(r.days_overdue) : '—',
          fmtPrice(r.total), fmtPrice(r.paid), fmtPrice(r.remaining),
        ]),
        totals: hasRows
          ? ['', '', `ລວມ ${rows.length} ບິນ`, '', '', '', fmtPrice(shown.total), fmtPrice(shown.paid), fmtPrice(shown.remaining)]
          : null,
      }],
    });
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminHero tag={tag} title={title} subtitle={subtitle} />

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ຈາກວັນທີ</label>
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setMonth(''); }}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ຫາວັນທີ</label>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setMonth(''); }}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ຫຼືເລືອກເປັນເດືອນ</label>
            <input type="month" value={month} onChange={e => applyMonth(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <button onClick={runSearch} disabled={loading}
            className={`px-5 py-2 rounded-lg text-sm font-bold text-white transition disabled:opacity-50 ${dirty ? 'bg-red-600 hover:bg-red-700 ring-2 ring-red-200' : 'bg-slate-700 hover:bg-slate-800'}`}>
            {loading ? 'ກຳລັງຄົ້ນຫາ...' : '🔍 ຄົ້ນຫາ'}
          </button>
          <div className="flex-1" />
          <div className="flex gap-2">
            <button onClick={exportExcel} disabled={!hasRows || loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition disabled:opacity-40">⬇ Excel</button>
            <button onClick={exportPdf} disabled={!hasRows || loading}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold transition disabled:opacity-40">🖨 PDF</button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_RANGES.map(r => (
              <button key={r.key} onClick={() => applyRange(getRange(r.key))}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition">{r.label}</button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">{partyLabel}</label>
            <select value={party} onChange={e => setParty(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[220px] max-w-[320px]">
              <option value="">ທຸກ{partyLabel} ({parties.length})</option>
              {parties.map(p => (
                <option key={p.key} value={p.key}>{p.name} — {fmtPrice(p.remaining)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">ຈັດລຽງ</label>
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
              {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`ຄົ້ນຫາ ເລກທີບິນ / ຊື່${partyLabel}...`}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[220px] flex-1" />
        </div>

        <div className="text-xs text-slate-500">
          ກຳລັງສະແດງ: <b className="text-slate-800">{rangeLabel}</b> · <b className="text-slate-800">{partyName}</b>
          {dirty && <span className="ml-2 text-red-600 font-bold">· ວັນທີປ່ຽນແລ້ວ ກົດ “ຄົ້ນຫາ”</span>}
        </div>
        {error && <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="ບິນຄ້າງ" value={fmtNum(shown.bills)} sub={`${partyLabel} ${fmtNum(summary.parties)}`} />
        <Kpi label="ຍອດບິນລວມ" value={fmtPrice(shown.total)} />
        <Kpi label={paidLabel} value={fmtPrice(shown.paid)} accent="emerald" />
        <Kpi label={remainingLabel} value={fmtPrice(shown.remaining)} accent="rose" highlight />
        <Kpi label="ເກີນກຳນົດຊຳລະ" value={fmtPrice(summary.overdue_remaining)} accent="amber"
          sub={`${fmtNum(summary.overdue_bills)} ບິນ`} />
      </div>

      {parties.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 text-xs font-extrabold uppercase tracking-wider text-slate-500">
            ສະຫຼຸບຕາມ{partyLabel} ({parties.length}) · ກົດເພື່ອຄັດ
          </div>
          <div className="flex flex-wrap gap-2 p-3">
            {parties.map(p => (
              <button key={p.key} onClick={() => setParty(party === p.key ? '' : p.key)}
                className={`rounded-lg border px-3 py-2 text-left transition ${party === p.key ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className="text-xs font-bold text-slate-800 max-w-[240px] truncate">{p.name}</div>
                <div className="text-[11px] text-slate-500">{fmtNum(p.bills)} ບິນ · <b className="text-rose-700">{fmtPrice(p.remaining)}</b></div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold text-slate-600 text-right">#</th>
                <th className="px-3 py-2 font-bold text-slate-600">{refLabel}</th>
                <th className="px-3 py-2 font-bold text-slate-600">{partyLabel}</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ວັນທີບິນ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ຄົບກຳນົດ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ຍອດບິນ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">{paidLabel}</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">{remainingLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">{loading ? 'ກຳລັງໂຫຼດ...' : 'ບໍ່ມີໜີ້ຄ້າງໃນເງື່ອນໄຂນີ້'}</td></tr>
              ) : rows.map((r, i) => {
                const over = num(r.days_overdue);
                return (
                  <tr key={r.id} className={`border-t border-slate-100 ${over > 0 ? 'bg-amber-50/50' : ''} hover:bg-red-50/40`}>
                    <td className="px-3 py-1.5 text-right text-slate-400 font-mono">{i + 1}</td>
                    <td className="px-3 py-1.5 font-bold text-slate-900">{r.ref}</td>
                    <td className="px-3 py-1.5">
                      <div className="font-bold text-slate-800">{r.party_name}</div>
                      {r.party_sub && <div className="text-[10px] text-slate-500">{r.party_sub}</div>}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{fmtDate(r.doc_date)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      <span className={over > 0 ? 'text-amber-700 font-bold' : 'text-slate-600'}>{fmtDate(r.due_date)}</span>
                      {over > 0 && <div className="text-[10px] font-bold text-amber-700">ເກີນ {fmtNum(over)} ວັນ</div>}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmtPrice(r.total)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-emerald-700">{fmtPrice(r.paid)}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-extrabold text-rose-700">{fmtPrice(r.remaining)}</td>
                  </tr>
                );
              })}
            </tbody>
            {hasRows && (
              <tfoot className="sticky bottom-0">
                <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold">
                  <td className="px-3 py-2" colSpan={5}>ລວມ {rows.length} ບິນ</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtPrice(shown.total)}</td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-700">{fmtPrice(shown.paid)}</td>
                  <td className="px-3 py-2 text-right font-mono text-rose-700">{fmtPrice(shown.remaining)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent = 'slate', highlight, sub }) {
  const valCls = {
    slate: 'text-slate-900', emerald: 'text-emerald-700',
    rose: 'text-rose-700', amber: 'text-amber-700',
  }[accent];
  return (
    <div className={`rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm ${highlight ? 'ring-2 ring-rose-100' : ''}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${valCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}
