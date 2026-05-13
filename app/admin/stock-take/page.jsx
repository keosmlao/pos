'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtDateTime = s => s ? new Date(s).toLocaleString('lo-LA') : '—';

const STATUS_TABS = [
  { key: 'all', label: 'ທັງໝົດ' },
  { key: 'open', label: 'ກຳລັງນັບ' },
  { key: 'completed', label: 'ປິດແລ້ວ' },
];

const SCOPE_OPTIONS = [
  { key: 'all', label: '🌐 ສິນຄ້າທັງໝົດ', desc: 'ນັບທຸກລາຍການທີ່ມີໃນລະບົບ' },
  { key: 'category', label: '📂 ສະເພາະໝວດໝູ່', desc: 'ເລືອກໜຶ່ງໝວດໝູ່' },
  { key: 'brand', label: '🏷️ ສະເພາະຍີ່ຫໍ້', desc: 'ເລືອກໜຶ່ງຍີ່ຫໍ້' },
];

export default function StockTakeListPage() {
  const [list, setList] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', scope: 'all', scope_value: '', note: '' });
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [tRes, cRes, bRes] = await Promise.all([
        fetch(`${API}/admin/stock-takes`).then(r => r.json()),
        fetch(`${API}/admin/categories`).then(r => r.json()).catch(() => []),
        fetch(`${API}/admin/brands`).then(r => r.json()).catch(() => []),
      ]);
      setList(Array.isArray(tRes) ? tRes : []);
      setCategories(Array.isArray(cRes) ? cRes : []);
      setBrands(Array.isArray(bRes) ? bRes : []);
    } catch {
      setList([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const open = list.filter(t => t.status !== 'completed').length;
    const completed = list.filter(t => t.status === 'completed').length;
    const withVariance = list.filter(t => Number(t.variance_count) > 0).length;
    return { total: list.length, open, completed, withVariance };
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter(t => {
      if (statusFilter === 'open' && t.status === 'completed') return false;
      if (statusFilter === 'completed' && t.status !== 'completed') return false;
      if (q) {
        const hay = `${t.name || ''} ${t.created_by || ''} ${t.scope_value || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [list, statusFilter, search]);

  const openForm = () => {
    setForm({ name: '', scope: 'all', scope_value: '', note: '' });
    setShowForm(true);
  };

  const create = async () => {
    if (creating) return;
    if ((form.scope === 'category' || form.scope === 'brand') && !form.scope_value) {
      showToast(`ກະຣຸນາເລືອກ${form.scope === 'category' ? 'ໝວດໝູ່' : 'ຍີ່ຫໍ້'}`, 'error');
      return;
    }
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
        setShowForm(false);
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

  const todayLabel = useMemo(() => new Date().toLocaleDateString('lo-LA'), []);

  return (
    <div className="space-y-4 pb-6 max-w-6xl">
      <AdminHero
        tag="Stock take"
        title="🔍 ນັບສິນຄ້າ (Stock Take)"
        subtitle="ນັບສິນຄ້າຈິງ ປຽບທຽບກັບລະບົບ ແລະ ປັບປຸງຄວາມຖືກຕ້ອງຂອງສະຕັອກ"
        action={
          <button
            onClick={openForm}
            className="rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-red-950/20 transition hover:bg-red-700"
          >
            ➕ ສ້າງ Stock Take
          </button>
        }
        metrics={[
          { label: 'ທັງໝົດ', value: fmtNum(stats.total) },
          { label: 'ກຳລັງນັບ', value: fmtNum(stats.open), tone: 'amber' },
          { label: 'ປິດແລ້ວ', value: fmtNum(stats.completed), tone: 'emerald' },
          { label: 'ມີສ່ວນຕ່າງ', value: fmtNum(stats.withVariance), tone: 'rose' },
        ]}
      />

      {/* Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map(s => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  statusFilter === s.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="ml-auto relative w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ຄົ້ນຫາຊື່, ຜູ້ສ້າງ..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔎</span>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-slate-400">
            ກຳລັງໂຫຼດ...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreate={openForm} />
        ) : (
          filtered.map(t => <StockTakeCard key={t.id} take={t} onRemove={removeTake} />)
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => !creating && setShowForm(false)}
        >
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
          <section
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">New stock take</div>
                <h2 className="mt-0.5 text-lg font-extrabold text-slate-950">ສ້າງ Stock Take ໃໝ່</h2>
              </div>
              <button
                onClick={() => !creating && setShowForm(false)}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-extrabold text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ຊື່ Stock Take</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={`ນັບສິນຄ້າປະຈຳເດືອນ ${todayLabel}`}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500"
                />
                <div className="mt-1 text-[11px] text-slate-400">ປ່ອຍຫວ່າງເພື່ອໃຊ້ຊື່ອັດຕະໂນມັດຕາມວັນທີ</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">ຂອບເຂດສິນຄ້າ</label>
                <div className="grid grid-cols-1 gap-2">
                  {SCOPE_OPTIONS.map(opt => {
                    const active = form.scope === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, scope: opt.key, scope_value: '' }))}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                          active
                            ? 'border-red-500 bg-red-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className={`text-sm font-extrabold ${active ? 'text-red-700' : 'text-slate-900'}`}>{opt.label}</div>
                          <div className="text-[11px] text-slate-500">{opt.desc}</div>
                        </div>
                        <div className={`h-4 w-4 rounded-full border-2 ${active ? 'border-red-500 bg-red-500' : 'border-slate-300'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.scope === 'category' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ໝວດໝູ່</label>
                  <select
                    value={form.scope_value}
                    onChange={e => setForm(f => ({ ...f, scope_value: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500"
                  >
                    <option value="">— ເລືອກໝວດໝູ່ —</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {form.scope === 'brand' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ຍີ່ຫໍ້</label>
                  <select
                    value={form.scope_value}
                    onChange={e => setForm(f => ({ ...f, scope_value: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500"
                  >
                    <option value="">— ເລືອກຍີ່ຫໍ້ —</option>
                    {brands.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ໝາຍເຫດ</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="ລາຍລະອຽດເພີ່ມເຕີມ (ບໍ່ບັງຄັບ)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <button
                onClick={() => setShowForm(false)}
                disabled={creating}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-sm font-bold disabled:opacity-50"
              >
                ຍົກເລີກ
              </button>
              <button
                onClick={create}
                disabled={creating}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-extrabold shadow-lg shadow-red-950/20 disabled:opacity-50"
              >
                {creating ? 'ກຳລັງສ້າງ...' : '✓ ສ້າງ + ເລີ່ມນັບ'}
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'} text-white px-5 py-2.5 rounded-full shadow-2xl z-50 text-sm font-semibold`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function StockTakeCard({ take, onRemove }) {
  const total = Number(take.item_count) || 0;
  const counted = Number(take.counted_count) || 0;
  const variance = Number(take.variance_count) || 0;
  const progress = total > 0 ? Math.round((counted / total) * 100) : 0;
  const isCompleted = take.status === 'completed';
  const isFull = progress === 100;
  const barCls = isCompleted ? 'bg-emerald-500' : isFull ? 'bg-sky-500' : progress > 0 ? 'bg-amber-500' : 'bg-slate-300';

  return (
    <Link
      href={`/admin/stock-take/${take.id}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-red-400 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-extrabold text-slate-900 truncate group-hover:text-red-700">
              {take.name}
            </span>
            {isCompleted ? (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-extrabold rounded-full">
                ✓ ປິດແລ້ວ
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-extrabold rounded-full">
                ● ກຳລັງນັບ
              </span>
            )}
            {take.scope && take.scope !== 'all' && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-extrabold rounded-full">
                {take.scope === 'category' ? '📂' : '🏷️'} {take.scope_value}
              </span>
            )}
            {variance > 0 && (
              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-extrabold rounded-full">
                ⚠ ສ່ວນຕ່າງ {fmtNum(variance)}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
            <span>🕒 {fmtDateTime(take.created_at)}</span>
            {take.created_by && <span>👤 {take.created_by}</span>}
            {take.note && <span className="truncate">📝 {take.note}</span>}
          </div>
        </div>

        {!isCompleted && (
          <button
            onClick={(e) => onRemove(take, e)}
            title="ລົບ Stock Take ນີ້"
            className="shrink-0 text-rose-500 hover:text-white hover:bg-rose-500 w-8 h-8 rounded-lg flex items-center justify-center transition border border-rose-200 hover:border-rose-500"
          >
            🗑
          </button>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="ສິນຄ້າທັງໝົດ" value={fmtNum(total)} />
        <Stat label="ນັບແລ້ວ" value={fmtNum(counted)} tone={isFull ? 'emerald' : 'amber'} />
        <Stat label="ຍັງເຫຼືອ" value={fmtNum(Math.max(0, total - counted))} tone={total - counted === 0 ? 'emerald' : 'slate'} />
        <Stat label="ສ່ວນຕ່າງ" value={fmtNum(variance)} tone={variance > 0 ? 'rose' : 'slate'} />
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-1">
          <span>ຄວາມຄືບໜ້າ</span>
          <span className={isFull ? 'text-emerald-700' : 'text-slate-700'}>{progress}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${barCls} transition-all`} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </Link>
  );
}

function Stat({ label, value, tone = 'slate' }) {
  const color = {
    slate: 'text-slate-900',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
  }[tone];
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-0.5 font-mono text-lg font-extrabold ${color}`}>{value}</div>
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
      <div className="text-5xl mb-3">📦</div>
      <div className="text-lg font-extrabold text-slate-900">ຍັງບໍ່ມີ Stock Take</div>
      <div className="mt-1 text-sm text-slate-500">ສ້າງ Stock Take ໃໝ່ເພື່ອເລີ່ມນັບສິນຄ້າຈິງປຽບທຽບກັບລະບົບ</div>
      <button
        onClick={onCreate}
        className="mt-4 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-red-950/20 hover:bg-red-700"
      >
        ➕ ສ້າງ Stock Take ໃໝ່
      </button>
    </div>
  );
}
