'use client';

import { useState, useEffect, useMemo } from 'react';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtDateTime = s => s ? new Date(s).toLocaleString('lo-LA') : '—';

const REASONS = [
  { key: 'damaged', label: '💥 ເສຍຫາຍ' },
  { key: 'lost', label: '❓ ສູນຫາຍ' },
  { key: 'found', label: '🔍 ພົບເພີ່ມ' },
  { key: 'correction', label: '✏️ ແກ້ໄຂບໍ່ຖືກຕ້ອງ' },
  { key: 'transfer', label: '🔄 ໂອນ' },
  { key: 'expired', label: '⏰ ໝົດອາຍຸ' },
  { key: 'theft', label: '🚨 ສູນເສຍ' },
  { key: 'other', label: '📋 ອື່ນໆ' },
];

const REASON_LABEL = Object.fromEntries(REASONS.map(r => [r.key, r.label]));
const STATUS_LABEL = {
  pending: 'ລໍຖ້າອະນຸມັດ',
  approved: 'ອະນຸມັດແລ້ວ',
  rejected: 'ປະຕິເສດ',
};

export default function StockAdjustmentsPage() {
  const [products, setProducts] = useState([]);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [qtyAfter, setQtyAfter] = useState('');
  const [items, setItems] = useState([]);
  const [reason, setReason] = useState('correction');
  const [note, setNote] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [toast, setToast] = useState(null);
  const requestCreatedAt = useMemo(() => new Date().toLocaleString('lo-LA'), [showRequestModal]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (reasonFilter) params.set('reason', reasonFilter);
      if (statusFilter) params.set('status', statusFilter);
      const [pRes, lRes] = await Promise.all([
        fetch(`${API}/admin/products`).then(r => r.json()),
        fetch(`${API}/admin/stock-adjustments?${params}`).then(r => r.json()),
      ]);
      setProducts(Array.isArray(pRes) ? pRes : []);
      setList(Array.isArray(lRes) ? lRes : []);
    } catch {
      setList([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [reasonFilter, statusFilter]);

  const selected = useMemo(() => products.find(p => p.id === Number(productId)), [products, productId]);
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 20);
    return products.filter(p =>
      (p.product_name || '').toLowerCase().includes(q) ||
      (p.product_code || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [products, productSearch]);

  const submit = async () => {
    if (items.length === 0) { showToast('ກະຣຸນາເພີ່ມລາຍການສິນຄ້າ', 'error'); return; }
    if (!reason) { showToast('ກະຣຸນາເລືອກສາເຫດ', 'error'); return; }

    try {
      const res = await fetch(`${API}/admin/stock-adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            product_id: item.product_id,
            qty_after: item.qty_after,
          })),
          reason,
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`ສ້າງໃບຂໍປັບສະຕັອກສຳເລັດ ${data.adjustment_number || ''}`);
        setProductId(''); setProductSearch(''); setQtyAfter(''); setNote(''); setReason('correction'); setItems([]);
        setShowRequestModal(false);
        load();
      } else {
        showToast(data.error || 'ບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ບໍ່ສຳເລັດ', 'error');
    }
  };

  const addItem = () => {
    if (!selected) { showToast('ກະຣຸນາເລືອກສິນຄ້າ', 'error'); return; }
    if (qtyAfter === '' || isNaN(Number(qtyAfter))) { showToast('ກະຣຸນາໃສ່ຈຳນວນໃໝ່', 'error'); return; }
    const exists = items.some((item) => item.product_id === selected.id);
    if (exists) { showToast('ສິນຄ້ານີ້ຢູ່ໃນໃບແລ້ວ', 'error'); return; }
    const before = Number(selected.qty_on_hand) || 0;
    const after = Math.max(0, Number(qtyAfter) || 0);
    setItems((prev) => [...prev, {
      product_id: selected.id,
      product_name: selected.product_name,
      product_code: selected.product_code,
      unit: selected.unit,
      qty_before: before,
      qty_after: after,
      delta: after - before,
    }]);
    setProductId('');
    setProductSearch('');
    setQtyAfter('');
  };

  const removeItem = (productIdToRemove) => {
    setItems((prev) => prev.filter((item) => item.product_id !== productIdToRemove));
  };

  const decide = async (row, action) => {
    const text = action === 'approve' ? 'ອະນຸມັດ' : 'ປະຕິເສດ';
    if (!confirm(`${text} ${row.adjustment_number || '#' + row.id}?`)) return;
    try {
      const res = await fetch(`${API}/admin/stock-adjustments/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(action === 'approve' ? 'ອະນຸມັດ ແລະ ປັບສະຕັອກແລ້ວ' : 'ປະຕິເສດແລ້ວ');
        load();
      } else {
        showToast(data.error || 'ບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ບໍ່ສຳເລັດ', 'error');
    }
  };

  const stats = useMemo(() => ({
    pending: list.filter(x => x.status === 'pending').length,
    approved: list.filter(x => x.status === 'approved' || !x.status).length,
    rejected: list.filter(x => x.status === 'rejected').length,
  }), [list]);

  return (
    <div className="space-y-4 pb-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-950 px-5 py-5 text-white">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-red-300">Stock adjustment document</div>
            <h1 className="mt-1 text-2xl font-extrabold">ປັບປຸງສະຕັອກ</h1>
            <p className="mt-1 text-sm font-semibold text-slate-300">ສ້າງໃບຂໍປັບປຸງເພື່ອອະນຸມັດກ່ອນປັບຈຳນວນສິນຄ້າຈິງ</p>
          </div>
          <button
            onClick={() => setShowRequestModal(true)}
            className="rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-red-950/20 transition hover:bg-red-700"
          >
            + ສ້າງໃບຂໍປັບ
          </button>
        </div>
        <div className="grid grid-cols-1 divide-y divide-slate-100 bg-slate-50/70 md:grid-cols-4 md:divide-x md:divide-y-0">
          <Metric label="ທັງໝົດ" value={list.length} />
          <Metric label="ລໍຖ້າ" value={stats.pending} tone="amber" />
          <Metric label="ອະນຸມັດ" value={stats.approved} tone="emerald" />
          <Metric label="ປະຕິເສດ" value={stats.rejected} tone="rose" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { key: '', label: 'ທຸກສະຖານະ' },
            { key: 'pending', label: 'ລໍຖ້າອະນຸມັດ' },
            { key: 'approved', label: 'ອະນຸມັດແລ້ວ' },
            { key: 'rejected', label: 'ປະຕິເສດ' },
          ].map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${statusFilter === s.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => setReasonFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${reasonFilter === '' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-700 border-slate-300'}`}>
            ທຸກສາເຫດ
          </button>
          {REASONS.map(r => (
            <button key={r.key} onClick={() => setReasonFilter(r.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${reasonFilter === r.key ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-700 border-slate-300'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Request modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowRequestModal(false)}>
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <section className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">New request</div>
                <h2 className="mt-0.5 text-lg font-extrabold text-slate-950">ສ້າງໃບຂໍປັບສະຕັອກ</h2>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-extrabold">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">ເລກທີ: ຈະອອກຫຼັງບັນທຶກ</span>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">ວັນທີສ້າງ: {requestCreatedAt}</span>
                </div>
              </div>
              <button onClick={() => setShowRequestModal(false)} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-extrabold text-slate-600 hover:bg-slate-200">✕</button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ສິນຄ້າ</label>
              <input
                type="text"
                value={productSearch}
                onChange={e => { setProductSearch(e.target.value); setProductId(''); }}
                placeholder="ຄົ້ນຫາ barcode / ຊື່ / ລະຫັດ..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500"
              />
              {productSearch && !productId && (
                <div className="mt-1 border border-slate-200 rounded-lg max-h-60 overflow-y-auto bg-white">
                  {filteredProducts.length === 0 ? (
                    <div className="px-3 py-3 text-center text-slate-400 text-xs">ບໍ່ພົບສິນຄ້າ</div>
                  ) : filteredProducts.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => { setProductId(p.id); setProductSearch(p.product_name); setQtyAfter(String(p.qty_on_hand || 0)); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <div className="text-sm font-bold text-slate-900">{p.product_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{p.product_code} · ມີ {fmtNum(p.qty_on_hand)} {p.unit || ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selected && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-amber-900">{selected.product_name}</div>
                  <div className="text-xs text-amber-700">ຈຳນວນປະຈຸບັນ: {fmtNum(selected.qty_on_hand)} {selected.unit}</div>
                </div>
                <button onClick={() => { setProductId(''); setProductSearch(''); }} className="text-amber-700 hover:text-amber-900">✕</button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ຈຳນວນໃໝ່</label>
                <input
                  type="number"
                  min="0"
                  value={qtyAfter}
                  onChange={e => setQtyAfter(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500"
                />
                {selected && qtyAfter !== '' && (
                  <div className="text-[11px] mt-1">
                    {Number(qtyAfter) - Number(selected.qty_on_hand) >= 0 ? (
                      <span className="text-emerald-600 font-bold">+ {fmtNum(Number(qtyAfter) - Number(selected.qty_on_hand))} {selected.unit}</span>
                    ) : (
                      <span className="text-rose-600 font-bold">− {fmtNum(Number(selected.qty_on_hand) - Number(qtyAfter))} {selected.unit}</span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ສາເຫດ</label>
                <select
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500"
                >
                  {REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ໝາຍເຫດ</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="ລາຍລະອຽດເພີ່ມເຕີມ..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500"
              />
            </div>

            <button onClick={addItem} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 font-extrabold text-slate-800 hover:bg-white">
              + ເພີ່ມລາຍການໃສ່ໃບ
            </button>

            <div className="rounded-xl border border-slate-200 bg-slate-50">
              <div className="border-b border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-700">
                ລາຍການໃນໃບຂໍປັບ ({items.length})
              </div>
              {items.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs font-bold text-slate-400">ຍັງບໍ່ມີລາຍການ</div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {items.map((item) => (
                    <div key={item.product_id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold text-slate-900">{item.product_name}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-slate-500">{item.product_code || '-'}</div>
                        </div>
                        <button onClick={() => removeItem(item.product_id)} className="rounded px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50">ລົບ</button>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-right font-mono text-xs">
                        <div className="rounded-lg bg-white p-2"><div className="text-[10px] text-slate-400">ກ່ອນ</div><b>{fmtNum(item.qty_before)}</b></div>
                        <div className="rounded-lg bg-white p-2"><div className="text-[10px] text-slate-400">ຫຼັງ</div><b>{fmtNum(item.qty_after)}</b></div>
                        <div className={`rounded-lg bg-white p-2 ${item.delta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}><div className="text-[10px] text-slate-400">ປ່ຽນ</div><b>{item.delta >= 0 ? '+' : ''}{fmtNum(item.delta)}</b></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button onClick={submit} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-extrabold disabled:opacity-50" disabled={items.length === 0}>
              ສ້າງໃບຂໍອະນຸມັດ
            </button>
          </section>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">
          {loading ? 'ກຳລັງໂຫຼດ...' : `ປະຫວັດ ${list.length} ລາຍການ`}
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold text-slate-600">ວັນທີ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ເລກເອກະສານ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ສະຖານະ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ສິນຄ້າ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ກ່ອນ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ຫຼັງ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ປ່ຽນແປງ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ສາເຫດ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ໝາຍເຫດ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ຜູ້ຂໍ</th>
                <th className="px-3 py-2 font-bold text-slate-600"></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-400">ບໍ່ມີຂໍ້ມູນ</td></tr>
              ) : list.map(a => (
                <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{fmtDateTime(a.created_at)}</td>
                  <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{a.adjustment_number || `#${a.id}`}</td>
                  <td className="px-3 py-1.5"><StatusBadge status={a.status || 'approved'} /></td>
                  <td className="px-3 py-1.5 font-bold">{a.product_name || '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtNum(a.qty_before)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtNum(a.qty_after)}</td>
                  <td className={`px-3 py-1.5 text-right font-mono font-extrabold ${Number(a.delta) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {Number(a.delta) >= 0 ? '+' : ''}{fmtNum(a.delta)}
                  </td>
                  <td className="px-3 py-1.5">{REASON_LABEL[a.reason] || a.reason}</td>
                  <td className="px-3 py-1.5 text-slate-600 max-w-xs truncate">{a.note || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-600">{a.requested_by || a.username || '—'}</td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    {a.status === 'pending' && (
                      <>
                        <button onClick={() => decide(a, 'approve')} className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-[11px] font-extrabold hover:bg-emerald-100">ອະນຸມັດ</button>
                        <button onClick={() => decide(a, 'reject')} className="ml-1 px-2 py-1 rounded bg-rose-50 text-rose-700 text-[11px] font-extrabold hover:bg-rose-100">ປະຕິເສດ</button>
                      </>
                    )}
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

function Metric({ label, value, tone = 'slate' }) {
  const color = {
    slate: 'text-slate-950',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
  }[tone];
  return (
    <div className="px-5 py-4">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${color}`}>{fmtNum(value)}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const cls = status === 'pending'
    ? 'bg-amber-100 text-amber-700'
    : status === 'rejected'
    ? 'bg-rose-100 text-rose-700'
    : 'bg-emerald-100 text-emerald-700';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${cls}`}>{STATUS_LABEL[status] || status}</span>;
}
