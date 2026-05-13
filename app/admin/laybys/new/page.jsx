'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;

export default function NewLaybyPage() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    fetch(`${API}/admin/products`).then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []));
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

  const subtotal = items.reduce((s, it) => s + it.quantity * it.price, 0);
  const total = Math.max(0, subtotal - Number(discount));
  const balance = Math.max(0, total - Number(deposit));

  const addItem = (p) => {
    setItems(prev => {
      const ex = prev.find(it => it.product_id === p.id);
      if (ex) return prev.map(it => it === ex ? { ...it, quantity: it.quantity + 1 } : it);
      return [...prev, { product_id: p.id, name: p.product_name, code: p.product_code, price: Number(p.selling_price) || 0, quantity: 1, stock: p.qty_on_hand }];
    });
    setSearch('');
  };

  const setQty = (pid, qty) => {
    setItems(prev => prev.map(it => it.product_id === pid ? { ...it, quantity: Math.max(0, Number(qty) || 0) } : it).filter(it => it.quantity > 0));
  };

  const setPrice = (pid, price) => {
    setItems(prev => prev.map(it => it.product_id === pid ? { ...it, price: Math.max(0, Number(price) || 0) } : it));
  };

  const submit = async () => {
    if (!customerName.trim()) { showToast('ກະຣຸນາໃສ່ຊື່ລູກຄ້າ', 'error'); return; }
    if (items.length === 0) { showToast('ກະຣຸນາເພີ່ມສິນຄ້າ', 'error'); return; }
    if (Number(deposit) <= 0) { showToast('ມັດຈຳຕ້ອງ > 0', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/laybys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim() || null,
          items: items.map(it => ({ product_id: it.product_id, quantity: it.quantity, price: it.price })),
          discount: Number(discount),
          deposit: Number(deposit),
          due_date: dueDate || null,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('ສ້າງ Layby ສຳເລັດ');
        router.push(`/admin/laybys/${data.id}`);
      } else {
        showToast(data.error || 'ບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ບໍ່ສຳເລັດ', 'error');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <Link href="/admin/laybys" className="text-sm text-slate-500 hover:text-slate-900">← ກັບ Layby</Link>
      <h1 className="text-2xl font-bold text-slate-900">➕ ສ້າງ Layby ໃໝ່</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div className="space-y-4">
          {/* Customer */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3">
            <h2 className="font-bold text-slate-900">ລູກຄ້າ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="ຊື່ລູກຄ້າ *"
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="ເບີໂທ"
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>

          {/* Products */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3">
            <h2 className="font-bold text-slate-900">ສິນຄ້າ</h2>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ຄົ້ນຫາ barcode / ຊື່ / ລະຫັດ..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            {filtered.length > 0 && (
              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                {filtered.map(p => (
                  <button key={p.id} type="button" onClick={() => addItem(p)}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                    <div className="text-sm font-bold text-slate-900">{p.product_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{p.product_code} · {fmtPrice(p.selling_price)} · ມີ {fmtNum(p.qty_on_hand)}</div>
                  </button>
                ))}
              </div>
            )}
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">ສິນຄ້າ</th><th className="text-right">ຈຳນວນ</th><th className="text-right">ລາຄາ</th><th className="text-right">ລວມ</th><th></th></tr></thead>
              <tbody>
                {items.map(it => (
                  <tr key={it.product_id} className="border-t border-slate-100">
                    <td className="py-1.5 font-bold">{it.name}</td>
                    <td className="text-right"><input type="number" min="1" value={it.quantity} onChange={e => setQty(it.product_id, e.target.value)} className="w-16 px-2 py-1 border border-slate-200 rounded text-right text-sm" /></td>
                    <td className="text-right"><input type="number" min="0" value={it.price} onChange={e => setPrice(it.product_id, e.target.value)} className="w-24 px-2 py-1 border border-slate-200 rounded text-right text-sm font-mono" /></td>
                    <td className="text-right font-mono font-bold">{fmtPrice(it.quantity * it.price)}</td>
                    <td className="text-right"><button onClick={() => setQty(it.product_id, 0)} className="text-rose-600 hover:bg-rose-50 px-2 rounded">✕</button></td>
                  </tr>
                ))}
                {items.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-400 text-xs">ບໍ່ມີສິນຄ້າ</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3 sticky top-4">
            <h2 className="font-bold text-slate-900">ສະຫຼຸບ</h2>
            <div className="flex justify-between text-sm"><span>ລວມຍ່ອຍ</span><span className="font-mono">{fmtPrice(subtotal)}</span></div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ສ່ວນຫຼຸດ</label>
              <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-right" />
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-3"><span>ລວມທັງໝົດ</span><span className="font-mono text-red-600">{fmtPrice(total)}</span></div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ມັດຈຳ *</label>
              <input type="number" min="0" max={total} value={deposit} onChange={e => setDeposit(e.target.value)}
                className="w-full px-3 py-2 border border-emerald-300 bg-emerald-50/30 rounded-lg text-sm font-mono font-bold text-right" />
              <div className="flex gap-1 mt-1">
                {[25, 50, 75].map(p => (
                  <button key={p} type="button" onClick={() => setDeposit(Math.round(total * p / 100))}
                    className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[10px] font-bold">{p}%</button>
                ))}
              </div>
            </div>
            <div className="flex justify-between font-bold"><span className="text-amber-700">ຄ້າງຊຳລະ</span><span className="font-mono text-amber-700">{fmtPrice(balance)}</span></div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ກຳນົດຮັບເຄື່ອງ</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">ໝາຍເຫດ</label>
              <input value={note} onChange={e => setNote(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <button onClick={submit} disabled={saving || items.length === 0 || !customerName.trim()}
              className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-extrabold">
              {saving ? 'ກຳລັງສ້າງ...' : '✓ ສ້າງ Layby'}
            </button>
            <div className="text-[10px] text-slate-500 text-center">ສິນຄ້າຈະຖືກສະຫງວນອອກຈາກສະຕັອກທັນທີ</div>
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
