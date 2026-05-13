'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtNum = (n) => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = (n) => `${fmtNum(n)} ₭`;
const fmtDate = (str) => (str ? new Date(str).toLocaleDateString('lo-LA') : '—');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const methodLabel = {
  cash: 'ເງິນສົດ',
  transfer: 'ໂອນ',
  qr: 'QR',
  cheque: 'ເຊັກ',
};

const COLORS = {
  emerald: {
    header: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    badge: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    amount: 'text-emerald-700',
    accent: 'bg-emerald-50 border-emerald-100',
    kpi: 'border-emerald-100 bg-emerald-50 text-emerald-800',
  },
  red: {
    header: 'border-red-200 bg-red-50 text-red-900',
    badge: 'border-red-200 bg-red-100 text-red-700',
    amount: 'text-red-700',
    accent: 'bg-red-50 border-red-100',
    kpi: 'border-red-100 bg-red-50 text-red-800',
  },
};

export default function DebtPaymentsView({ debtType, title, subtitle, icon, nameLabel, color = 'emerald' }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const load = () => {
    setLoading(true);
    fetch(`${API}/admin/debt-payments`)
      .then((r) => r.json())
      .then((data) => {
        const rows = Array.isArray(data) ? data : [];
        setPayments(rows.filter((p) => p.debt_type === debtType));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debtType]);

  const handleDelete = async (p) => {
    const label = `${p.payment_number || `#${p.id}`} (${fmtPrice(p.amount)})`;
    if (!confirm(`ລົບລາຍການຊຳລະ ${label}?\nຍອດໜີ້ຄ້າງຊຳລະຂອງ ${p.party_name || 'ບິນນີ້'} ຈະຖືກປັບເພີ່ມຄືນ.`)) return;
    const endpoint = debtType === 'customer'
      ? `${API}/admin/customer-debts/payments/${p.id}`
      : `${API}/admin/debts/payments/${p.id}`;
    setDeletingId(p.id);
    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || 'ລົບບໍ່ສຳເລັດ', 'error');
        return;
      }
      showToast('ລົບລາຍການຊຳລະສຳເລັດ');
      load();
    } catch {
      showToast('ລົບບໍ່ສຳເລັດ', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const openPrintWindow = (title, bodyHtml) => {
    const win = window.open('', '_blank', 'width=760,height=900');
    if (!win) { showToast('ບໍ່ສາມາດເປີດປ່ອງພິມໄດ້', 'error'); return; }
    win.document.open();
    win.document.write(`<!doctype html>
      <html><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>
        @page { size: A5 portrait; margin: 10mm }
        * { box-sizing: border-box; font-family: 'Noto Sans Lao','Phetsarath OT',system-ui,sans-serif; }
        body { margin: 0; color: #111827; font-size: 12px; line-height: 1.45; }
        .top { border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 14px; }
        h1 { margin: 0; font-size: 20px; color: #047857; font-weight: 900; }
        .meta { color: #64748b; font-size: 11px; margin-top: 3px; }
        .box { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 12px; }
        .row { display: flex; justify-content: space-between; gap: 16px; padding: 8px 10px; border-bottom: 1px dashed #e5e7eb; }
        .row:last-child { border-bottom: 0; }
        .label { color: #64748b; font-weight: 800; }
        .value { font-weight: 800; text-align: right; }
        .money { font-family: ui-monospace,SFMono-Regular,Menlo,monospace; font-variant-numeric: tabular-nums; }
        .grand { background: #ecfdf5; color: #047857; font-size: 16px; }
        .note { padding: 9px 10px; border: 1px dashed #94a3b8; border-radius: 8px; color: #334155; margin-top: 12px; }
        .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 38px; text-align: center; color: #64748b; }
        .line { height: 30px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px; }
      </style></head><body>
        ${bodyHtml}
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 400); }</script>
      </body></html>`);
    win.document.close();
  };

  const printPaymentReceipt = (p) => {
    openPrintWindow(`ໃບຮັບຊຳລະ ${p.payment_number || p.id}`, `
      <div class="top">
        <h1>${debtType === 'customer' ? 'ໃບຮັບຊຳລະໜີ້' : 'ໃບຊຳລະໜີ້'}</h1>
        <div class="meta">ເລກຊຳລະ ${esc(p.payment_number || `#${p.id}`)} · ອ້າງອີງ ${esc(p.ref_number || `#${p.ref_id}`)}</div>
        <div class="meta">ພິມວັນທີ ${new Date().toLocaleString('lo-LA')}</div>
      </div>
      <div class="box">
        <div class="row"><span class="label">${esc(nameLabel)}</span><span class="value">${esc(p.party_name || '—')}</span></div>
        <div class="row"><span class="label">ວັນທີຊຳລະ</span><span class="value">${fmtDate(p.payment_date || p.created_at)}</span></div>
        <div class="row"><span class="label">ວິທີຊຳລະ</span><span class="value">${esc(methodLabel[p.payment_method] || p.payment_method || '—')}</span></div>
        <div class="row grand"><span class="label">ຈຳນວນເງິນ</span><span class="value money">${fmtPrice(p.amount)}</span></div>
      </div>
      ${p.note ? `<div class="note"><b>ໝາຍເຫດ:</b> ${esc(p.note)}</div>` : ''}
      <div class="sign"><div><div class="line"></div>${debtType === 'customer' ? 'ຜູ້ຊຳລະ' : 'ຜູ້ຮັບເງິນ'}</div><div><div class="line"></div>${debtType === 'customer' ? 'ຜູ້ຮັບເງິນ' : 'ຜູ້ຈ່າຍເງິນ'}</div></div>
    `);
  };

  const c = COLORS[color];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (method && p.payment_method !== method) return false;
      if (!q) return true;
      return [p.payment_number, p.ref_number, p.party_name, p.payment_method, p.note, String(p.ref_id || '')]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [payments, search, method]);

  const stats = useMemo(() => {
    const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const filteredTotal = filtered.reduce((s, p) => s + Number(p.amount || 0), 0);
    const today = new Date();
    const isSameDay = (d) => {
      if (!d) return false;
      const dt = new Date(d);
      return dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth() && dt.getDate() === today.getDate();
    };
    const todayRows = payments.filter((p) => isSameDay(p.payment_date || p.created_at));
    return {
      count: payments.length,
      total,
      filteredTotal,
      todayCount: todayRows.length,
      todayTotal: todayRows.reduce((s, p) => s + Number(p.amount || 0), 0),
    };
  }, [payments, filtered]);

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Debt payments"
        title={`${icon} ${title}`}
        subtitle={subtitle}
        action={
          <button onClick={() => location.reload()}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/20">
            ↻ ໂຫຼດໃໝ່
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Kpi label="ມື້ນີ້" value={fmtNum(stats.todayCount)} sub={fmtPrice(stats.todayTotal)} tone={color} />
        <Kpi label="ທັງໝົດ" value={fmtNum(stats.count)} sub={fmtPrice(stats.total)} />
        <Kpi label="ກຳລັງສະແດງ" value={fmtNum(filtered.length)} sub={fmtPrice(stats.filteredTotal)} tone="amber" />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">ທຸກວິທີ</option>
            {Object.entries(methodLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`ຄົ້ນຫາ ເລກຊຳລະ, ເລກບິນ, ຊື່${nameLabel}...`}
            className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-400"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead className={`text-[11px] font-bold uppercase tracking-wide ${c.header}`}>
              <tr>
                <th className="px-3 py-2">ວັນທີ</th>
                <th className="px-3 py-2">ເລກຊຳລະ</th>
                <th className="px-3 py-2">{nameLabel}</th>
                <th className="px-3 py-2">ອ້າງອີງ</th>
                <th className="px-3 py-2">ວິທີ</th>
                <th className="px-3 py-2 text-right">ຈຳນວນ</th>
                <th className="px-3 py-2">ໝາຍເຫດ</th>
                <th className="w-20 px-2 py-2 text-center">ຈັດການ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="8" className="px-3 py-10 text-center text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="8" className="px-3 py-10 text-center text-slate-400">ບໍ່ມີລາຍການ</td></tr>
              ) : (
                filtered.map((p) => (
                  <tr key={`${p.debt_type}-${p.id}`} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(p.payment_date || p.created_at)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-bold text-slate-800">{p.payment_number || '—'}</td>
                    <td className="px-3 py-2 font-bold text-slate-800">{p.party_name || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{p.ref_number || `#${p.ref_id}`}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{methodLabel[p.payment_method] || p.payment_method || '—'}</td>
                    <td className={`whitespace-nowrap px-3 py-2 text-right font-mono font-extrabold ${c.amount}`}>{fmtPrice(p.amount)}</td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-slate-500">{p.note || '—'}</td>
                    <td className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => printPaymentReceipt(p)}
                        title="ພິມໃບຮັບຊຳລະ"
                        className="mr-1 rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        disabled={deletingId === p.id}
                        title="ລົບລາຍການຊຳລະ"
                        className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                      >
                        {deletingId === p.id ? (
                          <span className="text-[10px] font-bold">...</span>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                          </svg>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-slate-50">
                <tr>
                  <td colSpan="5" className="px-3 py-2 text-right text-xs font-bold text-slate-500">ລວມທີ່ສະແດງ</td>
                  <td className={`px-3 py-2 text-right font-mono font-extrabold ${c.amount}`}>{fmtPrice(stats.filteredTotal)}</td>
                  <td colSpan="2"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {toast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-lg px-4 py-2 text-sm font-bold shadow-lg ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    red: COLORS.red.kpi,
    emerald: COLORS.emerald.kpi,
    amber: 'border-amber-100 bg-amber-50 text-amber-800',
  };
  return (
    <div className={`rounded-xl border p-3 ${tones[tone]}`}>
      <div className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">{label}</div>
      <div className="mt-1 text-xl font-extrabold">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold opacity-70">{sub}</div>
    </div>
  );
}
