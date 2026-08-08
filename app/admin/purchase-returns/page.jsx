'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { usePagePermission } from '@/utils/adminPermissions';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;
const fmtDateTime = v => `${String(v || '').slice(0, 10).split('-').reverse().join('/')} ${String(v || '').slice(11, 16)}`;

const METHODS = [
  { key: 'cash', label: 'ເງິນສົດ', icon: '💵' },
  { key: 'transfer', label: 'ໂອນ', icon: '🏦' },
];

export default function PurchaseReturnsPage() {
  const perm = usePagePermission('/admin/purchase-returns');
  const [lookup, setLookup] = useState(null);
  const [qty, setQty] = useState({});
  const [settleMode, setSettleMode] = useState('refund');
  const [amounts, setAmounts] = useState({ cash: '', transfer: '' });
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [returns, setReturns] = useState([]);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerRows, setPickerRows] = useState([]);
  const [pickerFilter, setPickerFilter] = useState('returnable');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadReturns = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/purchase-returns`);
      setReturns(await res.json());
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadReturns(); }, [loadReturns]);

  const loadPicker = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/purchase-returns/purchases?limit=100&q=${encodeURIComponent(pickerQuery)}`);
      setPickerRows(await res.json());
    } catch { setPickerRows([]); }
  }, [pickerQuery]);
  useEffect(() => {
    if (!showPicker) return;
    const t = setTimeout(loadPicker, 250);
    return () => clearTimeout(t);
  }, [showPicker, loadPicker]);

  const selectPurchase = async (id) => {
    setShowPicker(false);
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/purchase-returns/lookup?q=${encodeURIComponent(String(id))}`);
      const data = await res.json();
      if (!res.ok) { setLookup(null); showToast(data.error || 'ບໍ່ພົບບິນ', 'error'); return; }
      setLookup(data);
      setQty({});
      setAmounts({ cash: '', transfer: '' });
      setSettleMode(Number(data.debt?.remaining) > 0 ? 'debt' : 'refund');
    } finally {
      setLoading(false);
    }
  };

  const filteredPicker = useMemo(
    () => (pickerFilter === 'returnable' ? pickerRows.filter(r => Number(r.returnable_qty) > 0) : pickerRows),
    [pickerRows, pickerFilter]
  );

  const selectedItems = useMemo(() => {
    if (!lookup?.items) return [];
    return lookup.items
      .map(it => ({ ...it, quantity: Math.max(0, Number(qty[it.purchase_item_id]) || 0) }))
      .filter(it => it.quantity > 0);
  }, [lookup, qty]);

  const netPriceOf = it => (it.net_price != null ? Number(it.net_price) : Number(it.cost_price || 0));
  const grossTotal = selectedItems.reduce((s, it) => s + it.quantity * Number(it.cost_price || 0), 0);
  const refundTotal = Math.round(selectedItems.reduce((s, it) => s + it.quantity * netPriceOf(it), 0));
  const billDiscount = Math.max(0, Math.round(grossTotal) - refundTotal);
  const totalItemsCount = selectedItems.reduce((s, it) => s + it.quantity, 0);

  const cashAmt = Math.max(0, Math.round(Number(amounts.cash) || 0));
  const transferAmt = Math.max(0, Math.round(Number(amounts.transfer) || 0));
  const entered = cashAmt + transferAmt;
  const remainingToAllocate = refundTotal - entered;

  const stockShort = selectedItems.filter(it => it.quantity > Number(it.qty_on_hand || 0));

  const submit = async () => {
    if (!lookup?.purchase?.id || selectedItems.length === 0) return showToast('ກະລຸນາເລືອກສິນຄ້າທີ່ຈະສົ່ງຄືນ', 'error');
    if (stockShort.length > 0) return showToast(`ສະຕັອກບໍ່ພຽງພໍ: ${stockShort[0].product_name}`, 'error');

    let payments = null;
    if (settleMode === 'refund') {
      payments = [];
      if (cashAmt > 0) payments.push({ method: 'cash', amount: cashAmt });
      if (transferAmt > 0) payments.push({ method: 'transfer', amount: transferAmt });
      if (payments.length === 0) payments = [{ method: 'cash', amount: refundTotal }];
      const sum = payments.reduce((s, p) => s + p.amount, 0);
      if (sum !== refundTotal) return showToast(`ຍອດຮັບຄືນບໍ່ຕົງ — ຍັງເຫຼືອ ${fmtPrice(refundTotal - sum)}`, 'error');
    }

    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/purchase-returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchase_id: lookup.purchase.id,
          settle_mode: settleMode,
          payments,
          note,
          created_by: 'admin',
          items: selectedItems.map(it => ({ purchase_item_id: it.purchase_item_id, quantity: it.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || 'ບັນທຶກບໍ່ສຳເລັດ', 'error');
      printReturnDoc({ ...data, supplier_name: lookup.purchase.supplier_name, ref_number: lookup.purchase.ref_number });
      showToast(`ບັນທຶກສຳເລັດ ${data.return_number}`);
      setLookup(null); setQty({}); setNote(''); setAmounts({ cash: '', transfer: '' });
      await loadReturns();
    } finally {
      setSaving(false);
    }
  };

  const removeReturn = async (r) => {
    if (!window.confirm(`ຍົກເລີກໃບ ${r.return_number}? ສິນຄ້າຈະກັບເຂົ້າສາງ`)) return;
    const res = await fetch(`${API}/admin/purchase-returns/${r.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || 'ຍົກເລີກບໍ່ສຳເລັດ', 'error');
    showToast(`ຍົກເລີກ ${r.return_number} ແລ້ວ`);
    await loadReturns();
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Purchase Return"
        title="↩ ສົ່ງເຄື່ອງຄືນໃຫ້ຜູ້ສະໜອງ"
        subtitle="ອ້າງອີງບິນຊື້ເຂົ້າ · ຄືນບາງສ່ວນ ຫຼື ເຕັມຈຳນວນ · ຮັບເງິນຄືນສົດ / ໂອນ / ທັງສອງ"
      />

      {!lookup ? (
        <button onClick={() => setShowPicker(true)}
          className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-white py-12 text-center hover:border-red-400 hover:bg-red-50/30 transition">
          <div className="text-4xl">🧾</div>
          <div className="mt-2 font-extrabold text-slate-700">ເລືອກບິນຊື້ເຂົ້າທີ່ຈະສົ່ງຄືນ</div>
          <div className="text-xs text-slate-400 mt-1">ຄົ້ນຫາດ້ວຍ ເລກທີບິນ / ຊື່ຜູ້ສະໜອງ</div>
        </button>
      ) : (
        <div className="space-y-4">
          {/* ຫົວບິນ */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">ບິນຊື້ເຂົ້າ</div>
              <div className="text-lg font-extrabold text-slate-900">
                {lookup.purchase.ref_number || lookup.purchase.sml_doc_no || `#${lookup.purchase.id}`}
              </div>
              <div className="text-xs text-slate-500">
                {lookup.purchase.supplier_name || '—'} · {fmtDateTime(lookup.purchase.created_at)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">ຍອດບິນ</div>
              <div className="font-mono text-lg font-extrabold text-slate-900">{fmtPrice(lookup.purchase.total)}</div>
              <div className="text-[11px] text-slate-500">
                ຊຳລະແລ້ວ {fmtPrice(lookup.debt.paid)} · ຄ້າງ <b className={lookup.debt.remaining > 0 ? 'text-amber-700' : 'text-emerald-700'}>{fmtPrice(lookup.debt.remaining)}</b>
              </div>
            </div>
            <button onClick={() => { setLookup(null); setQty({}); }}
              className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100">ປ່ຽນບິນ</button>
          </div>

          {lookup.pricing?.discounted && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] font-bold text-amber-800">
              ⚠ ບິນນີ້ມີສ່ວນຫຼຸດ {fmtPrice(lookup.pricing.total_discount)} — ຍອດຄືນຄິດຕາມລາຄາຫຼັງຫຼຸດ ບໍ່ແມ່ນລາຄາເຕັມ
            </div>
          )}

          {/* ລາຍການ */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
              ເລືອກຈຳນວນທີ່ຈະສົ່ງຄືນ
            </div>
            <div className="divide-y divide-slate-100">
              {lookup.items.map((it, idx) => {
                const max = Math.min(Number(it.returnable_qty) || 0, Number(it.qty_on_hand) || 0);
                const hardMax = Number(it.returnable_qty) || 0;
                const val = Number(qty[it.purchase_item_id]) || 0;
                const setQ = (n) => setQty({ ...qty, [it.purchase_item_id]: Math.max(0, Math.min(hardMax, n)) });
                const isSelected = val > 0;
                const short = val > Number(it.qty_on_hand || 0);
                return (
                  <div key={it.purchase_item_id} className={`p-3 ${isSelected ? 'bg-red-50/40' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${isSelected ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-slate-900 text-sm">{it.product_name || `#${it.product_id}`}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          <span>{it.product_code}</span>
                          <span>ຮັບເຂົ້າ <b className="text-slate-700">{fmtNum(it.bought_qty)}</b> {it.unit}</span>
                          {Number(it.returned_qty) > 0 && <span>ຄືນແລ້ວ <b className="text-amber-600">{fmtNum(it.returned_qty)}</b></span>}
                          <span>ຄືນໄດ້ <b className="text-emerald-600">{fmtNum(it.returnable_qty)}</b></span>
                          <span className="text-slate-300">·</span>
                          <span>ໃນສາງ <b className={Number(it.qty_on_hand) <= 0 ? 'text-rose-600' : 'text-slate-700'}>{fmtNum(it.qty_on_hand)}</b></span>
                          <span className="text-slate-300">·</span>
                          {netPriceOf(it) < Number(it.cost_price || 0) - 0.5 ? (
                            <span>
                              ຕົ້ນທຶນ <b className="text-slate-400 line-through font-mono">{fmtNum(it.cost_price)}</b>
                              {' → '}<b className="text-emerald-700 font-mono">{fmtNum(netPriceOf(it))}</b> ₭
                            </span>
                          ) : (
                            <span>ຕົ້ນທຶນ <b className="text-slate-700 font-mono">{fmtNum(it.cost_price)}</b> ₭</span>
                          )}
                        </div>
                        {short && <div className="mt-1 text-[11px] font-bold text-rose-600">⚠ ສະຕັອກໃນສາງບໍ່ພຽງພໍ ({fmtNum(it.qty_on_hand)})</div>}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className={`font-mono text-base font-extrabold ${isSelected ? 'text-red-700' : 'text-slate-300'}`}>
                          {fmtPrice(val * netPriceOf(it))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 ml-11">
                      <div className="flex items-stretch rounded-lg border border-slate-200 overflow-hidden">
                        <button type="button" onClick={() => setQ(val - 1)} disabled={val <= 0}
                          className="w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-30 text-base font-extrabold">−</button>
                        <input type="number" min="0" max={hardMax} value={qty[it.purchase_item_id] || ''}
                          onChange={e => setQ(Number(e.target.value) || 0)} placeholder="0"
                          className="w-16 h-9 text-center font-mono font-bold text-slate-800 outline-none border-x border-slate-200" />
                        <button type="button" onClick={() => setQ(val + 1)} disabled={val >= hardMax}
                          className="w-9 h-9 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-30 text-base font-extrabold">+</button>
                      </div>
                      <button type="button" onClick={() => setQ(max)} disabled={max <= 0}
                        className="h-9 px-3 rounded-lg bg-slate-100 hover:bg-red-100 hover:text-red-700 text-xs font-extrabold text-slate-600 disabled:opacity-30">
                        MAX
                      </button>
                      {val > 0 && (
                        <button type="button" onClick={() => setQ(0)}
                          className="h-9 px-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-xs">✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ວິທີຮັບເງິນຄືນ */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-2">ວິທີຮັບເງິນຄືນ</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSettleMode('refund')}
                  className={`rounded-lg border-2 p-3 text-left transition ${settleMode === 'refund' ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="text-sm font-extrabold text-slate-800">💰 ຮັບເງິນຄືນ</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">ຜູ້ສະໜອງຄືນເງິນ ສົດ / ໂອນ / ທັງສອງ</div>
                </button>
                <button type="button" onClick={() => setSettleMode('debt')} disabled={Number(lookup.debt.remaining) <= 0}
                  className={`rounded-lg border-2 p-3 text-left transition disabled:opacity-40 ${settleMode === 'debt' ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <div className="text-sm font-extrabold text-slate-800">🧾 ຫັກຈາກໜີ້ຄ້າງ</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {Number(lookup.debt.remaining) > 0 ? `ຄ້າງຢູ່ ${fmtPrice(lookup.debt.remaining)}` : 'ບິນນີ້ຊຳລະຄົບແລ້ວ'}
                  </div>
                </button>
              </div>
            </div>

            {settleMode === 'refund' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">ແບ່ງຍອດຮັບຄືນ</div>
                  <button type="button" onClick={() => setAmounts({ cash: String(refundTotal), transfer: '' })}
                    className="text-[11px] font-extrabold text-red-600 hover:underline">ສົດທັງໝົດ</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map(m => (
                    <div key={m.key}>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">{m.icon} {m.label}</label>
                      <div className="relative">
                        <input type="number" min="0" value={amounts[m.key]}
                          onChange={e => setAmounts({ ...amounts, [m.key]: e.target.value })}
                          placeholder="0"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-8 text-sm font-mono font-bold text-right outline-none focus:border-red-400" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₭</span>
                      </div>
                    </div>
                  ))}
                </div>
                {refundTotal > 0 && (
                  <div className={`mt-1.5 text-[11px] font-bold ${remainingToAllocate === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {remainingToAllocate === 0
                      ? '✓ ຍອດຕົງກັນແລ້ວ'
                      : remainingToAllocate > 0
                        ? `ຍັງເຫຼືອ ${fmtPrice(remainingToAllocate)} (ວ່າງໄວ້ = ຮັບສົດທັງໝົດ)`
                        : `ເກີນມາ ${fmtPrice(-remainingToAllocate)}`}
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5">ໝາຍເຫດ / ເຫດຜົນ</div>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="ສິນຄ້າຊຳລຸດ, ສົ່ງຜິດລຸ້ນ, ໝົດອາຍຸ..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-red-400 resize-none" />
            </div>
          </div>

          {/* ແຖບສະຫຼຸບ */}
          <div className="sticky bottom-0 z-10 rounded-xl border-2 border-red-500 bg-gradient-to-r from-red-600 to-red-700 p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div className="text-white">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-red-100">
                  {settleMode === 'debt' ? 'ຍອດຫັກຈາກໜີ້ຄ້າງ' : 'ຍອດຕ້ອງໄດ້ຮັບຄືນ'}
                </div>
                <div className="mt-0.5 text-3xl font-extrabold font-mono tracking-tight">{fmtPrice(refundTotal)}</div>
                <div className="text-[11px] font-bold text-red-200 mt-0.5">
                  {totalItemsCount > 0 ? `${fmtNum(totalItemsCount)} ຊິ້ນ · ${selectedItems.length} ລາຍການ` : 'ຍັງບໍ່ໄດ້ເລືອກສິນຄ້າ'}
                </div>
                {billDiscount > 0 && (
                  <div className="mt-1 text-[11px] font-mono text-red-100">
                    <div>ມູນຄ່າຕາມລາຄາເຕັມ {fmtPrice(grossTotal)}</div>
                    <div>− ສ່ວນຫຼຸດຕາມບິນຊື້ {fmtPrice(billDiscount)}</div>
                  </div>
                )}
              </div>
              {perm.edit && (
                <button onClick={submit} disabled={saving || refundTotal <= 0 || stockShort.length > 0}
                  className="rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-red-700 shadow-lg hover:bg-red-50 disabled:bg-red-500 disabled:text-red-200 disabled:cursor-not-allowed transition">
                  {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກສົ່ງຄືນ'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ປະຫວັດ */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-extrabold text-slate-800 text-sm">
          ປະຫວັດການສົ່ງຄືນ ({returns.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold text-slate-600">ເລກທີ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ວັນທີ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ບິນຊື້</th>
                <th className="px-3 py-2 font-bold text-slate-600">ຜູ້ສະໜອງ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ລາຍການ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ວິທີ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ຍອດຄືນ</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {returns.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">ຍັງບໍ່ມີການສົ່ງຄືນ</td></tr>
              ) : returns.map(r => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono font-bold">{r.return_number}</td>
                  <td className="px-3 py-2 font-mono text-slate-600">{fmtDateTime(r.created_at)}</td>
                  <td className="px-3 py-2 font-mono">{r.ref_number || r.sml_doc_no || `#${r.purchase_id}`}</td>
                  <td className="px-3 py-2">{r.supplier_name || '—'}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {(r.items || []).length} ລາຍການ · {fmtNum((r.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0))} ຊິ້ນ
                  </td>
                  <td className="px-3 py-2">
                    {r.settle_mode === 'debt' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">ຫັກໜີ້</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {(r.payments || []).map(p => `${p.method === 'cash' ? 'ສົດ' : 'ໂອນ'} ${fmtNum(p.amount)}`).join(' + ') || 'ຮັບເງິນຄືນ'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-extrabold text-red-700">{fmtPrice(r.refund_amount)}</td>
                  <td className="px-3 py-2 text-right">
                    {perm.delete && (
                      <button onClick={() => removeReturn(r)}
                        className="px-2 py-1 rounded text-[11px] font-bold text-rose-600 hover:bg-rose-50">ຍົກເລີກ</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ຕົວເລືອກບິນ */}
      {showPicker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-16" onClick={() => setShowPicker(false)}>
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
              <input autoFocus value={pickerQuery} onChange={e => setPickerQuery(e.target.value)}
                placeholder="ຄົ້ນຫາ ເລກທີບິນຊື້ / ຊື່ຜູ້ສະໜອງ..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-400" />
              <button onClick={() => setPickerFilter(pickerFilter === 'returnable' ? 'all' : 'returnable')}
                className={`px-3 py-2 rounded-lg text-xs font-bold ${pickerFilter === 'returnable' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {pickerFilter === 'returnable' ? 'ສະເພາະທີ່ຄືນໄດ້' : 'ທັງໝົດ'}
              </button>
              <button onClick={() => setShowPicker(false)} className="text-slate-400 hover:text-slate-700 text-xl px-2">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {filteredPicker.length === 0 ? (
                <div className="px-4 py-12 text-center text-slate-400 text-sm">ບໍ່ພົບບິນ</div>
              ) : filteredPicker.map(p => (
                <button key={p.id} onClick={() => selectPurchase(p.id)}
                  className="w-full text-left px-4 py-3 hover:bg-red-50/40 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-extrabold text-slate-900 text-sm">{p.ref_number || p.sml_doc_no || `#${p.id}`}</div>
                    <div className="text-[11px] text-slate-500">
                      {p.supplier_name || '—'} · {fmtDateTime(p.created_at)} · ຮັບເຂົ້າ {fmtNum(p.bought_qty)}
                      {Number(p.returned_qty) > 0 && <span className="text-amber-600"> · ຄືນແລ້ວ {fmtNum(p.returned_qty)}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-extrabold text-slate-900">{fmtPrice(p.total)}</div>
                    <div className="text-[11px] text-emerald-600 font-bold">ຄືນໄດ້ {fmtNum(p.returnable_qty)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-center text-sm text-slate-400">ກຳລັງໂຫຼດ...</div>}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full shadow-2xl text-sm font-semibold z-50 ${toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ໃບສົ່ງຄືນ A5 — ພິມໃຫ້ຜູ້ສະໜອງເຊັນຮັບ
function printReturnDoc(ret) {
  const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const money = n => `${new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0))} ₭`;
  const rows = (ret.items || []).map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(it.product_name || it.product_id)}</td>
      <td class="right">${new Intl.NumberFormat('lo-LA').format(Number(it.quantity) || 0)}</td>
      <td class="right">${money(it.net_price ?? it.cost_price)}</td>
      <td class="right">${money(it.amount)}</td>
    </tr>`).join('');
  const settle = ret.settle_mode === 'debt'
    ? 'ຫັກຈາກໜີ້ຄ້າງ'
    : (ret.payments || []).map(p => `${p.method === 'cash' ? 'ເງິນສົດ' : 'ໂອນ'} ${money(p.amount)}`).join(' + ') || 'ຮັບເງິນຄືນ';

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>ໃບສົ່ງຄືນ ${esc(ret.return_number)}</title>
  <style>
    @page { size: A5 portrait; margin: 8mm }
    * { box-sizing: border-box; font-family: 'Noto Sans Lao','Phetsarath OT',system-ui,sans-serif }
    body { margin: 0; color: #111; font-size: 11px; -webkit-print-color-adjust: exact; print-color-adjust: exact }
    h1 { margin: 0; font-size: 18px; font-weight: 900; color: #b91c1c }
    header { display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px }
    .meta { font-size: 10px; color: #444 }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 10px }
    table { width: 100%; border-collapse: collapse; margin-top: 6px }
    th { background: #111; color: #fff; padding: 5px 6px; font-size: 10px; text-align: left }
    td { padding: 5px 6px; border-bottom: 1px solid #e5e7eb; font-size: 10px }
    .right { text-align: right; font-variant-numeric: tabular-nums }
    .total { margin-left: auto; width: 240px; margin-top: 10px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden }
    .total .row { display: flex; justify-content: space-between; padding: 6px 10px; font-size: 11px }
    .total .grand { background: #fef2f2; color: #991b1b; font-weight: 900; font-size: 13px; border-top: 2px solid #fca5a5 }
    .sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 28px }
    .sign .box2 { text-align: center; font-size: 9px; color: #475569 }
    .sign .name { font-weight: 700; color: #334155 }
    .sign .line { margin-top: 4px; height: 26px; border-bottom: 1px solid #94a3b8 }
  </style></head><body>
    <header>
      <div><h1>ໃບສົ່ງເຄື່ອງຄືນຜູ້ສະໜອງ</h1><div class="meta">Purchase Return / Debit Note</div></div>
      <div style="text-align:right">
        <div class="meta"><b>ເລກທີ:</b> ${esc(ret.return_number)}</div>
        <div class="meta"><b>ວັນທີ:</b> ${new Date().toLocaleDateString('en-GB')}</div>
      </div>
    </header>
    <div class="box">
      <div><b>ຜູ້ສະໜອງ:</b> ${esc(ret.supplier_name || '—')}</div>
      <div><b>ອ້າງອີງບິນຊື້:</b> ${esc(ret.ref_number || ret.purchase_id)}</div>
      <div><b>ວິທີຮັບຄືນ:</b> ${esc(settle)}</div>
      ${ret.note ? `<div><b>ໝາຍເຫດ:</b> ${esc(ret.note)}</div>` : ''}
    </div>
    <table>
      <thead><tr><th>#</th><th>ສິນຄ້າ</th><th class="right">ຈຳນວນ</th><th class="right">ລາຄາ</th><th class="right">ລວມ</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="total">
      ${Number(ret.discount_amount) > 0 ? `<div class="row"><span>ມູນຄ່າຕາມລາຄາເຕັມ</span><span>${money(ret.gross_amount)}</span></div>
      <div class="row"><span>ຫັກສ່ວນຫຼຸດຕາມບິນຊື້</span><span>−${money(ret.discount_amount)}</span></div>` : ''}
      <div class="row grand"><span>ຍອດຄືນ</span><span>${money(ret.refund_amount)}</span></div>
    </div>
    <div class="sign">
      <div class="box2"><div class="name">ຜູ້ສົ່ງສິນຄ້າ</div><div class="line"></div></div>
      <div class="box2"><div class="name">ຜູ້ຮັບສິນຄ້າ</div><div class="line"></div></div>
      <div class="box2"><div class="name">ບັນຊີ</div><div class="line"></div></div>
    </div>
    <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 400) }</script>
  </body></html>`;

  const win = window.open('', '_blank', 'width=760,height=900');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
