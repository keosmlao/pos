'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;

export default function NewCreditSalePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    member_id: null,
    credit_due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    discount: 0,
    note: '',
    items: [],
  });
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    fetch(`${API}/admin/products`).then(r => r.json()).then(p => setProducts(Array.isArray(p) ? p : []));
    fetch(`${API}/members`).then(r => r.json()).then(m => setMembers(Array.isArray(m) ? m : []));
  }, []);

  const subtotal = useMemo(() => form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0), [form.items]);
  const total = Math.max(0, subtotal - (Number(form.discount) || 0));

  const addItem = (product) => {
    setForm(f => {
      const exist = f.items.find(it => it.product_id === product.id);
      if (exist) {
        if (exist.quantity >= product.qty_on_hand) {
          showToast(`ສະຕ໊ອກບໍ່ພຽງພໍ (${product.qty_on_hand})`, 'error');
          return f;
        }
        return { ...f, items: f.items.map(it => it.product_id === product.id ? { ...it, quantity: it.quantity + 1 } : it) };
      }
      if (product.qty_on_hand <= 0) {
        showToast('ສິນຄ້າໝົດສະຕ໊ອກ', 'error');
        return f;
      }
      return {
        ...f,
        items: [...f.items, {
          product_id: product.id,
          product_name: product.product_name,
          quantity: 1,
          price: Number(product.selling_price) || 0,
          stock: Number(product.qty_on_hand) || 0,
        }],
      };
    });
    setShowProductPicker(false);
    setProductSearch('');
  };

  const updateItem = (idx, patch) => setForm(f => ({
    ...f,
    items: f.items.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      if (patch.quantity != null && Number(patch.quantity) > Number(it.stock || Infinity)) {
        next.quantity = it.stock;
      }
      return next;
    }),
  }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    return products.filter(p => {
      if (!q) return true;
      return [p.product_name, p.product_code, p.barcode].some(v => String(v || '').toLowerCase().includes(q));
    }).slice(0, 60);
  }, [products, productSearch]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.toLowerCase().trim();
    return members.filter(m => {
      if (!q) return true;
      return [m.name, m.phone, m.member_code].some(v => String(v || '').toLowerCase().includes(q));
    }).slice(0, 60);
  }, [members, memberSearch]);

  const selectMember = (m) => {
    setForm(f => ({
      ...f,
      member_id: m.id,
      customer_name: m.name || f.customer_name,
      customer_phone: m.phone || f.customer_phone,
    }));
    setShowMemberPicker(false);
    setMemberSearch('');
  };

  const save = async () => {
    if (!form.customer_name.trim()) { showToast('ກະລຸນາປ້ອນຊື່ລູກຄ້າ', 'error'); return; }
    if (form.items.length === 0) { showToast('ກະລຸນາເພີ່ມລາຍການ', 'error'); return; }
    if (!form.credit_due_date) { showToast('ກະລຸນາກຳນົດວັນຄົບກຳນົດຊຳລະ', 'error'); return; }
    setSaving(true);
    try {
      const body = {
        items: form.items.map(it => ({
          product_id: it.product_id,
          quantity: Number(it.quantity) || 0,
          price: Number(it.price) || 0,
        })),
        total,
        discount: Number(form.discount) || 0,
        payment_method: 'credit',
        amount_paid: 0,
        change_amount: 0,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || null,
        credit_due_date: form.credit_due_date,
        member_id: form.member_id || null,
        note: form.note.trim() || null,
      };
      const res = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'ບັນທຶກບໍ່ສຳເລັດ', 'error'); return; }
      showToast(`ສ້າງບິນຂາຍຕິດໜີ້ສຳເລັດ: ${data.bill_number || '#' + data.id}`);
      setTimeout(() => router.push('/admin/customer-debts'), 1000);
    } catch {
      showToast('ບັນທຶກບໍ່ສຳເລັດ', 'error');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 text-[13px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/customer-debts" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">← ກັບ</Link>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">🧾 ສ້າງບິນຂາຍຕິດໜີ້</h1>
            <p className="text-xs text-slate-500 mt-0.5">ສ້າງບິນຂາຍຕິດໜີ້ໂດຍກົງ — ຫັກສະຕ໊ອກ + ບັນທຶກໜີ້ລູກຄ້າ</p>
          </div>
        </div>
        <button onClick={save} disabled={saving || form.items.length === 0}
          className="rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white px-4 py-2 text-sm font-extrabold">
          {saving ? 'ກຳລັງບັນທຶກ...' : '✓ ບັນທຶກບິນຕິດໜີ້'}
        </button>
      </div>

      {/* Customer */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-800">ຂໍ້ມູນລູກຄ້າ</h2>
          <button onClick={() => setShowMemberPicker(true)} type="button"
            className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-1.5 text-xs font-bold">
            {form.member_id ? '🧑 ປ່ຽນສະມາຊິກ' : '🧑 ເລືອກສະມາຊິກ'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">ຊື່ລູກຄ້າ *</label>
            <input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">ເບີໂທ</label>
            <input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">ວັນຄົບກຳນົດຊຳລະ *</label>
            <input type="date" value={form.credit_due_date} onChange={e => setForm({ ...form, credit_due_date: e.target.value })}
              className="w-full px-3 py-2 border border-amber-300 bg-amber-50 rounded-lg text-sm font-bold" />
          </div>
        </div>
      </section>

      {/* Items */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-800">ລາຍການສິນຄ້າ</h2>
          <button onClick={() => setShowProductPicker(true)} type="button"
            className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 text-xs font-bold">+ ສິນຄ້າ</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-3 py-2">#</th>
                <th className="px-3 py-2">ສິນຄ້າ</th>
                <th className="w-28 px-3 py-2 text-right">ຈຳນວນ</th>
                <th className="w-32 px-3 py-2 text-right">ລາຄາ</th>
                <th className="w-32 px-3 py-2 text-right">ລວມ</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {form.items.map((it, i) => {
                const amount = (Number(it.quantity) || 0) * (Number(it.price) || 0);
                return (
                  <tr key={i}>
                    <td className="px-3 py-2 text-slate-400 font-mono text-xs">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-bold text-slate-800">{it.product_name}</div>
                      <div className="text-[10px] text-slate-400">ສະຕ໊ອກ {fmtNum(it.stock)}</div>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="1" max={it.stock} step="1" value={it.quantity}
                        onChange={e => updateItem(i, { quantity: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-right text-sm font-mono font-bold" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" step="any" value={it.price}
                        onChange={e => updateItem(i, { price: e.target.value })}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-right text-sm font-mono font-bold" />
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-extrabold text-slate-800">{fmtPrice(amount)}</td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => removeItem(i)} className="text-slate-400 hover:text-rose-600 text-sm">✕</button>
                    </td>
                  </tr>
                );
              })}
              {form.items.length === 0 && (
                <tr><td colSpan="6" className="py-10 text-center text-slate-400">ຍັງບໍ່ມີລາຍການ — ກົດ "+ ສິນຄ້າ" ເພື່ອເພີ່ມ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Totals + note */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4">
        <div>
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">ໝາຍເຫດ</label>
          <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
            rows={4}
            placeholder="ເງື່ອນໄຂການຊຳລະ, ໝາຍເລກຕິດຕໍ່..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" />
        </div>
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex justify-between px-3 py-2 bg-slate-50">
            <span className="text-xs font-bold text-slate-600">ລວມຍ່ອຍ</span>
            <span className="font-mono font-extrabold text-slate-800">{fmtPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center px-3 py-2 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-600">ສ່ວນຫຼຸດ</span>
            <input type="number" min="0" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })}
              className="w-32 px-2 py-1 border border-slate-200 rounded text-right text-sm font-mono font-bold text-amber-700" />
          </div>
          <div className="flex justify-between px-3 py-3 bg-amber-50 border-t-2 border-amber-200">
            <span className="text-sm font-extrabold text-amber-700">ຍອດຄ້າງຊຳລະ</span>
            <span className="font-mono text-xl font-extrabold text-amber-700">{fmtPrice(total)}</span>
          </div>
        </div>
      </section>

      {/* Product picker */}
      {showProductPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowProductPicker(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">ເລືອກສິນຄ້າ</h3>
              <button onClick={() => setShowProductPicker(false)} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded">✕</button>
            </div>
            <div className="p-3 border-b border-slate-100">
              <input value={productSearch} onChange={e => setProductSearch(e.target.value)} autoFocus
                placeholder="ຄົ້ນຫາ ຊື່, ລະຫັດ, barcode..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredProducts.map(p => (
                <button key={p.id} onClick={() => addItem(p)}
                  disabled={p.qty_on_hand <= 0}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-800 truncate">{p.product_name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {p.product_code || '—'} · ສະຕ໊ອກ <b className={p.qty_on_hand > 0 ? 'text-emerald-600' : 'text-rose-600'}>{fmtNum(p.qty_on_hand)}</b>
                    </div>
                  </div>
                  <div className="font-mono font-extrabold text-slate-800">{fmtPrice(p.selling_price)}</div>
                </button>
              ))}
              {filteredProducts.length === 0 && <div className="py-10 text-center text-slate-400">ບໍ່ພົບສິນຄ້າ</div>}
            </div>
          </div>
        </div>
      )}

      {/* Member picker */}
      {showMemberPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowMemberPicker(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">ເລືອກສະມາຊິກ</h3>
              <button onClick={() => setShowMemberPicker(false)} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded">✕</button>
            </div>
            <div className="p-3 border-b border-slate-100">
              <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} autoFocus
                placeholder="ຄົ້ນຫາ ຊື່, ເບີໂທ, ລະຫັດ..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredMembers.map(m => (
                <button key={m.id} onClick={() => selectMember(m)}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-50">
                  <div className="font-bold text-slate-800">{m.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{m.member_code} · {m.phone || '—'}</div>
                </button>
              ))}
              {filteredMembers.length === 0 && <div className="py-10 text-center text-slate-400">ບໍ່ພົບສະມາຊິກ</div>}
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
