'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));

export default function NewTransferPage() {
  const router = useRouter();
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    fetch(`${API}/admin/branches`).then(r => r.json()).then(d => setBranches(Array.isArray(d) ? d : []));
    fetch(`${API}/admin/products`).then(r => r.json()).then(d => setProducts(Array.isArray(d) ? d : []));
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products.filter(p =>
      (p.product_name || '').toLowerCase().includes(q) ||
      (p.product_code || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    ).slice(0, 10);
  }, [search, products]);

  const addItem = (p) => {
    setItems(prev => {
      const ex = prev.find(it => it.product_id === p.id);
      if (ex) return prev.map(it => it === ex ? { ...it, quantity: it.quantity + 1 } : it);
      return [...prev, { product_id: p.id, name: p.product_name, code: p.product_code, quantity: 1, stock: p.qty_on_hand }];
    });
    setSearch('');
  };

  const setQty = (pid, qty) => {
    setItems(prev => prev.map(it => it.product_id === pid ? { ...it, quantity: Math.max(0, Number(qty) || 0) } : it).filter(it => it.quantity > 0));
  };

  const submit = async () => {
    if (!fromId || !toId) { showToast('ກະຣຸນາເລືອກສາຂາຕົ້ນທາງ ແລະ ປາຍທາງ', 'error'); return; }
    if (fromId === toId) { showToast('ສາຂາຕົ້ນທາງ ແລະ ປາຍທາງ ຕ້ອງຕ່າງກັນ', 'error'); return; }
    if (items.length === 0) { showToast('ກະຣຸນາເພີ່ມສິນຄ້າ', 'error'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/stock-transfers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_branch_id: Number(fromId), to_branch_id: Number(toId),
          note: note.trim() || null,
          items: items.map(it => ({ product_id: it.product_id, quantity: it.quantity })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('ສ້າງສຳເລັດ');
        router.push(`/admin/stock-transfers/${data.id}`);
      } else {
        showToast(data.error || 'ບໍ່ສຳເລັດ', 'error');
      }
    } catch { showToast('ບໍ່ສຳເລັດ', 'error'); }
    setBusy(false);
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href="/admin/stock-transfers" className="text-sm text-slate-500 hover:text-slate-900">← ກັບ Transfers</Link>
      <h1 className="text-2xl font-bold text-slate-900">➕ ໂອນສິນຄ້າຣະຫວ່າງສາຂາ</h1>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ສາຂາຕົ້ນທາງ</label>
            <select value={fromId} onChange={e => setFromId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
              <option value="">— ເລືອກ —</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ສາຂາປາຍທາງ</label>
            <select value={toId} onChange={e => setToId(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
              <option value="">— ເລືອກ —</option>
              {branches.filter(b => String(b.id) !== String(fromId)).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">ໝາຍເຫດ</label>
          <input value={note} onChange={e => setNote(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3">
        <h2 className="font-bold text-slate-900">ສິນຄ້າ</h2>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ຄົ້ນຫາ barcode / ຊື່ / ລະຫັດ..."
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        {filteredProducts.length > 0 && (
          <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
            {filteredProducts.map(p => (
              <button key={p.id} onClick={() => addItem(p)} className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                <div className="text-sm font-bold">{p.product_name}</div>
                <div className="text-[11px] text-slate-500 font-mono">{p.product_code} · ມີ {fmtNum(p.qty_on_hand)}</div>
              </button>
            ))}
          </div>
        )}
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">ສິນຄ້າ</th><th className="text-right">ຈຳນວນ</th><th></th></tr></thead>
          <tbody>
            {items.map(it => (
              <tr key={it.product_id} className="border-t border-slate-100">
                <td className="py-1.5 font-bold">{it.name} <span className="text-[10px] text-slate-500 font-mono">{it.code}</span></td>
                <td className="text-right"><input type="number" min="1" value={it.quantity} onChange={e => setQty(it.product_id, e.target.value)} className="w-20 px-2 py-1 border border-slate-200 rounded text-right text-sm font-mono" /></td>
                <td className="text-right"><button onClick={() => setQty(it.product_id, 0)} className="text-rose-600 px-2 rounded">✕</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-slate-400 text-xs">ບໍ່ມີສິນຄ້າ</td></tr>}
          </tbody>
        </table>
      </div>

      <button onClick={submit} disabled={busy || items.length === 0 || !fromId || !toId}
        className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg font-extrabold">
        {busy ? 'ກຳລັງສ້າງ...' : '✓ ສ້າງການໂອນ'}
      </button>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'} text-white px-5 py-2.5 rounded-full shadow-2xl z-50 text-sm font-semibold`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
