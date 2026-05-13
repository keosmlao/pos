'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;
const fmtDate = s => s ? new Date(s).toLocaleDateString('lo-LA') : '—';
const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[ch]));

const STATUS_META = {
  draft: { label: 'ສະບັບຮ່າງ', tone: 'slate', icon: '📝' },
  sent: { label: 'ສົ່ງແລ້ວ', tone: 'blue', icon: '📤' },
  accepted: { label: 'ຍອມຮັບ', tone: 'emerald', icon: '✓' },
  rejected: { label: 'ປະຕິເສດ', tone: 'rose', icon: '✕' },
  expired: { label: 'ໝົດອາຍຸ', tone: 'amber', icon: '⏱' },
  converted: { label: 'ອອກບິນແລ້ວ', tone: 'violet', icon: '🧾' },
};

const TONES = {
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
  blue: 'border-blue-200 bg-blue-50 text-red-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
};

export default function QuotationsPage() {
  const [rows, setRows] = useState([]);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (search.trim()) params.set('q', search.trim());
      const res = await fetch(`${API}/admin/quotations?${params}`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  useEffect(() => {
    fetch(`${API}/admin/company`).then(r => r.json()).then(setCompany).catch(() => setCompany(null));
  }, []);

  const stats = useMemo(() => {
    const sum = arr => arr.reduce((s, r) => s + Number(r.total || 0), 0);
    return {
      total: rows.length,
      draft: rows.filter(r => r.status === 'draft').length,
      sent: rows.filter(r => r.status === 'sent').length,
      accepted: rows.filter(r => r.status === 'accepted').length,
      converted: rows.filter(r => r.status === 'converted').length,
      totalAmount: sum(rows),
      pendingAmount: sum(rows.filter(r => ['draft', 'sent', 'accepted'].includes(r.status))),
    };
  }, [rows]);

  const openPrintWindow = (html) => {
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) {
      alert('ບໍ່ສາມາດເປີດປ່ອງພິມໄດ້');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const printQuotation = (q) => {
    const items = Array.isArray(q.items) ? q.items : [];
    const subtotal = items.reduce((s, it) => s + (Number(it.amount) || Number(it.quantity || 0) * Number(it.price || 0)), 0);
    const discount = Number(q.discount) || 0;
    const total = Number(q.total) || Math.max(0, subtotal - discount);
    const itemRows = items.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${esc(it.product_name || `#${it.product_id || ''}`)}</b></td>
        <td class="right">${fmtNum(it.quantity)}</td>
        <td class="right money">${fmtPrice(it.price)}</td>
        <td class="right money">${fmtPrice(Number(it.amount) || Number(it.quantity || 0) * Number(it.price || 0))}</td>
      </tr>
    `).join('');
    const c = company || {};
    openPrintWindow(`<!doctype html>
<html><head><meta charset="utf-8"><title>ໃບສະເໜີລາຄາ</title>
<style>
  @page { size: A4 portrait; margin: 12mm }
  * { box-sizing: border-box; font-family: 'Noto Sans Lao','Phetsarath OT',system-ui,sans-serif; }
  body { margin: 0; color: #111827; font-size: 12px; line-height: 1.45; }
  .top { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 14px; }
  .brand img { max-height: 64px; max-width: 120px; object-fit: contain; }
  .brand .name { font-size: 20px; font-weight: 900; }
  .info { font-size: 11px; color: #475569; line-height: 1.4; margin-top: 2px; }
  .doc h1 { margin: 0; font-size: 22px; color: #b91c1c; font-weight: 900; text-align: right; }
  .doc .meta { font-size: 11px; color: #475569; margin-top: 3px; text-align: right; }
  .doc .meta b { color: #111827; }
  .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px dashed #e5e7eb; }
  .row:last-child { border-bottom: 0; }
  .label { color: #64748b; font-weight: 800; }
  .value { font-weight: 900; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #111827; color: white; padding: 7px 8px; text-align: left; font-size: 11px; font-weight: 900; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  th.right, td.right { text-align: right; }
  .money { font-family: ui-monospace,SFMono-Regular,Menlo,monospace; font-variant-numeric: tabular-nums; }
  .totals { margin-left: auto; width: 280px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-top: 14px; }
  .totals .row { padding: 8px 10px; border-bottom: 1px dashed #e2e8f0; }
  .totals .grand { background: #fef2f2; color: #991b1b; font-size: 15px; font-weight: 900; border-bottom: 0; }
  .note { margin-top: 14px; padding: 9px 11px; border: 1px dashed #94a3b8; border-radius: 8px; color: #334155; font-size: 11px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 38px; text-align: center; color: #475569; }
  .line { height: 32px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px; }
</style></head><body>
  <div class="top">
    <div class="brand">
      ${c.logo_url ? `<img src="${location.origin}${esc(c.logo_url)}" />` : ''}
      <div class="name">${esc(c.name || 'POS')}</div>
      ${c.address ? `<div class="info">${esc(c.address)}</div>` : ''}
      <div class="info">${[c.phone, c.email].filter(Boolean).map(esc).join(' · ')}</div>
      ${(c.tax_id || c.business_reg_no) ? `<div class="info">${[c.tax_id && `TAX: ${esc(c.tax_id)}`, c.business_reg_no && `REG: ${esc(c.business_reg_no)}`].filter(Boolean).join(' · ')}</div>` : ''}
    </div>
    <div class="doc">
      <h1>ໃບສະເໜີລາຄາ</h1>
      <div class="meta"><b>ເລກ:</b> ${esc(q.quotation_number || `#${q.id}`)}</div>
      <div class="meta"><b>ວັນທີ:</b> ${esc(fmtDate(q.quote_date))}</div>
      ${q.valid_until ? `<div class="meta"><b>ໝົດອາຍຸ:</b> ${esc(fmtDate(q.valid_until))}</div>` : ''}
    </div>
  </div>
  <div class="box grid">
    <div class="row"><span class="label">ລູກຄ້າ</span><span class="value">${esc(q.customer_name || '—')}</span></div>
    <div class="row"><span class="label">ເບີໂທ</span><span class="value">${esc(q.customer_phone || '—')}</span></div>
    ${q.customer_address ? `<div class="row" style="grid-column: span 2"><span class="label">ທີ່ຢູ່</span><span class="value">${esc(q.customer_address)}</span></div>` : ''}
  </div>
  <table>
    <thead><tr><th>#</th><th>ສິນຄ້າ / ບໍລິການ</th><th class="right">ຈຳນວນ</th><th class="right">ລາຄາ</th><th class="right">ລວມ</th></tr></thead>
    <tbody>${itemRows || '<tr><td colspan="5">ບໍ່ມີລາຍການ</td></tr>'}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span class="label">ລວມຍ່ອຍ</span><span class="value money">${fmtPrice(subtotal)}</span></div>
    ${discount > 0 ? `<div class="row"><span class="label">ສ່ວນຫຼຸດ</span><span class="value money">-${fmtPrice(discount)}</span></div>` : ''}
    <div class="row grand"><span>ລວມທັງໝົດ</span><span class="value money">${fmtPrice(total)}</span></div>
  </div>
  ${q.note ? `<div class="note"><b>ໝາຍເຫດ:</b> ${esc(q.note)}</div>` : ''}
  <div class="sign"><div><div class="line"></div>ຜູ້ສະເໜີລາຄາ</div><div><div class="line"></div>ຜູ້ຮັບລາຍການ</div></div>
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 400); }</script>
</body></html>`);
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Quotation"
        title="📜 ໃບສະເໜີລາຄາ"
        subtitle="ສ້າງໃບສະເໜີລາຄາໃຫ້ລູກຄ້າ ແລະ ປ່ຽນເປັນບິນຂາຍຕິດໜີ້ໄດ້"
        action={
          <Link href="/admin/quotations/new"
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/20">
            + ສ້າງໃບສະເໜີໃໝ່
          </Link>
        }
        metrics={[
          { label: 'ທັງໝົດ', value: fmtNum(stats.total), sub: fmtPrice(stats.totalAmount) },
          { label: 'ສະບັບຮ່າງ', value: fmtNum(stats.draft), sub: 'ຍັງບໍ່ສົ່ງ' },
          { label: 'ສົ່ງແລ້ວ / ຍອມຮັບ', value: fmtNum(stats.sent + stats.accepted), tone: 'cyan', sub: fmtPrice(stats.pendingAmount) },
          { label: 'ອອກບິນແລ້ວ', value: fmtNum(stats.converted), tone: 'violet', sub: 'ປ່ຽນເປັນບິນ' },
        ]}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex flex-wrap gap-2 items-center">
          <div className="flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
            <button onClick={() => setStatus('')}
              className={`px-3 py-2 text-xs font-bold transition ${status === '' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white'}`}>
              ທັງໝົດ
            </button>
            {Object.entries(STATUS_META).map(([k, m]) => (
              <button key={k} onClick={() => setStatus(k)}
                className={`px-3 py-2 text-xs font-bold transition ${status === k ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white'}`}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ຄົ້ນຫາເລກ, ຊື່ລູກຄ້າ, ເບີໂທ..."
            className="min-w-[220px] flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-red-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">ເລກ</th>
                <th className="px-3 py-2">ວັນທີ</th>
                <th className="px-3 py-2">ໝົດອາຍຸ</th>
                <th className="px-3 py-2">ລູກຄ້າ</th>
                <th className="px-3 py-2 text-right">ລາຍການ</th>
                <th className="px-3 py-2 text-right">ຍອດ</th>
                <th className="px-3 py-2">ສະຖານະ</th>
                <th className="px-3 py-2 text-center">ພິມ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="8" className="py-10 text-center text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="8" className="py-10 text-center text-slate-400">ບໍ່ມີໃບສະເໜີລາຄາ</td></tr>
              ) : rows.map(q => {
                const meta = STATUS_META[q.status] || STATUS_META.draft;
                const itemCount = Array.isArray(q.items) ? q.items.length : 0;
                return (
                  <tr key={q.id} className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => window.location.href = `/admin/quotations/${q.id}`}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-bold text-slate-800">{q.quotation_number || `#${q.id}`}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(q.quote_date)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtDate(q.valid_until)}</td>
                    <td className="px-3 py-2">
                      <div className="font-bold text-slate-800 truncate max-w-[220px]">{q.customer_name || '—'}</div>
                      <div className="text-[10px] text-slate-500">{q.customer_phone || '—'}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-600">{itemCount}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-extrabold text-slate-800">{fmtPrice(q.total)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${TONES[meta.tone]}`}>
                        {meta.icon} {meta.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-center">
                      <button onClick={(e) => { e.stopPropagation(); printQuotation(q); }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-700 hover:bg-slate-50">
                        🖨️ ພິມ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

