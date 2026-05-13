'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Number(n) || 0);
const fmtPrice = n => `${fmtNum(Math.round(Number(n) || 0))} ₭`;
const fmtDate = s => s ? new Date(s).toLocaleString('lo-LA') : '—';
const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[ch]));

export default function ReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [lookup, setLookup] = useState(null);
  const [qty, setQty] = useState({});
  const [refundMethod, setRefundMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerOrders, setPickerOrders] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerFilter, setPickerFilter] = useState('returnable'); // 'all' | 'returnable'

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const openPrintWindow = (html) => {
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) {
      showToast('ບໍ່ສາມາດເປີດປ່ອງພິມໄດ້', 'error');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const printReturnReceipt = (ret) => {
    const items = Array.isArray(ret?.items) ? ret.items : [];
    const rows = items.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${esc(it.product_name || `#${it.product_id || ''}`)}</b></td>
        <td class="right">${fmtNum(it.quantity)}</td>
        <td class="right money">${fmtPrice(it.price)}</td>
        <td class="right money">${fmtPrice(Number(it.amount) || Number(it.quantity || 0) * Number(it.price || 0))}</td>
      </tr>
    `).join('');
    const refundMethod = ret.refund_method === 'transfer' ? 'ໂອນ' : ret.refund_method === 'qr' ? 'QR' : 'ເງິນສົດ';
    openPrintWindow(`<!doctype html>
<html><head><meta charset="utf-8"><title>ໃບຄືນເຄື່ອງ</title>
<style>
  @page { size: A4 portrait; margin: 12mm }
  * { box-sizing: border-box; font-family: 'Noto Sans Lao','Phetsarath OT',system-ui,sans-serif; }
  body { margin: 0; color: #111827; font-size: 12px; line-height: 1.45; }
  .top { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 14px; }
  .brand { font-size: 20px; font-weight: 900; }
  .muted { color: #64748b; font-size: 11px; }
  .doc h1 { margin: 0; color: #b91c1c; font-size: 22px; font-weight: 900; text-align: right; }
  .doc div { text-align: right; margin-top: 3px; }
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
  .total { margin-left: auto; width: 280px; margin-top: 14px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
  .total .row { padding: 10px 12px; background: #fef2f2; color: #991b1b; font-size: 15px; font-weight: 900; border: 0; }
  .note { margin-top: 14px; padding: 9px 11px; border: 1px dashed #94a3b8; border-radius: 8px; color: #334155; font-size: 11px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 26px; margin-top: 40px; text-align: center; color: #475569; }
  .line { height: 34px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px; }
</style></head><body>
  <div class="top">
    <div>
      <div class="brand">POS</div>
      <div class="muted">ເອກະສານຮັບຄືນສິນຄ້າ ແລະ ຄືນເງິນ</div>
    </div>
    <div class="doc">
      <h1>ໃບຄືນເຄື່ອງ</h1>
      <div><b>ເລກ:</b> ${esc(ret.return_number || '—')}</div>
      <div><b>ວັນທີ:</b> ${esc(fmtDate(ret.created_at || new Date()))}</div>
    </div>
  </div>
  <div class="box grid">
    <div class="row"><span class="label">ບິນອ້າງອີງ</span><span class="value">${esc(ret.bill_number || `#${ret.order_id || ''}`)}</span></div>
    <div class="row"><span class="label">ວັນທີຂາຍ</span><span class="value">${esc(fmtDate(ret.order_created_at))}</span></div>
    <div class="row"><span class="label">ລູກຄ້າ</span><span class="value">${esc(ret.customer_name || 'ລູກຄ້າທົ່ວໄປ')}</span></div>
    <div class="row"><span class="label">ເບີໂທ</span><span class="value">${esc(ret.customer_phone || '—')}</span></div>
    <div class="row"><span class="label">ວິທີຄືນເງິນ</span><span class="value">${esc(refundMethod)}</span></div>
    <div class="row"><span class="label">ຜູ້ບັນທຶກ</span><span class="value">${esc(ret.created_by || '—')}</span></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>ສິນຄ້າ</th><th class="right">ຈຳນວນຄືນ</th><th class="right">ລາຄາ</th><th class="right">ລວມ</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5">ບໍ່ມີລາຍການ</td></tr>'}</tbody>
  </table>
  <div class="total"><div class="row"><span>ຍອດຄືນເງິນ</span><span class="money">${fmtPrice(ret.refund_amount)}</span></div></div>
  ${ret.note ? `<div class="note"><b>ໝາຍເຫດ:</b> ${esc(ret.note)}</div>` : ''}
  <div class="sign">
    <div><div class="line"></div>ຜູ້ຮັບຄືນ</div>
    <div><div class="line"></div>ຜູ້ຄືນເງິນ</div>
    <div><div class="line"></div>ລູກຄ້າ</div>
  </div>
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 400); }</script>
</body></html>`);
  };

  const loadReturns = () => fetch(`${API}/returns`).then(r => r.json()).then(data => setReturns(Array.isArray(data) ? data : []));
  useEffect(() => { loadReturns(); }, []);

  const loadPickerOrders = async (qStr = '') => {
    setPickerLoading(true);
    try {
      const url = `${API}/returns/orders?limit=100${qStr ? `&q=${encodeURIComponent(qStr)}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setPickerOrders(Array.isArray(data) ? data : []);
    } finally {
      setPickerLoading(false);
    }
  };

  const openPicker = () => {
    setShowPicker(true);
    setPickerQuery('');
    loadPickerOrders('');
  };

  useEffect(() => {
    if (!showPicker) return;
    const t = setTimeout(() => loadPickerOrders(pickerQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [pickerQuery, showPicker]);

  const selectOrder = async (orderId) => {
    setShowPicker(false);
    setLoading(true);
    try {
      const res = await fetch(`${API}/returns/lookup?q=${encodeURIComponent(String(orderId))}`);
      const data = await res.json();
      if (!res.ok) {
        setLookup(null);
        showToast(data.error || 'ບໍ່ພົບບິນ', 'error');
        return;
      }
      setLookup(data);
      setQty({});
    } finally {
      setLoading(false);
    }
  };

  const filteredPickerOrders = useMemo(() => {
    if (pickerFilter === 'returnable') return pickerOrders.filter(o => Number(o.returnable_qty) > 0);
    return pickerOrders;
  }, [pickerOrders, pickerFilter]);

  const selectedItems = useMemo(() => {
    if (!lookup?.items) return [];
    return lookup.items
      .map(it => ({ ...it, quantity: Math.max(0, Number(qty[it.order_item_id]) || 0) }))
      .filter(it => it.quantity > 0);
  }, [lookup, qty]);
  const refundTotal = selectedItems.reduce((s, it) => s + it.quantity * Number(it.price || 0), 0);

  const submitReturn = async () => {
    if (!lookup?.order?.id || selectedItems.length === 0) return showToast('ກະລຸນາເລືອກສິນຄ້າທີ່ຈະຮັບຄືນ', 'error');
    setSaving(true);
    try {
      const res = await fetch(`${API}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: lookup.order.id,
          refund_method: refundMethod,
          note,
          created_by: 'admin',
          items: selectedItems.map(it => ({ order_item_id: it.order_item_id, quantity: it.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || 'ບັນທຶກບໍ່ສຳເລັດ', 'error');
      printReturnReceipt({
        ...data,
        bill_number: lookup.order.bill_number,
        order_created_at: lookup.order.created_at,
        customer_name: lookup.order.customer_name,
        customer_phone: lookup.order.customer_phone,
      });
      showToast(`ຮັບຄືນສຳເລັດ ${data.return_number}`);
      setLookup(null); setQty({}); setNote('');
      await loadReturns();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Returns / Refunds"
        title="↩ ຮັບຄືນສິນຄ້າ / ຄືນເງິນ"
        subtitle="ຄົ້ນຫາບິນ, ເລືອກສິນຄ້າທີ່ຮັບຄືນ ແລະບັນທຶກການຄືນເງິນ"
        action={
          <button onClick={loadReturns}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/20">
            ↻ ໂຫຼດໃໝ່
          </button>
        }
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        {!lookup ? (
          <button onClick={openPicker} disabled={loading}
            className="w-full rounded-xl border-2 border-dashed border-red-300 bg-blue-50/40 hover:bg-blue-50 hover:border-red-400 px-4 py-6 text-center transition disabled:opacity-50">
            <div className="text-3xl mb-1">🧾</div>
            <div className="text-sm font-extrabold text-red-700">
              {loading ? 'ກຳລັງໂຫຼດ...' : 'ເລືອກບິນເພື່ອຮັບຄືນສິນຄ້າ'}
            </div>
            <div className="text-[11px] text-red-500 mt-0.5">ກົດເພື່ອເປີດລາຍການບິນທີ່ສາມາດຮັບຄືນ</div>
          </button>
        ) : (
          <button onClick={openPicker} disabled={loading}
            className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
            🧾 ເລືອກບິນອື່ນ
          </button>
        )}

        {lookup && (() => {
          const totalItemsCount = selectedItems.reduce((s, it) => s + it.quantity, 0);
          const refundMethods = [
            { key: 'cash', icon: '💵', label: 'ເງິນສົດ' },
            { key: 'transfer', icon: '🏦', label: 'ໂອນ' },
            { key: 'qr', icon: '📱', label: 'QR' },
          ];
          return (
          <div className="mt-4 space-y-3">
            {/* Order header */}
            <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">ບິນອ້າງອີງ</div>
                <div className="font-mono text-2xl font-extrabold text-slate-900 mt-0.5">{lookup.order.bill_number || `#${lookup.order.id}`}</div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>{fmtDate(lookup.order.created_at)}</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-bold">👤 {lookup.order.customer_name || 'ລູກຄ້າທົ່ວໄປ'}</span>
                </div>
              </div>
              <button onClick={() => { setLookup(null); setQty({}); setNote(''); }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
                ✕ ລ້າງ
              </button>
            </div>

            {/* Items as cards */}
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">ສິນຄ້າທີ່ສາມາດຮັບຄືນ</div>
                <span className="text-[10px] font-bold text-slate-400">{lookup.items.length} ລາຍການ</span>
              </div>
              <div className="divide-y divide-slate-100">
                {lookup.items.map((it, idx) => {
                  const val = Number(qty[it.order_item_id]) || 0;
                  const max = Number(it.returnable_qty) || 0;
                  const setQ = (n) => setQty({ ...qty, [it.order_item_id]: Math.max(0, Math.min(max, n)) });
                  const isSelected = val > 0;
                  return (
                    <div key={it.order_item_id} className={`p-3 ${isSelected ? 'bg-blue-50/50' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${isSelected ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-slate-900 text-sm">{it.product_name || `#${it.product_id}`}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                            <span>ຂາຍ <b className="text-slate-700">{fmtNum(it.sold_qty)}</b></span>
                            {it.returned_qty > 0 && <span>ຄືນແລ້ວ <b className="text-amber-600">{fmtNum(it.returned_qty)}</b></span>}
                            <span>ຄືນໄດ້ <b className="text-emerald-600">{fmtNum(it.returnable_qty)}</b></span>
                            <span className="text-slate-300">·</span>
                            <span>ລາຄາ <b className="text-slate-700 font-mono">{fmtNum(it.price)}</b> ₭</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className={`font-mono text-base font-extrabold ${isSelected ? 'text-red-700' : 'text-slate-300'}`}>
                            {fmtPrice(val * Number(it.price || 0))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 ml-11">
                        <div className="flex items-stretch rounded-lg border border-slate-200 overflow-hidden">
                          <button type="button" onClick={() => setQ(val - 1)} disabled={val <= 0}
                            className="w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-30 text-base font-extrabold">−</button>
                          <input type="number" min="0" max={max} value={qty[it.order_item_id] || ''}
                            onChange={e => setQty({ ...qty, [it.order_item_id]: Math.max(0, Math.min(max, Number(e.target.value) || 0)) })}
                            placeholder="0"
                            className="w-16 h-9 text-center font-mono font-bold text-slate-800 outline-none border-x border-slate-200" />
                          <button type="button" onClick={() => setQ(val + 1)} disabled={val >= max}
                            className="w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-30 text-base font-extrabold">+</button>
                        </div>
                        <button type="button" onClick={() => setQ(max)} disabled={max <= 0}
                          className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-blue-100 hover:text-red-700 text-xs font-extrabold text-slate-600 disabled:opacity-30">
                          MAX
                        </button>
                        {val > 0 && (
                          <button type="button" onClick={() => setQ(0)}
                            className="h-9 px-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs">
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Refund method + note */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2">ວິທີຄືນເງິນ</div>
                <div className="grid grid-cols-3 gap-2">
                  {refundMethods.map(m => (
                    <button key={m.key} type="button" onClick={() => setRefundMethod(m.key)}
                      className={`rounded-lg border-2 py-3 transition ${
                        refundMethod === m.key
                          ? 'border-red-500 bg-blue-50 shadow-inner'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}>
                      <div className="text-2xl leading-none">{m.icon}</div>
                      <div className={`mt-1 text-xs font-extrabold ${refundMethod === m.key ? 'text-red-700' : 'text-slate-600'}`}>{m.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5">ໝາຍເຫດ / ເຫດຜົນ</div>
                <textarea value={note} onChange={e => setNote(e.target.value)}
                  placeholder="ສິນຄ້າຊຳລຸດ, ບໍ່ຖືກໃຈ, ສິນຄ້າຜິດ..."
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/10 resize-none" />
              </div>
            </div>

            {/* Sticky summary bar */}
            <div className="sticky bottom-0 z-10 rounded-xl border-2 border-red-500 bg-gradient-to-r from-red-600 to-red-700 p-4 shadow-2xl shadow-red-500/20">
              <div className="flex items-center justify-between gap-4">
                <div className="text-white">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-blue-100">ຍອດຕ້ອງຄືນເງິນ</div>
                  <div className="mt-0.5 text-3xl font-extrabold font-mono tracking-tight">{fmtPrice(refundTotal)}</div>
                  <div className="text-[11px] font-bold text-blue-200 mt-0.5">
                    {totalItemsCount > 0 ? `${fmtNum(totalItemsCount)} ຊິ້ນ · ${selectedItems.length} ລາຍການ` : 'ຍັງບໍ່ໄດ້ເລືອກສິນຄ້າ'}
                  </div>
                </div>
                <button onClick={submitReturn} disabled={saving || refundTotal <= 0}
                  className="rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-red-700 shadow-lg hover:bg-blue-50 disabled:bg-red-500 disabled:text-blue-200 disabled:cursor-not-allowed transition flex items-center gap-2">
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-300 border-t-red-700 rounded-full animate-spin"></div>
                      ກຳລັງບັນທຶກ...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                      ບັນທຶກຮັບຄືນ
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          );
        })()}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-extrabold text-slate-900">ປະຫວັດຮັບຄືນ</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">ວັນທີ</th>
                <th className="px-3 py-2">ເລກຮັບຄືນ</th>
                <th className="px-3 py-2">ບິນ</th>
                <th className="px-3 py-2">ລູກຄ້າ</th>
                <th className="px-3 py-2">ລາຍການ</th>
                <th className="px-3 py-2">ວິທີຄືນເງິນ</th>
                <th className="px-3 py-2 text-right">ຍອດຄືນ</th>
                <th className="px-3 py-2 text-center">ພິມ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returns.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(r.created_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono font-bold text-red-700">{r.return_number}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono">{r.bill_number || `#${r.order_id}`}</td>
                  <td className="px-3 py-2">{r.customer_name || '—'}</td>
                  <td className="px-3 py-2 text-slate-500">{(r.items || []).map(it => `${it.product_name || ''} x${it.quantity}`).join(', ')}</td>
                  <td className="px-3 py-2">{r.refund_method || 'cash'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-extrabold text-red-700">{fmtPrice(r.refund_amount)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-center">
                    <button onClick={() => printReturnReceipt(r)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-slate-700 hover:bg-slate-50">
                      🖨️ ພິມ
                    </button>
                  </td>
                </tr>
              ))}
              {returns.length === 0 && <tr><td colSpan="8" className="py-10 text-center text-slate-400">ຍັງບໍ່ມີການຮັບຄືນ</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowPicker(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">ເລືອກບິນທີ່ຈະຮັບຄືນ</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">ກົດໃສ່ບິນເພື່ອເບິ່ງລາຍລະອຽດ ແລະ ເລືອກສິນຄ້າທີ່ຈະຮັບຄືນ</p>
              </div>
              <button onClick={() => setShowPicker(false)}
                className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center text-slate-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input value={pickerQuery} onChange={e => setPickerQuery(e.target.value)}
                  placeholder="ຄົ້ນຫາ ເລກບິນ, ID, ຊື່ລູກຄ້າ, ເບີໂທ..."
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-500/10" />
              </div>
              <div className="flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                {[
                  { key: 'returnable', label: 'ຮັບຄືນໄດ້' },
                  { key: 'all', label: 'ທັງໝົດ' },
                ].map(f => (
                  <button key={f.key} onClick={() => setPickerFilter(f.key)}
                    className={`px-3 py-2 text-xs font-bold transition ${pickerFilter === f.key ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-white'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {pickerLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-10 h-10 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin"></div>
                </div>
              ) : filteredPickerOrders.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-400">
                  {pickerQuery ? `ບໍ່ພົບບິນທີ່ກົງກັບ "${pickerQuery}"` : 'ບໍ່ມີບິນ'}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredPickerOrders.map(o => {
                    const returnable = Number(o.returnable_qty) || 0;
                    const returned = Number(o.returned_qty) || 0;
                    const canReturn = returnable > 0;
                    return (
                      <button key={o.id} onClick={() => selectOrder(o.id)}
                        disabled={!canReturn}
                        className={`w-full px-5 py-3 text-left transition flex items-center gap-3 ${
                          canReturn ? 'hover:bg-blue-50/60' : 'opacity-50 cursor-not-allowed bg-slate-50'
                        }`}>
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base ${canReturn ? 'bg-blue-100 text-red-700' : 'bg-slate-200 text-slate-400'}`}>
                          🧾
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-extrabold text-slate-900">{o.bill_number || `#${o.id}`}</span>
                            <span className="text-[10px] font-bold text-slate-400">{fmtDate(o.created_at)}</span>
                            {o.payment_method === 'credit' && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded uppercase">ຕິດໜີ້</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5 truncate">
                            👤 {o.customer_name || 'ລູກຄ້າທົ່ວໄປ'}{o.customer_phone ? ` · ${o.customer_phone}` : ''}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] mt-0.5">
                            <span className="text-slate-500">ຂາຍ <b className="text-slate-700">{fmtNum(o.sold_qty)}</b></span>
                            {returned > 0 && <span className="text-amber-600">ຄືນແລ້ວ <b>{fmtNum(returned)}</b></span>}
                            <span className={canReturn ? 'text-emerald-600' : 'text-slate-400'}>
                              ຄືນໄດ້ <b>{fmtNum(returnable)}</b>
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-base font-extrabold text-slate-900">{fmtPrice(o.total)}</div>
                          {canReturn && (
                            <div className="text-[10px] font-extrabold text-red-600 mt-0.5">→ ເລືອກ</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">{fmtNum(filteredPickerOrders.length)} / {fmtNum(pickerOrders.length)} ບິນ</span>
              <button onClick={() => loadPickerOrders(pickerQuery.trim())}
                className="text-red-600 hover:text-red-700 font-bold">ໂຫຼດໃໝ່</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-lg ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
