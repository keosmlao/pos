'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;

const emptyForm = {
  variant_name: '',
  variant_code: '',
  barcode: '',
  selling_price: '',
  cost_price: '',
  qty_on_hand: 0,
  active: true,
  sort_order: 0,
};

export default function VariantsPage({ params }) {
  const { id } = use(params);
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, vRes] = await Promise.all([
        fetch(`${API}/admin/products`).then(r => r.json()),
        fetch(`${API}/admin/products/${id}/variants`).then(r => r.json()),
      ]);
      const list = Array.isArray(pRes) ? pRes : (pRes?.products || []);
      setProduct(list.find(p => Number(p.id) === Number(id)) || null);
      setVariants(Array.isArray(vRes) ? vRes : []);
    } catch {
      setVariants([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const reset = () => { setForm(emptyForm); setEditingId(null); };

  const save = async () => {
    if (!form.variant_name.trim()) { showToast('ກະລຸນາໃສ່ຊື່ variant', 'error'); return; }
    const url = editingId
      ? `${API}/admin/products/${id}/variants/${editingId}`
      : `${API}/admin/products/${id}/variants`;
    const method = editingId ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(editingId ? 'ອັບເດດສຳເລັດ' : 'ເພີ່ມສຳເລັດ');
        reset();
        load();
      } else {
        showToast(data.error || 'ບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ບໍ່ສຳເລັດ', 'error');
    }
  };

  const edit = (v) => {
    setForm({
      variant_name: v.variant_name || '',
      variant_code: v.variant_code || '',
      barcode: v.barcode || '',
      selling_price: v.selling_price != null ? v.selling_price : '',
      cost_price: v.cost_price != null ? v.cost_price : '',
      qty_on_hand: v.qty_on_hand || 0,
      active: v.active !== false,
      sort_order: v.sort_order || 0,
    });
    setEditingId(v.id);
  };

  const remove = async (v) => {
    if (!confirm(`ລົບ "${v.variant_name}"?`)) return;
    try {
      const res = await fetch(`${API}/admin/products/${id}/variants/${v.id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('ລົບສຳເລັດ');
        if (editingId === v.id) reset();
        load();
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d.error || 'ລົບບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ລົບບໍ່ສຳເລັດ', 'error');
    }
  };

  const fieldCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500";

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/products" className="text-slate-500 hover:text-slate-900 text-sm">← ກັບສິນຄ້າ</Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">🎨 ລາຍລະອຽດສິນຄ້າ (Variants)</h1>
        {product && (
          <div className="mt-1 text-sm text-slate-500">
            <b className="text-slate-900">{product.product_name}</b>
            {product.product_code && <span className="ml-2 font-mono text-xs">{product.product_code}</span>}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <h2 className="font-bold text-slate-900 mb-3">{editingId ? '✏️ ແກ້ໄຂ Variant' : '➕ ເພີ່ມ Variant ໃໝ່'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">ຊື່ Variant *</label>
            <input
              type="text"
              value={form.variant_name}
              onChange={e => setForm(f => ({ ...f, variant_name: e.target.value }))}
              placeholder="ເຊັ່ນ: ສີແດງ / Size M / ລົດຊາດກາເຟ"
              className={fieldCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ລະຫັດ Variant</label>
            <input
              type="text"
              value={form.variant_code}
              onChange={e => setForm(f => ({ ...f, variant_code: e.target.value }))}
              placeholder="SKU"
              className={fieldCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode</label>
            <input
              type="text"
              value={form.barcode}
              onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
              placeholder="ບໍ່ກຳນົດ = ໃຊ້ barcode ຫຼັກ"
              className={`${fieldCls} font-mono`}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ລາຄາຂາຍ (₭)</label>
            <input
              type="number"
              value={form.selling_price}
              onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))}
              placeholder={product?.selling_price ? `default: ${product.selling_price}` : ''}
              className={fieldCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ຕົ້ນທຶນ (₭)</label>
            <input
              type="number"
              value={form.cost_price}
              onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))}
              placeholder={product?.cost_price ? `default: ${product.cost_price}` : ''}
              className={fieldCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ຈຳນວນ</label>
            <input
              type="number"
              value={form.qty_on_hand}
              onChange={e => setForm(f => ({ ...f, qty_on_hand: e.target.value }))}
              className={fieldCls}
            />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 cursor-pointer h-10 px-3 bg-slate-50 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                className="accent-emerald-500"
              />
              <span className="text-xs font-bold text-slate-700">ເປີດໃຊ້ງານ</span>
            </label>
          </div>
        </div>
        <div className="mt-4 flex gap-2 justify-end">
          {editingId && (
            <button onClick={reset} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold">
              ຍົກເລີກ
            </button>
          )}
          <button onClick={save} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold">
            {editingId ? '💾 ບັນທຶກ' : '➕ ເພີ່ມ'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">
          {loading ? 'ກຳລັງໂຫຼດ...' : `Variants ${variants.length} ລາຍການ`}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold text-slate-600">ຊື່</th>
                <th className="px-3 py-2 font-bold text-slate-600">ລະຫັດ</th>
                <th className="px-3 py-2 font-bold text-slate-600">Barcode</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ລາຄາ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ຕົ້ນທຶນ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ມີ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ສະຖານະ</th>
                <th className="px-3 py-2 font-bold text-slate-600"></th>
              </tr>
            </thead>
            <tbody>
              {variants.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">ຍັງບໍ່ມີ variants — ເພີ່ມຂ້າງເທິງ</td></tr>
              ) : variants.map(v => (
                <tr key={v.id} className={`border-t border-slate-100 hover:bg-slate-50 ${editingId === v.id ? 'bg-amber-50' : ''}`}>
                  <td className="px-3 py-2 font-bold">{v.variant_name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{v.variant_code || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{v.barcode || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {v.selling_price != null ? fmtPrice(v.selling_price) : <span className="text-slate-400 text-xs">default</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-amber-700">
                    {v.cost_price != null ? fmtPrice(v.cost_price) : <span className="text-slate-400 text-xs">default</span>}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono font-extrabold ${v.qty_on_hand <= 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                    {fmtNum(v.qty_on_hand)}
                  </td>
                  <td className="px-3 py-2">
                    {v.active ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">ເປີດ</span>
                              : <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded">ປິດ</span>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => edit(v)} className="px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded">ແກ້ໄຂ</button>
                    <button onClick={() => remove(v)} className="px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded">ລົບ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
