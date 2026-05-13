'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtDateTime = s => s ? new Date(s).toLocaleString('lo-LA') : '—';

const STATUS = {
  pending: { label: 'ກຳລັງດຳເນີນ', color: 'bg-amber-100 text-amber-800' },
  completed: { label: 'ສຳເລັດ', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'ຍົກເລີກ', color: 'bg-rose-100 text-rose-800' },
};

export default function TransferDetailPage({ params }) {
  const { id } = use(params);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  const load = async () => {
    setLoading(true);
    try { setData(await (await fetch(`${API}/admin/stock-transfers/${id}`)).json()); }
    catch { setData(null); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const act = async (action) => {
    const msg = action === 'complete'
      ? 'ຢືນຢັນຮັບສິນຄ້າທີ່ປາຍທາງ? ການໂອນຈະຖືກບັນທຶກ'
      : 'ຍົກເລີກການໂອນ?';
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/stock-transfers/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (res.ok) { showToast(action === 'complete' ? 'ໂອນສຳເລັດ' : 'ຍົກເລີກສຳເລັດ'); load(); }
      else showToast(j.error || 'ບໍ່ສຳເລັດ', 'error');
    } catch { showToast('ບໍ່ສຳເລັດ', 'error'); }
    setBusy(false);
  };

  if (loading) return <div className="text-slate-400 text-center py-12">ກຳລັງໂຫຼດ...</div>;
  if (!data) return <div className="text-rose-600 text-center py-12">ບໍ່ພົບ Transfer</div>;
  const isPending = data.status === 'pending';

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href="/admin/stock-transfers" className="text-sm text-slate-500 hover:text-slate-900">← ກັບ Transfers</Link>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold font-mono">{data.transfer_number}</h1>
            <div className="mt-2 text-base">
              <b>{data.from_branch_name}</b> <span className="text-slate-400">→</span> <b>{data.to_branch_name}</b>
            </div>
            <div className="text-xs text-slate-500 mt-1">ສ້າງ {fmtDateTime(data.created_at)} {data.created_by ? `· ${data.created_by}` : ''}</div>
            {data.note && <div className="text-xs text-slate-600 mt-1">📝 {data.note}</div>}
          </div>
          <span className={`px-3 py-1 rounded font-bold ${STATUS[data.status]?.color}`}>{STATUS[data.status]?.label}</span>
        </div>
        {isPending && (
          <div className="mt-4 flex gap-2 border-t pt-4">
            <button disabled={busy} onClick={() => act('complete')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold disabled:opacity-50">
              ✓ ຢືນຢັນຮັບ + ບັນທຶກ
            </button>
            <button disabled={busy} onClick={() => act('cancel')}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-sm font-bold">
              ✕ ຍົກເລີກ
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-bold">ສິນຄ້າ ({data.items.length})</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr className="text-left">
            <th className="px-3 py-2 font-bold">ສິນຄ້າ</th>
            <th className="px-3 py-2 font-bold">ລະຫັດ</th>
            <th className="px-3 py-2 font-bold text-right">ຈຳນວນ</th>
          </tr></thead>
          <tbody>
            {data.items.map(it => (
              <tr key={it.id} className="border-t border-slate-100">
                <td className="px-3 py-1.5 font-bold">{it.product_name || '—'}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{it.product_code || '—'}</td>
                <td className="px-3 py-1.5 text-right font-mono font-bold">{fmtNum(it.quantity)} {it.unit || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'} text-white px-5 py-2.5 rounded-full shadow-2xl z-50 text-sm font-semibold`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
