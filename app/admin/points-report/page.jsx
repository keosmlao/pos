'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { downloadWorkbookMulti } from '@/utils/excelClient';
import { printReportA4 } from '@/utils/reportPrint';
import { todayLocal, fmtLaoDate } from '@/lib/loyaltyWindow';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;
const round = n => Math.round(Number(n) || 0);
const signed = n => (Number(n) > 0 ? `+${fmtNum(n)}` : fmtNum(n));

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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

const TIER_LABEL = { standard: 'ທົ່ວໄປ', silver: '🥈 Silver', gold: '🥇 Gold', platinum: '💎 Platinum' };

export default function PointsReportPage() {
  const initial = getRange('all');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [query, setQuery] = useState(initial);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('members');
  const [data, setData] = useState(null);
  const [company, setCompany] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams();
      if (query.from) p.set('from', query.from);
      if (query.to) p.set('to', query.to);
      const res = await fetch(`${API}/admin/points-report?${p}`);
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
    setQuery({ from, to });
  };
  const applyRange = (r) => { setFrom(r.from); setTo(r.to); setQuery(r); };
  const dirty = from !== query.from || to !== query.to;

  const summary = data?.summary || {};
  const term = search.trim().toLowerCase();
  const members = useMemo(() => {
    const rows = data?.members || [];
    if (!term) return rows;
    return rows.filter(r => [r.name, r.member_code, r.phone].some(v => String(v || '').toLowerCase().includes(term)));
  }, [data, term]);
  const movements = useMemo(() => {
    const rows = data?.movements || [];
    if (!term) return rows;
    return rows.filter(r => [r.member_name, r.member_code, r.ref_no].some(v => String(v || '').toLowerCase().includes(term)));
  }, [data, term]);

  const rangeLabel = query.from || query.to ? `${query.from || 'ເລີ່ມຕົ້ນ'} ຫາ ${query.to || 'ປັດຈຸບັນ'}` : 'ທັງໝົດ (ບໍ່ຈຳກັດຊ່ວງ)';
  const netTotal = (Number(summary.earned) || 0) - (Number(summary.used) || 0)
    - (Number(summary.reverted) || 0) + (Number(summary.restored) || 0);

  const openDetail = async (m) => {
    setDetail({ member: m, loading: true, movements: [] });
    try {
      const p = new URLSearchParams({ member_id: String(m.id) });
      if (query.from) p.set('from', query.from);
      if (query.to) p.set('to', query.to);
      const res = await fetch(`${API}/admin/points-report?${p}`);
      const d = await res.json();
      setDetail({ member: m, loading: false, movements: d.movements || [] });
    } catch {
      setDetail({ member: m, loading: false, movements: [] });
    }
  };

  const exportExcel = async () => {
    const money = { numFmt: '#,##0' };
    await downloadWorkbookMulti({
      fileName: `points_report_${query.from || 'all'}_${query.to || 'all'}.xlsx`,
      sheets: [
        {
          name: 'ສະຫຼຸບ',
          title: `ລາຍງານແຕ້ມສະສົມ · ${rangeLabel}`,
          columns: [{ header: 'ລາຍການ', key: 'k', width: 30 }, { header: 'ມູນຄ່າ', key: 'v', width: 20, ...money }],
          rows: [
            { k: 'ຊ່ວງວັນທີ', v: rangeLabel },
            { k: 'ແຕ້ມທີ່ໄດ້ຮັບ', v: round(summary.earned) },
            { k: 'ແຕ້ມທີ່ໃຊ້ໄປ', v: round(summary.used) },
            { k: 'ຫັກຄືນ (ຄືນສິນຄ້າ)', v: round(summary.reverted) },
            { k: 'ຄືນແຕ້ມທີ່ໃຊ້ (ຄືນສິນຄ້າ)', v: round(summary.restored) },
            { k: 'ເຄື່ອນໄຫວສຸດທິ', v: round(netTotal) },
            { k: 'ຍອດຄົງເຫຼືອລວມ (ປັດຈຸບັນ)', v: round(summary.balance_total) },
            { k: 'ລູກຄ້າທີ່ມີແຕ້ມ', v: round(summary.members_with_points) },
            { k: 'ລູກຄ້າແຕ້ມໝົດອາຍຸແລ້ວ', v: round(summary.members_expired) },
            { k: 'ລູກຄ້າແຕ້ມຈະໝົດໃນ 30 ວັນ', v: round(summary.members_expiring_soon) },
          ],
        },
        {
          name: 'ຕາມລູກຄ້າ',
          title: `ແຕ້ມສະສົມຕາມລູກຄ້າ · ${rangeLabel}`,
          columns: [
            { header: '#', key: 'no', width: 6 },
            { header: 'ລະຫັດ', key: 'code', width: 12 },
            { header: 'ຊື່ລູກຄ້າ', key: 'name', width: 28 },
            { header: 'ເບີໂທ', key: 'phone', width: 14 },
            { header: 'ລະດັບ', key: 'tier', width: 12 },
            { header: 'ບິນ', key: 'orders', width: 8, ...money },
            { header: 'ຍອດຊື້', key: 'spent', width: 16, ...money },
            { header: 'ໄດ້ແຕ້ມ', key: 'earned', width: 12, ...money },
            { header: 'ໃຊ້ແຕ້ມ', key: 'used', width: 12, ...money },
            { header: 'ຫັກຄືນ', key: 'reverted', width: 12, ...money },
            { header: 'ຄືນແຕ້ມ', key: 'restored', width: 12, ...money },
            { header: 'ສຸດທິ', key: 'net', width: 12, ...money },
            { header: 'ຍອດຄົງເຫຼືອ', key: 'balance', width: 14, ...money },
            { header: 'ໝົດອາຍຸ', key: 'exp', width: 14 },
          ],
          rows: members.map((m, i) => ({
            no: i + 1, code: m.member_code || '', name: m.name, phone: m.phone || '',
            tier: TIER_LABEL[m.tier] || m.tier || '', orders: round(m.orders), spent: round(m.spent),
            earned: round(m.earned), used: round(m.used), reverted: round(m.reverted),
            restored: round(m.restored), net: round(m.net), balance: round(m.balance),
            exp: m.points_expires_at || '',
          })),
        },
        {
          name: 'ລາຍການເຄື່ອນໄຫວ',
          title: `ການເຄື່ອນໄຫວແຕ້ມ · ${rangeLabel}`,
          columns: [
            { header: 'ວັນທີ', key: 'date', width: 20 },
            { header: 'ປະເພດ', key: 'kind', width: 14 },
            { header: 'ເລກທີ', key: 'ref', width: 20 },
            { header: 'ລູກຄ້າ', key: 'member', width: 28 },
            { header: 'ມູນຄ່າ', key: 'amount', width: 16, ...money },
            { header: 'ແຕ້ມເຂົ້າ', key: 'in', width: 12, ...money },
            { header: 'ແຕ້ມອອກ', key: 'out', width: 12, ...money },
          ],
          rows: movements.map(mv => ({
            date: String(mv.created_at || '').slice(0, 19).replace('T', ' '),
            kind: mv.kind === 'sale' ? 'ບິນຂາຍ' : 'ຄືນສິນຄ້າ',
            ref: mv.ref_no || `#${mv.ref_id}`,
            member: `${mv.member_code || ''} ${mv.member_name || ''}`.trim(),
            amount: round(mv.amount), in: round(mv.points_in), out: round(mv.points_out),
          })),
        },
      ],
    });
  };

  const exportPdf = () => {
    printReportA4({
      company,
      landscape: true,
      title: 'ລາຍງານແຕ້ມສະສົມລູກຄ້າ',
      subtitle: 'ເຄື່ອນໄຫວສຸດທິ = ໄດ້ແຕ້ມ − ໃຊ້ແຕ້ມ − ຫັກຄືນ + ຄືນແຕ້ມ',
      meta: [
        { label: 'ຊ່ວງວັນທີ', value: rangeLabel },
        { label: 'ລູກຄ້າ', value: `${members.length} ຄົນ` },
        ...(term ? [{ label: 'ຄົ້ນຫາ', value: search.trim() }] : []),
      ],
      kpis: [
        { label: 'ໄດ້ແຕ້ມ', value: fmtNum(summary.earned), accent: 'emerald' },
        { label: 'ໃຊ້ແຕ້ມ', value: fmtNum(summary.used), accent: 'amber' },
        { label: 'ຫັກຄືນ', value: fmtNum(summary.reverted), accent: 'rose' },
        { label: 'ເຄື່ອນໄຫວສຸດທິ', value: signed(netTotal), accent: 'cyan' },
        { label: 'ຍອດຄົງເຫຼືອລວມ', value: fmtNum(summary.balance_total) },
      ],
      tables: [{
        title: `ແຕ້ມສະສົມຕາມລູກຄ້າ (${members.length})`,
        columns: [
          { header: '#', align: 'right', width: '4%' },
          { header: 'ລະຫັດ', align: 'left', width: '9%' },
          { header: 'ຊື່ລູກຄ້າ', align: 'left' },
          { header: 'ບິນ', align: 'right', width: '6%' },
          { header: 'ຍອດຊື້', align: 'right', width: '13%' },
          { header: 'ໄດ້ແຕ້ມ', align: 'right', width: '9%' },
          { header: 'ໃຊ້ແຕ້ມ', align: 'right', width: '9%' },
          { header: 'ຫັກຄືນ', align: 'right', width: '8%' },
          { header: 'ສຸດທິ', align: 'right', width: '8%' },
          { header: 'ຄົງເຫຼືອ', align: 'right', width: '9%' },
          { header: 'ໝົດອາຍຸ', align: 'right', width: '10%' },
        ],
        rows: members.map((m, i) => [
          String(i + 1), m.member_code || '—', m.name || '—', fmtNum(m.orders), fmtPrice(m.spent),
          fmtNum(m.earned), fmtNum(m.used), fmtNum(m.reverted), signed(m.net), fmtNum(m.balance),
          m.points_expires_at ? fmtLaoDate(m.points_expires_at) : '—',
        ]),
        totals: members.length ? [
          '', '', 'ລວມທັງໝົດ',
          fmtNum(members.reduce((s, m) => s + (Number(m.orders) || 0), 0)),
          fmtPrice(members.reduce((s, m) => s + (Number(m.spent) || 0), 0)),
          fmtNum(members.reduce((s, m) => s + (Number(m.earned) || 0), 0)),
          fmtNum(members.reduce((s, m) => s + (Number(m.used) || 0), 0)),
          fmtNum(members.reduce((s, m) => s + (Number(m.reverted) || 0), 0)),
          signed(members.reduce((s, m) => s + (Number(m.net) || 0), 0)),
          fmtNum(members.reduce((s, m) => s + (Number(m.balance) || 0), 0)),
          '',
        ] : null,
      }],
    });
  };

  const hasRows = members.length > 0;

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Loyalty Points"
        title="⭐ ລາຍງານແຕ້ມສະສົມລູກຄ້າ"
        subtitle="ການເຄື່ອນໄຫວແຕ້ມ ແລະ ຍອດຄົງເຫຼືອຂອງແຕ່ລະລູກຄ້າ"
      />

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
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_RANGES.map(r => (
              <button key={r.key} onClick={() => applyRange(getRange(r.key))}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition">{r.label}</button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ຄົ້ນຫາ ຊື່ / ລະຫັດ / ເບີໂທ ລູກຄ້າ..."
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm min-w-[240px] flex-1" />
        </div>
        <div className="text-xs text-slate-500">
          ກຳລັງສະແດງ: <b className="text-slate-800">{rangeLabel}</b>
          {dirty && <span className="ml-2 text-red-600 font-bold">· ວັນທີປ່ຽນແລ້ວ ກົດ “ຄົ້ນຫາ”</span>}
        </div>
        {error && <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="ໄດ້ແຕ້ມ" value={fmtNum(summary.earned)} accent="emerald" />
        <Kpi label="ໃຊ້ແຕ້ມ" value={fmtNum(summary.used)} accent="amber" />
        <Kpi label="ຫັກຄືນ (ຄືນສິນຄ້າ)" value={fmtNum(summary.reverted)} accent="rose" sub={`ຄືນແຕ້ມ ${fmtNum(summary.restored)}`} />
        <Kpi label="ເຄື່ອນໄຫວສຸດທິ" value={signed(netTotal)} accent="cyan" />
        <Kpi label="ຍອດຄົງເຫຼືອລວມ" value={fmtNum(summary.balance_total)} highlight
          sub={`${fmtNum(summary.members_with_points)} ຄົນມີແຕ້ມ`} />
      </div>

      {(Number(summary.members_expired) > 0 || Number(summary.members_expiring_soon) > 0) && (
        <div className="flex flex-wrap gap-3 text-xs">
          {Number(summary.members_expired) > 0 && (
            <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-bold">
              ⚠ {fmtNum(summary.members_expired)} ຄົນ ແຕ້ມໝົດອາຍຸແລ້ວ (ຍັງເຫັນຕົວເລກ ແຕ່ໃຊ້ບໍ່ໄດ້)
            </div>
          )}
          {Number(summary.members_expiring_soon) > 0 && (
            <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-bold">
              ⏰ {fmtNum(summary.members_expiring_soon)} ຄົນ ແຕ້ມຈະໝົດອາຍຸໃນ 30 ວັນ
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          {[
            { key: 'members', label: `ຕາມລູກຄ້າ (${members.length})` },
            { key: 'movements', label: `ລາຍການເຄື່ອນໄຫວ (${movements.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-bold transition ${tab === t.key ? 'border-b-2 border-red-600 text-red-600' : 'text-slate-600 hover:text-slate-900'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto max-h-[620px]">
          {tab === 'members' ? (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-bold text-slate-600">ລູກຄ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ບິນ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຍອດຊື້</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ໄດ້ແຕ້ມ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ໃຊ້ແຕ້ມ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຫັກຄືນ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ສຸດທິ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ຄົງເຫຼືອ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ໝົດອາຍຸ</th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">{loading ? 'ກຳລັງໂຫຼດ...' : 'ບໍ່ມີຂໍ້ມູນ'}</td></tr>
                ) : members.map((m) => {
                  const expired = m.points_expires_at && m.points_expires_at < todayLocal();
                  return (
                    <tr key={m.id} onClick={() => openDetail(m)}
                      className="border-t border-slate-100 hover:bg-red-50/40 cursor-pointer">
                      <td className="px-3 py-1.5">
                        <div className="font-bold text-slate-900">{m.name}</div>
                        <div className="text-[10px] text-slate-500">{m.member_code} {m.phone ? `· ${m.phone}` : ''} · {TIER_LABEL[m.tier] || m.tier}</div>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtNum(m.orders)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtPrice(m.spent)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-emerald-700 font-bold">{fmtNum(m.earned)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-amber-700">{fmtNum(m.used)}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-rose-700">{Number(m.reverted) > 0 ? `−${fmtNum(m.reverted)}` : '0'}</td>
                      <td className={`px-3 py-1.5 text-right font-mono font-extrabold ${Number(m.net) >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>{signed(m.net)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-extrabold text-cyan-700">{fmtNum(m.balance)}</td>
                      <td className={`px-3 py-1.5 text-right font-mono ${expired ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                        {m.points_expires_at ? fmtLaoDate(m.points_expires_at) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {members.length > 0 && (
                <tfoot className="sticky bottom-0">
                  <tr className="bg-slate-100 border-t-2 border-slate-300 font-extrabold">
                    <td className="px-3 py-2">ລວມ {members.length} ຄົນ</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtNum(members.reduce((s, m) => s + (Number(m.orders) || 0), 0))}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtPrice(members.reduce((s, m) => s + (Number(m.spent) || 0), 0))}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-700">{fmtNum(members.reduce((s, m) => s + (Number(m.earned) || 0), 0))}</td>
                    <td className="px-3 py-2 text-right font-mono text-amber-700">{fmtNum(members.reduce((s, m) => s + (Number(m.used) || 0), 0))}</td>
                    <td className="px-3 py-2 text-right font-mono text-rose-700">{fmtNum(members.reduce((s, m) => s + (Number(m.reverted) || 0), 0))}</td>
                    <td className="px-3 py-2 text-right font-mono">{signed(members.reduce((s, m) => s + (Number(m.net) || 0), 0))}</td>
                    <td className="px-3 py-2 text-right font-mono text-cyan-700">{fmtNum(members.reduce((s, m) => s + (Number(m.balance) || 0), 0))}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-bold text-slate-600">ວັນທີ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ປະເພດ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ເລກທີ</th>
                  <th className="px-3 py-2 font-bold text-slate-600">ລູກຄ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ມູນຄ່າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ແຕ້ມເຂົ້າ</th>
                  <th className="px-3 py-2 font-bold text-slate-600 text-right">ແຕ້ມອອກ</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">{loading ? 'ກຳລັງໂຫຼດ...' : 'ບໍ່ມີການເຄື່ອນໄຫວ'}</td></tr>
                ) : movements.map((mv, i) => (
                  <tr key={`${mv.kind}-${mv.ref_id}-${i}`} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-1.5 font-mono text-slate-600">{String(mv.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                    <td className="px-3 py-1.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${mv.kind === 'sale' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {mv.kind === 'sale' ? 'ບິນຂາຍ' : 'ຄືນສິນຄ້າ'}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono">{mv.ref_no || `#${mv.ref_id}`}</td>
                    <td className="px-3 py-1.5">{mv.member_name} <span className="text-[10px] text-slate-500">{mv.member_code}</span></td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmtPrice(mv.amount)}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-emerald-700 font-bold">{Number(mv.points_in) > 0 ? `+${fmtNum(mv.points_in)}` : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-rose-700 font-bold">{Number(mv.points_out) > 0 ? `−${fmtNum(mv.points_out)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="font-extrabold text-slate-900">{detail.member.name}</div>
                <div className="text-xs text-slate-500">
                  {detail.member.member_code} {detail.member.phone ? `· ${detail.member.phone}` : ''} · {TIER_LABEL[detail.member.tier] || detail.member.tier}
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
            </div>
            <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-100 text-center">
              <MiniStat label="ໄດ້ແຕ້ມ" value={fmtNum(detail.member.earned)} cls="text-emerald-700" />
              <MiniStat label="ໃຊ້ແຕ້ມ" value={fmtNum(detail.member.used)} cls="text-amber-700" />
              <MiniStat label="ຫັກຄືນ" value={fmtNum(detail.member.reverted)} cls="text-rose-700" />
              <MiniStat label="ຄົງເຫຼືອ" value={fmtNum(detail.member.balance)} cls="text-cyan-700" />
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-bold text-slate-600">ວັນທີ</th>
                    <th className="px-3 py-2 font-bold text-slate-600">ປະເພດ</th>
                    <th className="px-3 py-2 font-bold text-slate-600">ເລກທີ</th>
                    <th className="px-3 py-2 font-bold text-slate-600 text-right">ແຕ້ມເຂົ້າ</th>
                    <th className="px-3 py-2 font-bold text-slate-600 text-right">ແຕ້ມອອກ</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.loading ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
                  ) : detail.movements.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">ບໍ່ມີການເຄື່ອນໄຫວໃນຊ່ວງນີ້</td></tr>
                  ) : detail.movements.map((mv, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-mono text-slate-600">{String(mv.created_at || '').slice(0, 16).replace('T', ' ')}</td>
                      <td className="px-3 py-1.5">{mv.kind === 'sale' ? 'ບິນຂາຍ' : 'ຄືນສິນຄ້າ'}</td>
                      <td className="px-3 py-1.5 font-mono">{mv.ref_no || `#${mv.ref_id}`}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-emerald-700">{Number(mv.points_in) > 0 ? `+${fmtNum(mv.points_in)}` : '—'}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-rose-700">{Number(mv.points_out) > 0 ? `−${fmtNum(mv.points_out)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
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
      {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

function MiniStat({ label, value, cls }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-lg font-extrabold ${cls}`}>{value}</div>
    </div>
  );
}
