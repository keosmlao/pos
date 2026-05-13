'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtDate = s => s ? new Date(s).toLocaleDateString('lo-LA') : '—';

const SEVERITY = {
  out: { label: 'ໝົດ', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
  critical: { label: 'ວິກິດ', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  low: { label: 'ໜ້ອຍ', bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
};

export default function ReorderAlertsPage() {
  const [data, setData] = useState({ items: [], summary: { total: 0, out: 0, critical: 0, low: 0 } });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/reorder-alerts`);
      setData(await res.json());
    } catch {
      setData({ items: [], summary: { total: 0, out: 0, critical: 0, low: 0 } });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const items = filter === 'all' ? data.items : data.items.filter(i => i.severity === filter);

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Reorder alerts"
        title="🔔 ສິນຄ້າຄວນສັ່ງເພີ່ມ"
        subtitle="ສິນຄ້າທີ່ສະຕັອກ ≤ ຂັ້ນຕ່ຳທີ່ກຳນົດ"
        action={
          <button onClick={load} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-red-950/20 transition hover:bg-red-700">
            ↻ ໂຫຼດໃໝ່
          </button>
        }
        metrics={[
          { label: 'ທັງໝົດ', value: fmtNum(data.summary.total) },
          { label: 'ໝົດ', value: fmtNum(data.summary.out), tone: 'rose' },
          { label: 'ວິກິດ', value: fmtNum(data.summary.critical), tone: 'amber' },
          { label: 'ໜ້ອຍ', value: fmtNum(data.summary.low), tone: 'amber' },
        ]}
      />

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: `ທັງໝົດ · ${fmtNum(data.summary.total)}` },
          { key: 'out', label: `ໝົດ · ${fmtNum(data.summary.out)}` },
          { key: 'critical', label: `ວິກິດ · ${fmtNum(data.summary.critical)}` },
          { key: 'low', label: `ໜ້ອຍ · ${fmtNum(data.summary.low)}` },
        ].map(k => (
          <button
            key={k.key}
            onClick={() => setFilter(k.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border ${filter === k.key ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-700 border-slate-300'}`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {/* Items list */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">
          {loading ? 'ກຳລັງໂຫຼດ...' : `ສິນຄ້າ ${items.length} ລາຍການ`}
        </div>
        <div className="overflow-x-auto max-h-[700px]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 font-bold text-slate-600">ສະຖານະ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ລະຫັດ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ສິນຄ້າ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ໝວດ/ຍີ່ຫໍ້</th>
                <th className="px-3 py-2 font-bold text-slate-600">ຜູ້ສະໜອງ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ມີ</th>
                <th className="px-3 py-2 font-bold text-slate-600 text-right">ຂັ້ນຕ່ຳ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ຊື້ຄັ້ງສຸດທ້າຍ</th>
                <th className="px-3 py-2 font-bold text-slate-600">ຂາຍຄັ້ງສຸດທ້າຍ</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-emerald-600 font-bold">✓ ສິນຄ້າທຸກລາຍການຍັງມີຄັງພຽງພໍ</td></tr>
              ) : items.map(it => {
                const sev = SEVERITY[it.severity] || SEVERITY.low;
                return (
                  <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-1.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${sev.bg} ${sev.text} border ${sev.border}`}>
                        {sev.label}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 font-mono">{it.product_code || '—'}</td>
                    <td className="px-3 py-1.5 font-bold">
                      <Link href={`/admin/products?focus=${it.id}`} className="hover:text-red-600">{it.product_name}</Link>
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">
                      {[it.category, it.brand].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">{it.supplier_name || '—'}</td>
                    <td className={`px-3 py-1.5 text-right font-mono font-extrabold ${
                      it.qty_on_hand <= 0 ? 'text-rose-700' : 'text-amber-700'
                    }`}>{fmtNum(it.qty_on_hand)} {it.unit || ''}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-500">{fmtNum(it.min_stock)}</td>
                    <td className="px-3 py-1.5 text-slate-600">{fmtDate(it.last_purchase_at)}</td>
                    <td className="px-3 py-1.5 text-slate-600">{fmtDate(it.last_sold_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
