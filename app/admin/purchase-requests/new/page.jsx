'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;

export default function NewPurchaseRequestPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [reorderAlerts, setReorderAlerts] = useState([]);
  const [showReorderPicker, setShowReorderPicker] = useState(false);
  const [form, setForm] = useState({
    supplier_id: '',
    needed_by: '',
    reason: '',
    note: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    fetch(`${API}/admin/products`).then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []));
    fetch(`${API}/admin/suppliers`).then(r => r.json()).then(d => setSuppliers(Array.isArray(d) ? d : (d?.suppliers || [])));
    fetch(`${API}/admin/reorder-alerts`).then(r => r.json()).then(d => setReorderAlerts(Array.isArray(d?.items) ? d.items : []));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p =>
      (p.product_name || '').toLowerCase().includes(q) ||
      (p.product_code || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    ).slice(0, 10);
  }, [search, products]);

  const subtotal = items.reduce((s, it) => s + it.quantity * it.cost_price, 0);
  const totalQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
  const selectedSupplier = useMemo(() => suppliers.find(s => String(s.id) === String(form.supplier_id)), [suppliers, form.supplier_id]);
  const supplierReorderAlerts = useMemo(() => {
    if (!selectedSupplier?.name) return reorderAlerts;
    return reorderAlerts.filter(p => !p.supplier_name || p.supplier_name === selectedSupplier.name);
  }, [reorderAlerts, selectedSupplier]);

  const suggestedOrderQty = (p) => Math.max(1, Number(p.min_stock || 0) - Number(p.qty_on_hand || 0));

  const toRequestItem = (p, quantity = 1) => ({
    product_id: p.id, product_name: p.product_name, code: p.product_code,
    unit: p.unit || '',
    qty_on_hand: p.qty_on_hand, min_stock: p.min_stock,
    quantity, cost_price: Number(p.cost_price) || 0, note: '',
  });

  const addItem = (p, quantity = 1, note = '') => {
    setItems(prev => {
      const ex = prev.find(it => it.product_id === p.id);
      if (ex) return prev.map(it => it === ex ? { ...it, quantity: Number(it.quantity || 0) + Number(quantity || 1) } : it);
      return [...prev, { ...toRequestItem(p, quantity), note }];
    });
    setSearch('');
  };

  const addReorderItem = (p) => {
    addItem(p, suggestedOrderQty(p), 'ດຶງຈາກສິນຄ້າຄວນສັ່ງເພີ່ມ');
  };

  const addAllReorderItems = () => {
    const source = supplierReorderAlerts.filter(p => !items.some(it => it.product_id === p.id));
    if (source.length === 0) { showToast('ລາຍການຄວນສັ່ງເພີ່ມຖືກເພີ່ມແລ້ວ', 'error'); return; }
    setItems(prev => [
      ...prev,
      ...source.map(p => ({ ...toRequestItem(p, suggestedOrderQty(p)), note: 'ດຶງຈາກສິນຄ້າຄວນສັ່ງເພີ່ມ' })),
    ]);
    showToast(`ເພີ່ມຈາກສິນຄ້າຄວນສັ່ງເພີ່ມ ${source.length} ລາຍການ`);
  };

  const updateItem = (idx, key, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [key]: value } : it));
  };

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (asSubmitted) => {
    if (items.length === 0) { showToast('ກະຣຸນາເພີ່ມສິນຄ້າ', 'error'); return; }
    const cleaned = items.filter(it => Number(it.quantity) > 0);
    if (cleaned.length === 0) { showToast('ກະຣຸນາໃສ່ຈຳນວນ', 'error'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/purchase-requests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: Number(form.supplier_id) || null,
          supplier_name: selectedSupplier?.name || null,
          status: asSubmitted ? 'submitted' : 'draft',
          needed_by: form.needed_by || null,
          reason: form.reason.trim() || null,
          note: form.note.trim() || null,
          items: cleaned.map(it => ({
            product_id: it.product_id, product_name: it.product_name,
            quantity: Number(it.quantity), cost_price: Number(it.cost_price) || 0,
            note: it.note || null,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('ສ້າງສຳເລັດ');
        router.push(`/admin/purchase-requests/${data.id}`);
      } else {
        showToast(data.error || 'ບໍ່ສຳເລັດ', 'error');
      }
    } catch { showToast('ບໍ່ສຳເລັດ', 'error'); }
    setBusy(false);
  };

  const handleCancel = () => {
    const hasData = items.length > 0 || form.supplier_id || form.note || form.reason;
    if (hasData && !confirm('ຂໍ້ມູນທີ່ປ້ອນຈະຖືກລ້າງ, ຕ້ອງການຍົກເລີກບໍ?')) return;
    router.replace('/admin/purchase-requests');
  };

  const inp = "w-full px-2 py-0 h-7 bg-white border border-slate-200 rounded text-[12px] leading-none focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none transition";
  const numInp = "w-full px-1.5 py-0 h-6 bg-white border border-slate-200 rounded text-[12px] leading-none focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none transition [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const lbl = "block text-[11px] font-medium text-slate-500 mb-1";
  const card = "bg-white rounded-lg border border-slate-200";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 text-[13px] -m-3 sm:-m-4 md:-m-6">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="w-full px-4 py-2.5 flex items-center gap-3">
          <button onClick={handleCancel}
            className="text-slate-500 hover:text-slate-800 transition flex items-center gap-1 text-[12px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            ກັບຄືນ
          </button>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
            <h1 className="font-semibold text-slate-800">ໃບສະເໜີຊື້ໃໝ່</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleCancel}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md text-[12px] transition">
              ຍົກເລີກ
            </button>
            <button onClick={() => handleSubmit(false)} disabled={busy || items.length === 0}
              className="px-3 py-1.5 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-md text-[12px] font-semibold disabled:opacity-40 transition">
              💾 ບັນທຶກຮ່າງ
            </button>
            <button onClick={() => handleSubmit(true)} disabled={busy || items.length === 0}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-[12px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-1.5">
              {busy ? <div className="w-3 h-3 border border-white/50 border-t-white rounded-full animate-spin"></div> : '➤'}
              ສົ່ງຂໍອະນຸມັດ
            </button>
          </div>
        </div>
      </div>

      <div className="w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">

        {/* Left column */}
        <div className="space-y-3 min-w-0">
          {/* Supplier + meta */}
          <div className={`${card} p-3`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className={lbl}>ຜູ້ສະໜອງ (ທາງເລືອກ)</label>
                <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })} className={inp}>
                  <option value="">— ບໍ່ກຳນົດ —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {selectedSupplier && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-500">
                    {selectedSupplier.phone && <span>☎ {selectedSupplier.phone}</span>}
                    {selectedSupplier.credit_days != null && <span>⏳ ເຄຣດິດ {selectedSupplier.credit_days || 0} ວັນ</span>}
                    {selectedSupplier.contact_person && <span>👤 {selectedSupplier.contact_person}</span>}
                  </div>
                )}
              </div>

              <div>
                <label className={lbl}>ວັນທີ</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className={inp} />
              </div>
              <div>
                <label className={lbl}>ຕ້ອງການວັນທີ</label>
                <input type="date" value={form.needed_by} onChange={e => setForm({ ...form, needed_by: e.target.value })} className={inp} />
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>ເຫດຜົນ / ຄວາມຈຳເປັນ</label>
                <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                  placeholder="ເຊັ່ນ: ສິນຄ້າໝົດ / ຄຳສັ່ງລູກຄ້າ" className={inp} />
              </div>
              <div className="md:col-span-2">
                <label className={lbl}>ໝາຍເຫດ</label>
                <input type="text" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className={inp} />
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className={`${card}`}>
            <div className="px-3 py-2 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="font-semibold text-slate-700 text-[13px]">ສິນຄ້າທີ່ສະເໜີ ({items.length})</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowReorderPicker(v => !v)}
                  className={`h-7 rounded border px-2.5 text-[11px] font-semibold transition ${showReorderPicker ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  🔔 ດຶງຈາກຄວນສັ່ງ ({supplierReorderAlerts.length})
                </button>
                <div className="relative w-72">
                  <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="ຄົ້ນຫາ + ເພີ່ມ..."
                    className="w-full pl-7 pr-2 h-7 bg-white border border-slate-200 rounded text-[12px] focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none" />
                  {filtered.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-10 border border-slate-200 rounded shadow-lg max-h-60 overflow-y-auto bg-white">
                      {filtered.map(p => (
                        <button key={p.id} type="button" onClick={() => addItem(p)}
                          className="w-full text-left px-3 py-1.5 hover:bg-red-50 border-b border-slate-100 last:border-0">
                          <div className="text-[12px] font-semibold text-slate-800">{p.product_name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{p.product_code} · ມີ {fmtNum(p.qty_on_hand)} · ຕົ້ນທຶນ {fmtPrice(p.cost_price)}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {showReorderPicker && (
              <div className="border-b border-amber-200 bg-amber-50/70 px-3 py-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[12px] font-bold text-amber-900">ສິນຄ້າຄວນສັ່ງເພີ່ມ</div>
                    <div className="text-[10px] text-amber-700">
                      {selectedSupplier ? `ກອງຕາມຜູ້ສະໜອງ: ${selectedSupplier.name}` : 'ສະແດງທຸກຜູ້ສະໜອງ'}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addAllReorderItems}
                    disabled={supplierReorderAlerts.length === 0}
                    className="rounded bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700 disabled:opacity-40"
                  >
                    + ເພີ່ມທັງໝົດ
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto rounded border border-amber-200 bg-white">
                  {supplierReorderAlerts.length === 0 ? (
                    <div className="px-3 py-5 text-center text-[12px] font-semibold text-emerald-700">ບໍ່ມີສິນຄ້າຄວນສັ່ງເພີ່ມ</div>
                  ) : supplierReorderAlerts.map(p => {
                    const already = items.some(it => it.product_id === p.id);
                    return (
                      <div key={p.id} className="grid grid-cols-[1fr_auto] gap-2 border-b border-slate-100 px-3 py-2 last:border-0">
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-bold text-slate-800">{p.product_name}</div>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
                            <span className="font-mono">{p.product_code || '—'}</span>
                            <span>ມີ {fmtNum(p.qty_on_hand)} / ຂັ້ນຕ່ຳ {fmtNum(p.min_stock)}</span>
                            <span>ແນະນຳ {fmtNum(suggestedOrderQty(p))}</span>
                            {p.supplier_name && <span>{p.supplier_name}</span>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => addReorderItem(p)}
                          disabled={already}
                          className="self-center rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          {already ? 'ເພີ່ມແລ້ວ' : '+ ເພີ່ມ'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/30 text-[13px]">
                    <th className="px-2 py-1.5 text-left font-semibold text-slate-600 w-8">#</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-slate-600">ສິນຄ້າ</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-slate-600 w-20">ມີ</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-slate-600 w-24">ຈຳນວນ</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-slate-600 w-28">ຕົ້ນທຶນ</th>
                    <th className="px-2 py-1.5 text-right font-semibold text-slate-600 w-28">ມູນຄ່າ</th>
                    <th className="px-2 py-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-[12px]">ຍັງບໍ່ມີສິນຄ້າ — ໃຊ້ຊ່ອງຄົ້ນຫາຂ້າງເທິງ</td></tr>
                  ) : items.map((it, idx) => {
                    const low = Number(it.qty_on_hand || 0) <= Number(it.min_stock || 0);
                    return (
                      <tr key={`${it.product_id}-${idx}`} className="group border-b border-slate-100 hover:bg-slate-50/50 text-[13px] align-middle">
                        <td className="px-2 py-1 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-2 py-1">
                          <div className="font-semibold text-slate-800">{it.product_name}</div>
                          <div className="font-mono text-[10px] text-slate-500">{it.code}{it.unit ? ` · ${it.unit}` : ''}</div>
                        </td>
                        <td className={`px-2 py-1 text-right font-mono text-[11px] ${low ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>{fmtNum(it.qty_on_hand)}</td>
                        <td className="px-2 py-1 text-right">
                          <input type="number" min="0" value={it.quantity}
                            onChange={e => updateItem(idx, 'quantity', e.target.value)}
                            className={`${numInp} text-right font-mono`} />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <input type="number" min="0" value={it.cost_price}
                            onChange={e => updateItem(idx, 'cost_price', e.target.value)}
                            className={`${numInp} text-right font-mono`} />
                        </td>
                        <td className="px-2 py-1 text-right font-mono font-semibold text-slate-800">{fmtPrice(Number(it.quantity) * Number(it.cost_price))}</td>
                        <td className="px-2 py-1 text-right">
                          <button onClick={() => removeItem(idx)}
                            className="opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-rose-600">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column: summary */}
        <div className="space-y-3">
          <div className="rounded-lg overflow-hidden bg-white border border-slate-200">
            <div className="bg-slate-800 text-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">ສະຫຼຸບ</div>
              <div className="text-[11px] text-slate-300">ໃບສະເໜີຊື້</div>
            </div>
            <div className="p-3 space-y-2 text-[12px]">
              <div className="flex justify-between"><span className="text-slate-500">ລາຍການ</span><span className="font-mono">{items.length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">ຈຳນວນຊິ້ນ</span><span className="font-mono">{fmtNum(totalQty)}</span></div>
              <div className="bg-slate-50 rounded-md px-3 py-1.5 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">ຜູ້ສະໜອງ</span>
                <span className="font-mono">{selectedSupplier?.name || '—'}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">ມູນຄ່າປະມານ</span>
                <span className="text-[15px] font-bold font-mono text-red-700">{fmtPrice(subtotal)}</span>
              </div>
              <div className="text-[10px] text-slate-400 text-center mt-2 leading-relaxed">
                ມູນຄ່ານີ້ເປັນການຄາດໝາຍ ຕົ້ນທຶນຈິງ ຈະຍ້ອນເມື່ອປ່ຽນເປັນບີນຊື້ເຂົ້າ
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'} text-white px-5 py-2.5 rounded-full shadow-2xl z-50 text-sm font-semibold`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
