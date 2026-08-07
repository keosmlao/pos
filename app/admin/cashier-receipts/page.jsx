'use client';

import { useState, useEffect } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { formatDateTime } from '@/utils/formatDate';

const API = '/api';
const fmtNum = n => {
  const v = Number(n) || 0;
  if (v === 0) return '';
  return new Intl.NumberFormat('lo-LA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
};
const fmtNumTotal = n => new Intl.NumberFormat('lo-LA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
const fmtDate = s => {
  if (!s) return '';
  const d = new Date(s);
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
};

const QUICK = [
  { key: 'today', label: 'ມື້ນີ້' },
  { key: 'yesterday', label: 'ມື້ວານ' },
  { key: '7d', label: '7 ວັນ' },
  { key: 'month', label: 'ເດືອນນີ້' },
  { key: 'last_month', label: 'ເດືອນແລ້ວ' },
];

function getRange(key) {
  const today = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  if (key === 'today') return { from: iso(today), to: iso(today) };
  if (key === 'yesterday') {
    const y = new Date(today); y.setDate(today.getDate() - 1);
    return { from: iso(y), to: iso(y) };
  }
  if (key === '7d') {
    const from = new Date(today); from.setDate(today.getDate() - 6);
    return { from: iso(from), to: iso(today) };
  }
  if (key === 'month') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: iso(from), to: iso(today) };
  }
  if (key === 'last_month') {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: iso(from), to: iso(to) };
  }
  return { from: iso(today), to: iso(today) };
}

