'use client';

import { useState, useEffect, useMemo, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));

export default function StockTakeDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all'); // all | uncounted | variance
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/stock-takes/${id}`);
      const json = await res.json();
      setData(json);
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(it => {
      if (filter === 'uncounted' && it.counted != null) return false;
      if (filter === 'variance' && (it.counted == null || Number(it.delta) === 0)) return false;
      if (!q) return true;
      return (it.product_name || '').toLowerCase().includes(q)
          || (it.product_code || '').toLowerCase().includes(q)
          || (it.barcode || '').toLowerCase().includes(q);
    });
  }, [items, filter, search]);

  const stats = useMemo(() => {
    const total = items.length;
    const counted = items.filter(i => i.counted != null).length;
    const variance = items.filter(i => i.counted != null && Number(i.delta) !== 0).length;
    return { total, counted, variance, pct: total > 0 ? Math.round((counted / total) * 100) : 0 };
  }, [items]);

  const updateCount = (itemId, value) => {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it;
      const counted = value === '' ? null : Number(value);
      return {
        ...it,
        counted,
        delta: counted == null ? null : counted - Number(it.expected),
      };
    }));
  };

  const updateNote = (itemId, note) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, note } : it));
  };

  const saveProgress = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/stock-takes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map(it => ({ id: it.id, counted: it.counted, note: it.note })) }),
      });
      if (res.ok) showToast('ບັນທຶກສຳເລັດ');
      else showToast('ບໍ່ສຳເລັດ', 'error');
    } catch {
      showToast('ບໍ່ສຳເລັດ', 'error');
    }
    setSaving(false);
  };

  const completeAndApply = async () => {
    if (!window.confirm(`ປິດ stock take ນີ້? ສິນຄ້າທີ່ບໍ່ກົງ ${stats.variance} ລາຍການ ຈະຖືກປັບປຸງເຂົ້າ stock ໂດຍອັດຕະໂນມັດ.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/stock-takes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(it => ({ id: it.id, counted: it.counted, note: it.note })),
          action: 'complete',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('ປິດສຳເລັດ');
        load();
      } else {
        showToast(data.error || 'ບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ບໍ່ສຳເລັດ', 'error');
    }
    setSaving(false);
  };

  const deleteTake = async () => {
    if (!window.confirm(`ລົບ Stock Take ນີ້? ການນັບທີ່ບັນທຶກໄວ້ຈະຫາຍໝົດ.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/stock-takes/${id}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('ລົບສຳເລັດ');
        router.push('/admin/stock-take');
      } else {
        showToast(j.error || 'ລົບບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ລົບບໍ່ສຳເລັດ', 'error');
    }
    setSaving(false);
  };

  if (loading) return <div className="text-slate-400 text-center py-12">ກຳລັງໂຫຼດ...</div>;
  if (!data) return <div className="text-rose-600 text-center py-12">ບໍ່ພົບ Stock Take</div>;

  const completed = data.status === 'completed';

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center gap-3 text-sm">
        <Link href="/admin/stock-take" className="text-slate-500 hover:text-slate-900">← ກັບ Stock Take</Link>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">{data.name}</h1>
            <div className="text-xs text-slate-500 mt-1">
              {data.created_by && `${data.created_by} · `}
              {new Date(data.created_at).toLocaleString('lo-LA')}
            </div>
          </div>
          {completed
            ? <span className="px-3 py-1 bg-emerald-100 text-emerald-700 font-bold rounded">✓ ປິດແລ້ວ {data.completed_at ? `· ${new Date(data.completed_at).toLocaleString('lo-LA')}` : ''}</span>
            : <span className="px-3 py-1 bg-amber-100 text-amber-700 font-bold rounded">⏳ ກຳລັງນັບ</span>}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase">ທັງໝົດ</div>
            <div className="text-xl font-extrabold text-slate-900">{fmtNum(stats.total)}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
            <div className="text-[10px] font-bold text-emerald-700 uppercase">ນັບແລ້ວ</div>
            <div className="text-xl font-extrabold text-emerald-700">{fmtNum(stats.counted)} <span className="text-sm text-emerald-500">({stats.pct}%)</span></div>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
            <div className="text-[10px] font-bold text-rose-700 uppercase">ບໍ່ກົງ</div>
            <div className="text-xl font-extrabold text-rose-700">{fmtNum(stats.variance)}</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ຄົ້ນຫາ barcode / ຊື່ / ລະຫັດ..."
          className="flex-1 min-w-[200px] px-3 py-1.5 border border-slate-200 rounded-md text-sm"
        />
        <div className="flex bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
          {[
            { key: 'all', label: `ທັງໝົດ · ${stats.total}` },
            { key: 'uncounted', label: `ຍັງບໍ່ນັບ · ${stats.total - stats.counted}` },
            { key: 'variance', label: `ບໍ່ກົງ · ${stats.variance}`, cls: 'bg-rose-500 text-white' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-[11px] font-bold ${filter === f.key ? (f.cls || 'bg-slate-800 text-white') : 'text-slate-600 hover:bg-white'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {!completed && (
          <>
            <button onClick={saveProgress} disabled={saving}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-md text-xs font-bold disabled:opacity-50">
              {saving ? '...' : '💾 ບັນທຶກ'}
            </button>
            <button onClick={completeAndApply} disabled={saving || stats.counted === 0}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-extrabold disabled:opacity-50">
              ✓ ປິດ + ປັບປຸງສະຕັອກ
            </button>
            <button onClick={deleteTake} disabled={saving}
              className="ml-auto px-3 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-md text-xs font-bold disabled:opacity-50"
              title="ລົບ Stock Take ນີ້">
              🗑 ລົບ
            </button>
          </>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold text-slate-600">ສິນຄ້າ</th>
                <th className="px-3 py-2 font-bold text-slate-600">Barcode</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ຄາດໝາຍ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right w-32">ນັບໄດ້</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ບໍ່ກົງ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ໝາຍເຫດ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-400">ບໍ່ມີລາຍການ</td></tr>
              ) : filtered.map(it => {
                const delta = it.counted != null ? Number(it.counted) - Number(it.expected) : null;
                return (
                  <tr key={it.id} className={`border-t border-slate-100 ${delta != null && delta !== 0 ? 'bg-rose-50/30' : it.counted != null ? 'bg-emerald-50/30' : ''}`}>
                    <td className="px-3 py-1.5">
                      <div className="font-bold text-slate-900">{it.product_name || '—'}</div>
                      <div className="text-[10px] font-mono text-slate-500">{it.product_code} {it.unit ? `· ${it.unit}` : ''}</div>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs text-slate-600">{it.barcode || '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmtNum(it.expected)}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        min="0"
                        value={it.counted ?? ''}
                        disabled={completed}
                        onChange={e => updateCount(it.id, e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-sm font-mono text-right outline-none focus:border-red-500 disabled:bg-slate-50"
                        placeholder="—"
                      />
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono font-extrabold ${delta == null ? 'text-slate-300' : delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                      {delta == null ? '—' : delta > 0 ? `+${fmtNum(delta)}` : fmtNum(delta)}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text"
                        value={it.note || ''}
                        disabled={completed}
                        onChange={e => updateNote(it.id, e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-red-500 disabled:bg-slate-50"
                        placeholder="..."
                      />
                    </td>
                  </tr>
                );
              })}
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
