'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;
const fmtDate = s => s ? new Date(s).toLocaleDateString('lo-LA') : '—';
const fmtDateTime = s => s ? new Date(s).toLocaleString('lo-LA') : '—';

const STATUS = {
  draft: { label: 'ຮ່າງ', color: 'bg-slate-100 text-slate-700' },
  submitted: { label: 'ສົ່ງຂໍ', color: 'bg-cyan-100 text-cyan-800' },
  approved: { label: 'ອະນຸມັດ', color: 'bg-emerald-100 text-emerald-800' },
  converted: { label: 'ປ່ຽນເປັນບີນຊື້', color: 'bg-violet-100 text-violet-800' },
  rejected: { label: 'ປະຕິເສດ', color: 'bg-rose-100 text-rose-800' },
  cancelled: { label: 'ຍົກເລີກ', color: 'bg-slate-200 text-slate-700' },
};

export default function PurchaseRequestsListPage() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      setList(await (await fetch(`${API}/admin/purchase-requests?${params}`)).json());
    } catch { setList([]); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const stats = useMemo(() => ({
    total: list.length,
    submitted: list.filter(p => p.status === 'submitted').length,
    approved_pending: list.filter(p => p.status === 'approved').length,
    converted: list.filter(p => p.status === 'converted').length,
  }), [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(p =>
      (p.request_number || '').toLowerCase().includes(q) ||
      (p.supplier_name || '').toLowerCase().includes(q) ||
      (p.requested_by || '').toLowerCase().includes(q)
    );
  }, [list, search]);

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Purchase request"
        title="ໃບສະເໜີຊື້"
        subtitle="ສະເໜີສິນຄ້າທີ່ຕ້ອງການຊື້ → ອະນຸມັດ → ດຶງເຂົ້າສ້າງໃບສັ່ງຊື້"
        action={
          <Link href="/admin/purchase-requests/new"
            className="rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-red-950/20 transition hover:bg-red-700">
            + ສ້າງໃໝ່
          </Link>
        }
        metrics={[
          { label: 'ທັງໝົດ', value: fmtNum(stats.total) },
          { label: 'ລໍຖ້າອະນຸມັດ', value: fmtNum(stats.submitted), tone: 'cyan' },
          { label: 'ອະນຸມັດແລ້ວ', value: fmtNum(stats.approved_pending), tone: 'emerald', sub: 'ລໍຖ້າຊື້' },
          { label: 'ປ່ຽນເປັນບີນຊື້', value: fmtNum(stats.converted), tone: 'violet' },
        ]}
      />

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ຄົ້ນຫາ ເລກໃບ / ຜູ້ສະໜອງ / ຜູ້ຂໍ..."
            className="w-full pl-8 pr-2 h-8 bg-slate-50 border border-slate-200 rounded-md text-[12px] focus:border-red-400 focus:ring-1 focus:ring-red-200 outline-none" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${filter === '' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>
            ທັງໝົດ · {list.length}
          </button>
          {Object.entries(STATUS).map(([k, v]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${filter === k ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-700 border-slate-300'}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 text-left">
                <th className="px-3 py-2 font-bold">ເລກໃບ</th>
                <th className="px-3 py-2 font-bold">ວັນທີ</th>
                <th className="px-3 py-2 font-bold">ຜູ້ສະໜອງ</th>
                <th className="px-3 py-2 font-bold">ຕ້ອງການ</th>
                <th className="px-3 py-2 font-bold">ຜູ້ຂໍ</th>
                <th className="px-3 py-2 font-bold text-right">ລາຍການ</th>
                <th className="px-3 py-2 font-bold text-right">ມູນຄ່າ</th>
                <th className="px-3 py-2 font-bold">ສະຖານະ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">ບໍ່ມີໃບສະເໜີຊື້</td></tr>
              : filtered.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-1.5 font-mono font-semibold">
                    <Link href={`/admin/purchase-requests/${p.id}`} className="text-red-600 hover:underline">{p.request_number}</Link>
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 text-xs">{fmtDateTime(p.created_at)}</td>
                  <td className="px-3 py-1.5">{p.supplier_name || '—'}</td>
                  <td className="px-3 py-1.5 text-slate-600">{fmtDate(p.needed_by)}</td>
                  <td className="px-3 py-1.5 text-slate-600">{p.requested_by || '—'}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-xs">{fmtNum(p.item_count)} <span className="text-slate-400">· {fmtNum(p.total_qty)}</span></td>
                  <td className="px-3 py-1.5 text-right font-mono font-bold">{fmtPrice(p.total)}</td>
                  <td className="px-3 py-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS[p.status]?.color || 'bg-slate-100'}`}>
                      {STATUS[p.status]?.label || p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
