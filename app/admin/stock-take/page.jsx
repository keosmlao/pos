'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtDateTime = s => s ? new Date(s).toLocaleString('lo-LA') : '—';

export default function StockTakeListPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', scope: 'all', scope_value: '', note: '' });
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/stock-takes`);
      setList(await res.json());
    } catch {
      setList([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API}/admin/stock-takes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        showToast('ສ້າງສຳເລັດ');
        setForm({ name: '', scope: 'all', scope_value: '', note: '' });
        setShowForm(false);
        load();
        window.location.href = `/admin/stock-take/${data.id}`;
      } else {
        showToast(data.error || 'ບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ບໍ່ສຳເລັດ', 'error');
    }
    setCreating(false);
  };

  const removeTake = async (t, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!window.confirm(`ລົບ "${t.name}"? ການນັບທີ່ບັນທຶກໄວ້ຈະຫາຍໝົດ.`)) return;
    try {
      const res = await fetch(`${API}/admin/stock-takes/${t.id}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { showToast('ລົບສຳເລັດ'); load(); }
      else showToast(j.error || 'ລົບບໍ່ສຳເລັດ', 'error');
    } catch {
      showToast('ລົບບໍ່ສຳເລັດ', 'error');
    }
  };

  return (
    <div className="space-y-4 pb-6 max-w-5xl">
      <AdminHero
        tag="Stock take"
        title="🔍 ນັບສິນຄ້າ (Stock Take)"
        subtitle="ນັບສິນຄ້າຈິງ ປຽບທຽບກັບລະບົບ ແລະ ປັບປຸງ"
        action={
          <button onClick={() => setShowForm(true)} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-red-950/20 transition hover:bg-red-700">
            ➕ ສ້າງ Stock Take
          </button>
        }
      />

      {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 space-y-3">
          <h2 className="font-bold text-slate-900">ສ້າງ Stock Take ໃໝ່</h2>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ຊື່</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={`ນັບສິນຄ້າປະຈຳເດືອນ ${new Date().toLocaleDateString('lo-LA')}`}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ຂອບເຂດ</label>
            <select
              value={form.scope}
              onChange={e => setForm(f => ({ ...f, scope: e.target.value, scope_value: '' }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="all">ສິນຄ້າທັງໝົດ</option>
              <option value="category">ສະເພາະໝວດໝູ່</option>
              <option value="brand">ສະເພາະຍີ່ຫໍ້</option>
            </select>
          </div>
          {(form.scope === 'category' || form.scope === 'brand') && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{form.scope === 'category' ? 'ໝວດໝູ່' : 'ຍີ່ຫໍ້'}</label>
              <input
                type="text"
                value={form.scope_value}
                onChange={e => setForm(f => ({ ...f, scope_value: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ໝາຍເຫດ</label>
            <input
              type="text"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-bold">ຍົກເລີກ</button>
            <button onClick={create} disabled={creating} className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold disabled:opacity-50">
              {creating ? 'ກຳລັງສ້າງ...' : '✓ ສ້າງ + ເລີ່ມນັບ'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {loading ? <div className="text-center py-8 text-slate-400">ກຳລັງໂຫຼດ...</div>
        : list.length === 0 ? <div className="text-center py-12 text-slate-400">ຍັງບໍ່ມີ Stock Take</div>
        : list.map(t => {
          const total = Number(t.item_count) || 0;
          const counted = Number(t.counted_count) || 0;
          const variance = Number(t.variance_count) || 0;
          const progress = total > 0 ? Math.round((counted / total) * 100) : 0;
          return (
            <Link key={t.id} href={`/admin/stock-take/${t.id}`}
              className="block bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:border-red-400 transition">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-900 truncate">{t.name}</span>
                    {t.status === 'completed'
                      ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">ປິດແລ້ວ</span>
                      : <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded">ກຳລັງນັບ</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {fmtDateTime(t.created_at)}
                    {t.created_by && ` · ${t.created_by}`}
                    {t.scope !== 'all' && ` · ${t.scope}: ${t.scope_value}`}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">ນັບແລ້ວ</div>
                    <div className="font-mono font-extrabold text-slate-900">{fmtNum(counted)} / {fmtNum(total)}</div>
                  </div>
                  {variance > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-rose-500 uppercase">ບໍ່ກົງ</div>
                      <div className="font-mono font-extrabold text-rose-700">{fmtNum(variance)}</div>
                    </div>
                  )}
                  <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${progress === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${progress}%` }} />
                  </div>
                  {t.status !== 'completed' && (
                    <button onClick={(e) => removeTake(t, e)}
                      title="ລົບ Stock Take ນີ້"
                      className="ml-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 w-7 h-7 rounded flex items-center justify-center text-sm">
                      🗑
                    </button>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'} text-white px-5 py-2.5 rounded-full shadow-2xl z-50 text-sm font-semibold`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
