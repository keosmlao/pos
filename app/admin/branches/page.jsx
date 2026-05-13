'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const emptyForm = { name: '', code: '', address: '', phone: '', active: true, sort_order: 0 };

export default function BranchesPage() {
  const [list, setList] = useState([]);
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
      const res = await fetch(`${API}/admin/branches`);
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reset = () => { setForm(emptyForm); setEditingId(null); };

  const save = async () => {
    if (!form.name.trim()) { showToast('ກະລຸນາໃສ່ຊື່ສາຂາ', 'error'); return; }
    const url = editingId ? `${API}/admin/branches/${editingId}` : `${API}/admin/branches`;
    try {
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, sort_order: Number(form.sort_order) || 0 }),
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

  const edit = (b) => {
    setForm({
      name: b.name || '',
      code: b.code || '',
      address: b.address || '',
      phone: b.phone || '',
      active: b.active !== false,
      sort_order: b.sort_order || 0,
    });
    setEditingId(b.id);
  };

  const remove = async (b) => {
    if (!confirm(`ລົບສາຂາ "${b.name}"?`)) return;
    try {
      const res = await fetch(`${API}/admin/branches/${b.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast('ລົບສຳເລັດ');
        if (editingId === b.id) reset();
        load();
      } else {
        showToast(data.error || 'ລົບບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ລົບບໍ່ສຳເລັດ', 'error');
    }
  };

  const stats = useMemo(() => {
    const active = list.filter(b => b.active !== false).length;
    return {
      active,
      inactive: list.length - active,
      defaults: list.filter(b => b.is_default).length,
    };
  }, [list]);

  const fieldCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/10';

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Branches"
        title="🏬 ສາຂາ"
        subtitle="ຈັດການສາຂາສຳລັບຍອດຂາຍ, ສາງ, ບິນ ແລະ ຜູ້ໃຊ້"
        action={
          <button onClick={reset}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/20">
            + ສາຂາໃໝ່
          </button>
        }
        metrics={[
          { label: 'ສາຂາທັງໝົດ', value: loading ? '...' : list.length },
          { label: 'ເປີດໃຊ້ງານ', value: loading ? '...' : stats.active, tone: 'emerald' },
          { label: 'ປິດໃຊ້ງານ', value: loading ? '...' : stats.inactive, tone: 'slate' },
          { label: 'ສາຂາຫຼັກ', value: loading ? '...' : stats.defaults, tone: 'amber' },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-4 xl:self-start">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{editingId ? 'Edit branch' : 'New branch'}</div>
            <h2 className="mt-0.5 text-lg font-extrabold text-slate-950">{editingId ? 'ແກ້ໄຂສາຂາ' : 'ເພີ່ມສາຂາ'}</h2>
          </div>
          <div className="space-y-3 p-5">
            <Field label="ຊື່ສາຂາ *">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={fieldCls} placeholder="ສາຂາ ວຽງຈັນ" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ລະຫັດ">
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} className={`${fieldCls} font-mono font-bold`} placeholder="VTE" />
              </Field>
              <Field label="ລຳດັບ">
                <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: e.target.value }))} className={`${fieldCls} font-mono font-bold`} />
              </Field>
            </div>
            <Field label="ທີ່ຢູ່">
              <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={3} className={fieldCls} />
            </Field>
            <Field label="ເບີໂທ">
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={fieldCls} />
            </Field>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <span>
                <span className="block text-sm font-extrabold text-slate-800">ເປີດໃຊ້ງານ</span>
                <span className="block text-[11px] font-semibold text-slate-500">ສາຂາທີ່ປິດຈະບໍ່ຄວນເລືອກໃຊ້ໃນງານປະຈຳວັນ</span>
              </span>
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="h-5 w-5 accent-emerald-600" />
            </label>
            <div className="flex gap-2 pt-2">
              {editingId && <button onClick={reset} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50">ຍົກເລີກ</button>}
              <button onClick={save} className="flex-[2] rounded-xl bg-red-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-red-700">
                {editingId ? 'ບັນທຶກ' : 'ເພີ່ມສາຂາ'}
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">ລາຍການສາຂາ</h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">{loading ? 'ກຳລັງໂຫຼດ...' : `${list.length} ສາຂາ`}</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="px-5 py-14 text-center text-sm font-bold text-slate-400">ກຳລັງໂຫຼດ...</div>
            ) : list.length === 0 ? (
              <div className="px-5 py-14 text-center text-sm font-bold text-slate-400">ຍັງບໍ່ມີສາຂາ</div>
            ) : list.map(b => (
              <div key={b.id} className={`grid grid-cols-1 gap-3 px-5 py-4 transition hover:bg-slate-50 lg:grid-cols-[1fr_180px_130px_auto] lg:items-center ${editingId === b.id ? 'bg-amber-50/70' : ''}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-base font-extrabold text-slate-950">{b.name}</div>
                    {b.is_default && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">DEFAULT</span>}
                    {b.active ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">ເປີດ</span>
                              : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-600">ປິດ</span>}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{b.address || 'ບໍ່ມີທີ່ຢູ່'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Code</div>
                  <div className="mt-1 font-mono text-sm font-extrabold text-slate-800">{b.code || '-'}</div>
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Phone</div>
                  <div className="mt-1 font-mono text-sm font-bold text-slate-600">{b.phone || '-'}</div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => edit(b)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-extrabold text-slate-700 transition hover:bg-white">ແກ້ໄຂ</button>
                  {!b.is_default && (
                    <button onClick={() => remove(b)} className="rounded-lg px-3 py-2 text-xs font-extrabold text-rose-600 transition hover:bg-rose-50">ລົບ</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-2xl ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value, tone = 'red' }) {
  const color = {
    red: 'text-red-700',
    emerald: 'text-emerald-700',
    slate: 'text-slate-700',
    amber: 'text-amber-700',
  }[tone] || 'text-slate-900';
  return (
    <div className="px-5 py-4">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${color}`}>{value}</div>
    </div>
  );
}