const TYPE_STYLE = {
  cash_sale: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  credit_sale: 'bg-amber-50 text-amber-700 border-amber-200',
  debt_payment: 'bg-sky-50 text-sky-700 border-sky-200',
  layby_payment: 'bg-violet-50 text-violet-700 border-violet-200',
  refund: 'bg-rose-50 text-rose-700 border-rose-200',
  manual_income: 'bg-slate-50 text-slate-600 border-slate-200',
  manual_expense: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function CashierReceiptsPage() {
  const initial = getRange('today');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [cashier, setCashier] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [company, setCompany] = useState(null);

  useEffect(() => {
    fetch(`${API}/admin/company`).then(r => r.json()).then(c => setCompany(c || null)).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      p.set('from', from); p.set('to', to);
      if (cashier) p.set('cashier', cashier);
      const res = await fetch(`${API}/admin/cashier-receipts?${p}`);
      setData(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(load, 150);
    return () => clearTimeout(t);
  }, [from, to, cashier]);

  const rows = data?.rows || [];
  const totals = data?.totals || {};
  const cashiers = data?.cashiers || [];

  const printReport = () => {
    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) return;
    w.document.open();
    w.document.write(buildPrintHtml({ from, to, cashier, rows, totals, company }));
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch {} }, 250);
  };

  const downloadPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    let holder;
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);

      // Render the report off-screen at A4-landscape width, then rasterize.
      holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:-12000px;top:0;width:1123px;background:#fff;';
      holder.innerHTML = `<style>${reportStyles()}</style><div style="padding:28px;">${buildReportBody({ from, to, cashier, rows, totals, company })}</div>`;
      document.body.appendChild(holder);
      await (document.fonts?.ready || Promise.resolve());
      await new Promise(r => setTimeout(r, 120));

      const canvas = await html2canvas(holder, { scale: 2, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = 297, pageH = 210, margin = 8;
      const imgW = pageW - margin * 2;
      const imgH = canvas.height * imgW / canvas.width;
      const usableH = pageH - margin * 2;
      const img = canvas.toDataURL('image/png');

      let position = margin;
      let heightLeft = imgH;
      pdf.addImage(img, 'PNG', margin, position, imgW, imgH);
      heightLeft -= usableH;
      while (heightLeft > 0) {
        position -= usableH;
        pdf.addPage();
        pdf.addImage(img, 'PNG', margin, position, imgW, imgH);
        heightLeft -= usableH;
      }
      pdf.save(`ລາຍງານຮັບເງິນ_${from}_${to}.pdf`);
    } finally {
      if (holder) holder.remove();
      setPdfBusy(false);
    }
  };

  return (
    <div>
      <AdminHero
        tag="Cashier receipts"
        title="🧾 ສະຫຼຸບການຮັບເງິນ Cashier"
        subtitle="ສະຫຼຸບເອກະສານຂາຍ, ຮັບຄືນສິນຄ້າ, ຮັບຊຳລະໜີ້, ດາວ໌ນຈອງ ປະຈຳວັນ"
      />

      {/* Filters */}
      <div className="px-4 md:px-6 -mt-3 mb-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-slate-500 font-bold">ແຕ່</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="h-8 px-2 border border-slate-200 rounded text-[12px]" />
            <label className="text-[11px] text-slate-500 font-bold">ຫາ</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="h-8 px-2 border border-slate-200 rounded text-[12px]" />
          </div>
          <div className="flex flex-wrap gap-1">
            {QUICK.map(q => (
              <button key={q.key}
                onClick={() => { const r = getRange(q.key); setFrom(r.from); setTo(r.to); }}
                className="h-8 px-2.5 rounded border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:bg-slate-50">
                {q.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] text-slate-500 font-bold">Cashier</label>
            <select value={cashier} onChange={e => setCashier(e.target.value)}
              className="h-8 px-2 border border-slate-200 rounded text-[12px] min-w-[140px]">
              <option value="">— ທັງໝົດ —</option>
              {cashiers.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={load}
              className="h-8 px-3 rounded bg-slate-100 hover:bg-slate-200 text-[12px] font-bold text-slate-700">
              ໂຫຼດໃໝ່
            </button>
            <button onClick={printReport}
              className="h-8 px-3 rounded bg-slate-700 hover:bg-slate-800 text-white text-[12px] font-bold flex items-center gap-1.5">
              🖨️ ພິມ
            </button>
            <button onClick={downloadPdf} disabled={pdfBusy || rows.length === 0}
              className="h-8 px-3 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-bold flex items-center gap-1.5">
              {pdfBusy ? '⏳ ກຳລັງສ້າງ...' : '📄 ດາວໂຫຼດ PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 md:px-6 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-[11px]">
                  <th rowSpan={2} className="border border-slate-200 px-2 py-1.5 font-bold">ວັນທີ</th>
                  <th rowSpan={2} className="border border-slate-200 px-2 py-1.5 font-bold">ເລກທີ</th>
                  <th rowSpan={2} className="border border-slate-200 px-2 py-1.5 font-bold">ປະເພດເອກະສານ</th>
                  <th colSpan={2} className="border border-slate-200 px-2 py-1 font-bold bg-emerald-50">ຍອດບິນຂາຍສົດ</th>
                  <th rowSpan={2} className="border border-slate-200 px-2 py-1.5 font-bold bg-amber-50">ຍອດບິນຂາຍຕິດໜີ້</th>
                  <th colSpan={2} className="border border-slate-200 px-2 py-1 font-bold bg-rose-50">ຍອດຮັບຄືນສິນຄ້າ (ຈ່າຍເງິນຄືນ)</th>
                  <th colSpan={2} className="border border-slate-200 px-2 py-1 font-bold bg-sky-50">ຍອດຊຳລະໜີ້</th>
                  <th colSpan={2} className="border border-slate-200 px-2 py-1 font-bold bg-violet-50">ຍອດດາວ໌ນເງິນຈອງ</th>
                  <th rowSpan={2} className="border border-slate-200 px-2 py-1.5 font-bold bg-slate-50">ອື່ນໆ</th>
                </tr>
                <tr className="bg-slate-100 text-slate-600 text-[10px]">
                  <th className="border border-slate-200 px-2 py-1 font-bold bg-emerald-50">ເງິນສົດ</th>
                  <th className="border border-slate-200 px-2 py-1 font-bold bg-emerald-50">ເງິນໂອນ</th>
                  <th className="border border-slate-200 px-2 py-1 font-bold bg-rose-50">ເງິນສົດ</th>
                  <th className="border border-slate-200 px-2 py-1 font-bold bg-rose-50">ເງິນໂອນ</th>
                  <th className="border border-slate-200 px-2 py-1 font-bold bg-sky-50">ເງິນສົດ</th>
                  <th className="border border-slate-200 px-2 py-1 font-bold bg-sky-50">ເງິນໂອນ</th>
                  <th className="border border-slate-200 px-2 py-1 font-bold bg-violet-50">ເງິນສົດ</th>
                  <th className="border border-slate-200 px-2 py-1 font-bold bg-violet-50">ເງິນໂອນ</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 && (
                  <tr><td colSpan={13} className="py-10 text-center text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={13} className="py-10 text-center text-slate-400">ບໍ່ມີຂໍ້ມູນໃນຊ່ວງເວລານີ້</td></tr>
                )}
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="border border-slate-200 px-2 py-1 font-mono text-[11px] whitespace-nowrap">{r.doc_number}</td>
                    <td className="border border-slate-200 px-2 py-1 whitespace-nowrap">
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${TYPE_STYLE[r.doc_type] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {r.doc_type_label}
                      </span>
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-mono">{fmtNum(r.cash_sale_cash)}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-mono">{fmtNum(r.cash_sale_transfer)}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-mono">{fmtNum(r.credit_sale)}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-mono text-rose-700">{fmtNum(r.refund_cash)}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-mono text-rose-700">{fmtNum(r.refund_transfer)}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-mono">{fmtNum(r.debt_payment_cash)}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-mono">{fmtNum(r.debt_payment_transfer)}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-mono">{fmtNum(r.layby_cash)}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-mono">{fmtNum(r.layby_transfer)}</td>
                    <td className="border border-slate-200 px-2 py-1 text-right font-mono">{fmtNum(r.other)}</td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-900 text-white font-bold">
                    <td colSpan={3} className="border border-slate-700 px-2 py-1.5 text-right">ລວມທັງໝົດ</td>
                    <td className="border border-slate-700 px-2 py-1.5 text-right font-mono">{fmtNumTotal(totals.cash_sale_cash)}</td>
                    <td className="border border-slate-700 px-2 py-1.5 text-right font-mono">{fmtNumTotal(totals.cash_sale_transfer)}</td>
                    <td className="border border-slate-700 px-2 py-1.5 text-right font-mono">{fmtNumTotal(totals.credit_sale)}</td>
                    <td className="border border-slate-700 px-2 py-1.5 text-right font-mono">{fmtNumTotal(totals.refund_cash)}</td>
                    <td className="border border-slate-700 px-2 py-1.5 text-right font-mono">{fmtNumTotal(totals.refund_transfer)}</td>
                    <td className="border border-slate-700 px-2 py-1.5 text-right font-mono">{fmtNumTotal(totals.debt_payment_cash)}</td>
                    <td className="border border-slate-700 px-2 py-1.5 text-right font-mono">{fmtNumTotal(totals.debt_payment_transfer)}</td>
                    <td className="border border-slate-700 px-2 py-1.5 text-right font-mono">{fmtNumTotal(totals.layby_cash)}</td>
                    <td className="border border-slate-700 px-2 py-1.5 text-right font-mono">{fmtNumTotal(totals.layby_transfer)}</td>
                    <td className="border border-slate-700 px-2 py-1.5 text-right font-mono">{fmtNumTotal(totals.other)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Summary box */}
          {rows.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border-t border-slate-200">
              <div className="bg-white border border-emerald-200 rounded-lg p-3">
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">ລວມຮັບເງິນສົດ</div>
                <div className="text-xl font-extrabold text-emerald-700 font-mono mt-1">{fmtNumTotal(totals.total_cash_in)}</div>
                <div className="text-[10px] text-slate-400">₭</div>
              </div>
              <div className="bg-white border border-sky-200 rounded-lg p-3">
                <div className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">ລວມຮັບເງິນໂອນ</div>
                <div className="text-xl font-extrabold text-sky-700 font-mono mt-1">{fmtNumTotal(totals.total_transfer_in)}</div>
                <div className="text-[10px] text-slate-400">₭</div>
              </div>
              <div className="bg-white border border-slate-300 rounded-lg p-3">
                <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">ລວມຮັບເງິນທັງໝົດ</div>
                <div className="text-xl font-extrabold text-slate-900 font-mono mt-1">{fmtNumTotal(totals.grand_total_received)}</div>
                <div className="text-[10px] text-slate-400">₭ (ສົດ + ໂອນ)</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function reportStyles() {
  return `
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; }
  .rpt { font-family: "Noto Sans Lao", "Phetsarath OT", system-ui, -apple-system, sans-serif; font-size: 11px; color: #111; }
  .rpt h1 { font-size: 16px; margin: 0 0 2px 0; }
  .rpt .meta { font-size: 11px; color: #555; margin-bottom: 8px; }
  .rpt table { width: 100%; border-collapse: collapse; }
  .rpt th, .rpt td { border: 1px solid #999; padding: 3px 5px; vertical-align: middle; }
  .rpt thead th { background: #eef2f7; font-weight: 700; text-align: center; font-size: 10px; }
  .rpt td { font-size: 11px; }
  .rpt .num { text-align: right; font-variant-numeric: tabular-nums; font-family: ui-monospace, Menlo, monospace; }
  .rpt .mono { font-family: ui-monospace, Menlo, monospace; }
  .rpt tfoot td { font-weight: 800; background: #1f2937; color: #fff; }
  .rpt .footer-summary { margin-top: 8px; display: flex; gap: 12px; }
  .rpt .footer-summary .box { border: 1px solid #999; padding: 6px 10px; min-width: 180px; }
  .rpt .footer-summary .label { font-size: 10px; color: #555; font-weight: 700; }
  .rpt .footer-summary .value { font-size: 14px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .rpt .sig { margin-top: 26px; display: flex; justify-content: space-between; gap: 32px; }
  .rpt .sig .col { flex: 1; text-align: center; font-size: 11px; }
  .rpt .sig .line { margin: 24px auto 4px; border-top: 1px solid #555; width: 70%; }
  `;
}

// Report body matching the official cashier cash-receipt layout:
// ວັນທີ | ເລກທີ | ປະເພດ | ຂາຍສົດ (ສົດ/ໂອນ) | ຂາຍຕິດໜີ້ | ຮັບຄືນສິນຄ້າ (ສົດ/ໂອນ) | ຊຳລະໜີ້ (ສົດ/ໂອນ) | ເງິນໄດ້ຮັບທັງໝົດ (ສົດ/ໂອນ)
// Layby and manual income/expense rows show in the ເງິນໄດ້ຮັບທັງໝົດ pair (no dedicated column in this layout).
function buildReportBody({ from, to, cashier, rows, totals, company }) {
  const fmt = n => {
    const v = Number(n) || 0;
    if (v === 0) return '';
    return new Intl.NumberFormat('lo-LA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  };
  const fmtT = n => new Intl.NumberFormat('lo-LA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
  const dateStr = s => {
    if (!s) return '';
    const d = new Date(s);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  };
  const periodLabel = from === to ? dateStr(from) : `${dateStr(from)} ຫາ ${dateStr(to)}`;
  const companyName = company?.name || company?.company_name || '';

  const bodyRows = rows.map(r => {
    const extraCash = (Number(r.layby_cash) || 0) + (Number(r.other_cash) || 0);
    const extraTransfer = (Number(r.layby_transfer) || 0) + (Number(r.other_transfer) || 0);
    return `
    <tr>
      <td>${dateStr(r.date)}</td>
      <td class="mono">${escapeHtml(r.doc_number || '')}</td>
      <td>${escapeHtml(r.doc_type_label || '')}</td>
      <td class="num">${fmt(r.cash_sale_cash)}</td>
      <td class="num">${fmt(r.cash_sale_transfer)}</td>
      <td class="num">${fmt(r.credit_sale)}</td>
      <td class="num">${fmt(r.refund_cash)}</td>
      <td class="num">${fmt(r.refund_transfer)}</td>
      <td class="num">${fmt(r.debt_payment_cash)}</td>
      <td class="num">${fmt(r.debt_payment_transfer)}</td>
      <td class="num">${fmt(extraCash)}</td>
      <td class="num">${fmt(extraTransfer)}</td>
    </tr>`;
  }).join('');

  return `<div class="rpt">
  <h1>ລາຍງານຮັບເງິນ Cashier ${companyName ? '· ' + escapeHtml(companyName) : ''}</h1>
  <div class="meta">
    ໄລຍະ: <b>${periodLabel}</b>
    ${cashier ? ` · Cashier: <b>${escapeHtml(cashier)}</b>` : ''}
    · ພິມເມື່ອ: ${formatDateTime(new Date())}
  </div>
  <table>
    <thead>
      <tr>
        <th rowspan="2">ວັນທີ</th>
        <th rowspan="2">ເລກທີ</th>
        <th rowspan="2">ປະເພດເອກະສານ</th>
        <th colspan="2">ຍອດບິນຂາຍສົດ</th>
        <th rowspan="2">ຍອດບິນຂາຍຕິດໜີ້</th>
        <th colspan="2">ຍອດຮັບຄືນສິນຄ້າ (ຈ່າຍເງິນຄືນ)</th>
        <th colspan="2">ຍອດຊຳລະໜີ້</th>
        <th colspan="2">ເງິນໄດ້ຮັບທັງໝົດ</th>
      </tr>
      <tr>
        <th>ເງິນສົດ</th><th>ເງິນໂອນ</th>
        <th>ເງິນສົດ</th><th>ເງິນໂອນ</th>
        <th>ເງິນສົດ</th><th>ເງິນໂອນ</th>
        <th>ເງິນສົດ</th><th>ເງິນໂອນ</th>
      </tr>
    </thead>
    <tbody>${bodyRows || '<tr><td colspan="12" style="text-align:center; padding:18px; color:#888;">ບໍ່ມີຂໍ້ມູນ</td></tr>'}</tbody>
    ${rows.length > 0 ? `<tfoot>
      <tr>
        <td colspan="3" style="text-align:right;">ລວມທັງໝົດ</td>
        <td class="num">${fmtT(totals.cash_sale_cash)}</td>
        <td class="num">${fmtT(totals.cash_sale_transfer)}</td>
        <td class="num">${fmtT(totals.credit_sale)}</td>
        <td class="num">${fmtT(totals.refund_cash)}</td>
        <td class="num">${fmtT(totals.refund_transfer)}</td>
        <td class="num">${fmtT(totals.debt_payment_cash)}</td>
        <td class="num">${fmtT(totals.debt_payment_transfer)}</td>
        <td class="num">${fmtT(totals.total_cash_in)}</td>
        <td class="num">${fmtT(totals.total_transfer_in)}</td>
      </tr>
    </tfoot>` : ''}
  </table>

  ${rows.length > 0 ? `
  <div class="footer-summary">
    <div class="box">
      <div class="label">ລວມຮັບເງິນສົດ</div>
      <div class="value">${fmtT(totals.total_cash_in)} ₭</div>
    </div>
    <div class="box">
      <div class="label">ລວມຮັບເງິນໂອນ</div>
      <div class="value">${fmtT(totals.total_transfer_in)} ₭</div>
    </div>
    <div class="box">
      <div class="label">ລວມຮັບເງິນທັງໝົດ</div>
      <div class="value">${fmtT(totals.grand_total_received)} ₭</div>
    </div>
  </div>` : ''}

  <div class="sig">
    <div class="col"><div class="line"></div>Cashier</div>
    <div class="col"><div class="line"></div>ຜູ້ກວດສອບ</div>
    <div class="col"><div class="line"></div>ຜູ້ຮັບເງິນ</div>
  </div>
</div>`;
}

function buildPrintHtml(opts) {
  const dateStr = s => {
    if (!s) return '';
    const d = new Date(s);
    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  };
  const periodLabel = opts.from === opts.to ? dateStr(opts.from) : `${dateStr(opts.from)} ຫາ ${dateStr(opts.to)}`;
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>ລາຍງານຮັບເງິນ ${periodLabel}</title>
<style>${reportStyles()}</style></head>
<body>${buildReportBody(opts)}</body></html>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
