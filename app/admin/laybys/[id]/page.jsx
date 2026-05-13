'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;
const fmtDate = s => s ? new Date(s).toLocaleDateString('lo-LA') : '—';
const fmtDateTime = s => s ? new Date(s).toLocaleString('lo-LA') : '—';

const STATUS_LABEL = {
  open: { label: 'ເປີດ', color: 'bg-amber-100 text-amber-800' },
  completed: { label: 'ປິດ', color: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'ຍົກເລີກ', color: 'bg-rose-100 text-rose-800' },
};

export default function LaybyDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/laybys/${id}`);
      setData(await res.json());
    } catch {
      setData(null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const addPayment = async () => {
    const amt = Number(payAmount) || 0;
    if (amt <= 0) { showToast('ໃສ່ຈຳນວນເງິນ', 'error'); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/laybys/${id}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, payment_method: payMethod }),
      });
      const j = await res.json();
      if (res.ok) { showToast('ບັນທຶກສຳເລັດ'); setPayAmount(''); load(); }
      else showToast(j.error || 'ບໍ່ສຳເລັດ', 'error');
    } catch {
      showToast('ບໍ່ສຳເລັດ', 'error');
    }
    setBusy(false);
  };

  const complete = async () => {
    if (!window.confirm('ປິດ Layby ນີ້ ແລະ ສ້າງບີນຂາຍ?')) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/laybys/${id}/complete`, { method: 'POST' });
      const j = await res.json();
      if (res.ok) { showToast(`ປິດສຳເລັດ · ບີນ ${j.bill_number}`); load(); }
      else showToast(j.error || 'ບໍ່ສຳເລັດ', 'error');
    } catch {
      showToast('ບໍ່ສຳເລັດ', 'error');
    }
    setBusy(false);
  };

  const cancel = async () => {
    if (!window.confirm('ຍົກເລີກ Layby? ສິນຄ້າຈະຄືນເຂົ້າສະຕັອກ ແລະ ມັດຈຳຕ້ອງຄືນໃຫ້ລູກຄ້າແຍກຕ່າງຫາກ.')) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/laybys/${id}/cancel`, { method: 'POST' });
      const j = await res.json();
      if (res.ok) { showToast(`ຍົກເລີກສຳເລັດ · ຕ້ອງຄືນ ${fmtPrice(j.deposit_to_refund)}`); load(); }
      else showToast(j.error || 'ບໍ່ສຳເລັດ', 'error');
    } catch {
      showToast('ບໍ່ສຳເລັດ', 'error');
    }
    setBusy(false);
  };

  const remove = async () => {
    const msg = data?.status === 'open'
      ? 'ລົບ Layby ນີ້ທັງໝົດ?\nສິນຄ້າຈະຄືນເຂົ້າສະຕັອກ. ປະຫວັດການຊຳລະ ແລະ ມັດຈຳຈະຫາຍຖາວອນ.'
      : 'ລົບ Layby ນີ້ທັງໝົດ? ປະຫວັດການຊຳລະ ແລະ ມັດຈຳຈະຫາຍຖາວອນ.';
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/laybys/${id}`, { method: 'DELETE' });
      const j = await res.json();
      if (res.ok) {
        showToast('ລົບ Layby ສຳເລັດ');
        router.push('/admin/laybys');
      } else {
        showToast(j.error || 'ບໍ່ສຳເລັດ', 'error');
        setBusy(false);
      }
    } catch {
      showToast('ບໍ່ສຳເລັດ', 'error');
      setBusy(false);
    }
  };

  if (loading) return <div className="text-slate-400 text-center py-12">ກຳລັງໂຫຼດ...</div>;
  if (!data) return <div className="text-rose-600 text-center py-12">ບໍ່ພົບ Layby</div>;

  const isOpen = data.status === 'open';
  const isPaid = Number(data.balance) <= 0;

  return (
    <div className="space-y-4 max-w-5xl">
      <Link href="/admin/laybys" className="text-sm text-slate-500 hover:text-slate-900">← ກັບ Layby</Link>

      {/* Header */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 font-mono">{data.layby_number}</h1>
            <div className="mt-1 text-base font-bold">{data.customer_name}</div>
            <div className="text-xs text-slate-500">{data.customer_phone || '—'}</div>
            <div className="text-xs text-slate-500 mt-1">ສ້າງ {fmtDateTime(data.created_at)} · ກຳນົດຮັບ {fmtDate(data.due_date)}</div>
          </div>
          <span className={`px-3 py-1 rounded font-bold text-sm ${STATUS_LABEL[data.status]?.color}`}>
            {STATUS_LABEL[data.status]?.label || data.status}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-500">ລວມ</div>
            <div className="text-lg font-extrabold">{fmtPrice(data.total)}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 p-3">
            <div className="text-[10px] font-bold uppercase text-emerald-600">ຊຳລະແລ້ວ</div>
            <div className="text-lg font-extrabold text-emerald-700">{fmtPrice(data.paid)}</div>
          </div>
          <div className="rounded-lg border border-amber-200 p-3">
            <div className="text-[10px] font-bold uppercase text-amber-600">ຄ້າງ</div>
            <div className="text-lg font-extrabold text-amber-700">{fmtPrice(data.balance)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-[10px] font-bold uppercase text-slate-500">ສ່ວນຫຼຸດ</div>
            <div className="text-lg font-extrabold">{fmtPrice(data.discount)}</div>
          </div>
        </div>
        {(isOpen || data.status === 'cancelled') && (
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
            {isOpen && (
              <>
                <button disabled={busy || !isPaid} onClick={complete}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold">
                  ✓ ປິດ + ສ້າງບີນຂາຍ
                </button>
                <button disabled={busy} onClick={cancel}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-sm font-bold">
                  ✕ ຍົກເລີກ
                </button>
              </>
            )}
            <button disabled={busy} onClick={remove}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-lg text-sm font-bold ml-auto">
              🗑 ລົບ Layby
            </button>
            {isOpen && !isPaid && <div className="text-xs text-amber-700 self-center">⚠ ຍັງຄ້າງ {fmtPrice(data.balance)} — ກະຣຸນາຮັບຊຳລະໃຫ້ຄົບກ່ອນປິດ</div>}
          </div>
        )}
        {data.completed_order_id && (
          <div className="mt-3 text-xs text-emerald-700">
            ✓ ປິດເປັນບີນຂາຍ <Link href={`/admin/sales`} className="font-bold underline">#{data.completed_order_id}</Link>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-bold">ສິນຄ້າ ({data.items.length})</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr className="text-left"><th className="px-3 py-2 font-bold">ສິນຄ້າ</th><th className="px-3 py-2 font-bold text-right">ຈຳນວນ</th><th className="px-3 py-2 font-bold text-right">ລາຄາ</th><th className="px-3 py-2 font-bold text-right">ລວມ</th></tr></thead>
          <tbody>
            {data.items.map(it => (
              <tr key={it.id} className="border-t border-slate-100">
                <td className="px-3 py-1.5 font-bold">{it.product_name}{it.variant_name && ` · ${it.variant_name}`}<br/><span className="text-[10px] text-slate-500 font-mono">{it.product_code}</span></td>
                <td className="px-3 py-1.5 text-right font-mono">{fmtNum(it.quantity)} {it.unit || ''}</td>
                <td className="px-3 py-1.5 text-right font-mono">{fmtPrice(it.price)}</td>
                <td className="px-3 py-1.5 text-right font-mono font-bold">{fmtPrice(it.quantity * it.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payments + Add */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200 font-bold">ປະຫວັດການຊຳລະ ({data.payments.length})</div>
        {isOpen && (
          <div className="p-4 border-b border-slate-100 bg-emerald-50/30">
            <h3 className="text-sm font-bold mb-2">➕ ຮັບຊຳລະເພີ່ມ</h3>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[160px]">
                <label className="block text-xs font-bold text-slate-600 mb-1">ຈຳນວນເງິນ</label>
                <input type="number" min="0" max={data.balance} value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono text-right" />
                <div className="flex gap-1 mt-1">
                  <button onClick={() => setPayAmount(data.balance)} className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded font-bold">ຄ້າງທັງໝົດ {fmtPrice(data.balance)}</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">ວິທີ</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm">
                  <option value="cash">ເງິນສົດ</option>
                  <option value="transfer">ໂອນ</option>
                  <option value="qr">QR</option>
                </select>
              </div>
              <button onClick={addPayment} disabled={busy || !payAmount}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-bold">
                ✓ ບັນທຶກ
              </button>
            </div>
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr className="text-left"><th className="px-3 py-2 font-bold">ວັນທີ</th><th className="px-3 py-2 font-bold">ວິທີ</th><th className="px-3 py-2 font-bold">ໝາຍເຫດ</th><th className="px-3 py-2 font-bold">ໂດຍ</th><th className="px-3 py-2 font-bold text-right">ຈຳນວນ</th></tr></thead>
          <tbody>
            {data.payments.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">ບໍ່ມີການຊຳລະ</td></tr>
            : data.payments.map(p => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-1.5 text-slate-600">{fmtDate(p.payment_date)}</td>
                <td className="px-3 py-1.5">{p.payment_method}</td>
                <td className="px-3 py-1.5 text-slate-600">{p.note || '—'}</td>
                <td className="px-3 py-1.5 text-slate-600">{p.created_by || '—'}</td>
                <td className="px-3 py-1.5 text-right font-mono font-bold text-emerald-700">{fmtPrice(p.amount)}</td>
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
