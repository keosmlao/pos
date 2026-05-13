'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtDateTime = s => s ? new Date(s).toLocaleString('lo-LA') : '—';

const STATUS = {
  pending: { label: 'ກຳລັງດຳເນີນ', color: 'bg-amber-100 text-amber-800' },
  completed: { label: 'ສຳເລັດ', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'ຍົກເລີກ', color: 'bg-rose-100 text-rose-800' },
};

export default function StockTransfersListPage() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      const res = await fetch(`${API}/admin/stock-transfers?${params}`);
      setList(await res.json());
    } catch { setList([]); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  return (
    <div className="space-y-4 pb-6 max-w-6xl">
      <AdminHero
        tag="Stock transfer"
        title="🔄 ໂອນສິນຄ້າຣະຫວ່າງສາຂາ"
        subtitle="ໂອນສິນຄ້າຈາກສາຂາໜຶ່ງໄປອີກສາຂາ"
        action={
          <Link href="/admin/stock-transfers/new" className="rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-red-950/20 transition hover:bg-red-700">
            ➕ ໂອນໃໝ່
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter('')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border ${filter === '' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>
          ທັງໝົດ · {list.length}
        </button>
        {Object.entries(STATUS).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${filter === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr className="text-left">
            <th className="px-3 py-2 font-bold">ເລກໂອນ</th>
            <th className="px-3 py-2 font-bold">ວັນທີ</th>
            <th className="px-3 py-2 font-bold">ຈາກ</th>
            <th className="px-3 py-2 font-bold">ໄປ</th>
            <th className="px-3 py-2 font-bold text-right">ລາຍການ</th>
            <th className="px-3 py-2 font-bold text-right">ຈຳນວນ</th>
            <th className="px-3 py-2 font-bold">ສະຖານະ</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
            : list.length === 0 ? <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400">ບໍ່ມີຂໍ້ມູນ</td></tr>
            : list.map(t => (
              <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-1.5 font-mono font-bold">
                  <Link href={`/admin/stock-transfers/${t.id}`} className="hover:text-red-600">{t.transfer_number}</Link>
                </td>
                <td className="px-3 py-1.5 text-slate-600">{fmtDateTime(t.created_at)}</td>
                <td className="px-3 py-1.5">{t.from_branch_name || '—'}</td>
                <td className="px-3 py-1.5">→ {t.to_branch_name || '—'}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmtNum(t.item_count)}</td>
                <td className="px-3 py-1.5 text-right font-mono font-bold">{fmtNum(t.total_qty)}</td>
                <td className="px-3 py-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS[t.status]?.color || 'bg-slate-100'}`}>
                    {STATUS[t.status]?.label || t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
