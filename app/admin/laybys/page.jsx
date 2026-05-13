'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;
const fmtDate = s => s ? new Date(s).toLocaleDateString('lo-LA') : '—';

const STATUS_LABEL = {
  open: { label: 'ເປີດ', color: 'bg-amber-100 text-amber-800' },
  completed: { label: 'ປິດ', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'ຍົກເລີກ', color: 'bg-rose-100 text-rose-800' },
};

export default function LaybysListPage() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      const res = await fetch(`${API}/admin/laybys?${params}`);
      setList(await res.json());
    } catch {
      setList([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const removeLayby = async (l, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (l.status === 'completed') {
      showToast('Layby ປິດເປັນບີນແລ້ວ — ກະຣຸນາລົບບີນຂາຍກ່ອນ', 'error');
      return;
    }
    const msg = l.status === 'open'
      ? `ລົບ Layby ${l.layby_number}?\nສິນຄ້າຈະຄືນເຂົ້າສະຕັອກ. ປະຫວັດການຊຳລະ ແລະ ມັດຈຳຈະຫາຍຖາວອນ.`
      : `ລົບ Layby ${l.layby_number}? ປະຫວັດຈະຫາຍຖາວອນ.`;
    if (!window.confirm(msg)) return;
    setBusyId(l.id);
    try {
      const res = await fetch(`${API}/admin/laybys/${l.id}`, { method: 'DELETE' });
      const j = await res.json();
      if (res.ok) { showToast('ລົບສຳເລັດ'); load(); }
      else showToast(j.error || 'ບໍ່ສຳເລັດ', 'error');
    } catch {
      showToast('ບໍ່ສຳເລັດ', 'error');
    }
    setBusyId(null);
  };

  const stats = {
    open: list.filter(l => l.status === 'open').length,
    completed: list.filter(l => l.status === 'completed').length,
    cancelled: list.filter(l => l.status === 'cancelled').length,
    outstanding: list.filter(l => l.status === 'open').reduce((s, l) => s + Number(l.balance), 0),
  };

  return (
    <div className="space-y-4 pb-6 max-w-6xl">
      <AdminHero
        tag="Layby / Deposit"
        title="📋 Layby / ມັດຈຳ"
        subtitle="ລູກຄ້າຈ່າຍຊຳລະບາງສ່ວນກ່ອນ ແລະ ມາຮັບເຄື່ອງເມື່ອຄົບ"
        action={
          <Link href="/admin/laybys/new" className="rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-red-950/20 transition hover:bg-red-700">
            ➕ ສ້າງ Layby ໃໝ່
          </Link>
        }
        metrics={[
          { label: 'ເປີດ', value: fmtNum(stats.open), tone: 'amber' },
          { label: 'ປິດແລ້ວ', value: fmtNum(stats.completed), tone: 'emerald' },
          { label: 'ຍົກເລີກ', value: fmtNum(stats.cancelled), tone: 'rose' },
          { label: 'ຍອດຄ້າງ', value: fmtPrice(stats.outstanding), tone: 'amber' },
        ]}
      />

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter('')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border ${filter === '' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>
          ທັງໝົດ
        </button>
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${filter === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold text-slate-600">ເລກ Layby</th>
                <th className="px-3 py-2 font-bold text-slate-600">ລູກຄ້າ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ວັນທີ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ກຳນົດຮັບ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ລາຍການ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ລວມ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ຊຳລະ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ຄ້າງ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ສະຖານະ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ຈັດການ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
              : list.length === 0 ? <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">ບໍ່ມີ Layby</td></tr>
              : list.map(l => (
                <tr key={l.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-mono font-bold">
                    <Link href={`/admin/laybys/${l.id}`} className="hover:text-red-600">{l.layby_number}</Link>
                  </td>
                  <td className="px-3 py-1.5">{l.customer_name}<br/><span className="text-[10px] text-slate-500">{l.customer_phone || ''}</span></td>
                  <td className="px-3 py-1.5 text-slate-600">{fmtDate(l.created_at)}</td>
                  <td className="px-3 py-1.5 text-slate-600">{fmtDate(l.due_date)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtNum(l.item_count)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-bold">{fmtPrice(l.total)}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-emerald-700">{fmtPrice(l.paid)}</td>
                  <td className={`px-3 py-1.5 text-right font-mono font-extrabold ${Number(l.balance) > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                    {Number(l.balance) > 0 ? fmtPrice(l.balance) : '—'}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_LABEL[l.status]?.color || 'bg-slate-100'}`}>
                      {STATUS_LABEL[l.status]?.label || l.status}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={(e) => removeLayby(l, e)}
                      disabled={busyId === l.id || l.status === 'completed'}
                      title={l.status === 'completed' ? 'ປິດເປັນບີນແລ້ວ — ລົບບີນຂາຍກ່ອນ' : 'ລົບ Layby'}
                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed text-rose-700 border border-rose-200 rounded text-[11px] font-bold transition">
                      🗑 ລົບ
                    </button>
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

function Stat({ label, value, accent }) {
  const cls = {
    amber: 'border-amber-200 text-amber-700',
    emerald: 'border-emerald-200 text-emerald-700',
    rose: 'border-rose-200 text-rose-700',
    slate: 'border-slate-200 text-slate-700',
  }[accent] || 'border-slate-200 text-slate-700';
  return (
    <div className={`rounded-xl border-2 ${cls.split(' ')[0]} bg-white p-4 shadow-sm`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-extrabold ${cls.split(' ')[1]}`}>{value}</div>
    </div>
  );
}
