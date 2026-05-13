'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

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

export default function PurchaseRequestDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };

  const load = async () => {
    try { setData(await (await fetch(`${API}/admin/purchase-requests/${id}`)).json()); }
    catch { setData(null); }
  };
  useEffect(() => { load(); }, [id]);

  const act = async (action) => {
    const labels = { submit: 'ສົ່ງຂໍ', approve: 'ອະນຸມັດ', reject: 'ປະຕິເສດ', cancel: 'ຍົກເລີກ' };
    if (action !== 'submit' && !window.confirm(`${labels[action]} ໃບສະເໜີນີ້?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/purchase-requests/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const j = await res.json();
      if (res.ok) { showToast(`${labels[action]}ສຳເລັດ`); load(); }
      else showToast(j.error || 'ບໍ່ສຳເລັດ', 'error');
    } catch { showToast('ບໍ່ສຳເລັດ', 'error'); }
    setBusy(false);
  };

  // Pull PR data into the existing Create Purchase Order page via sessionStorage.
  // After purchase saves, the create page calls mark_converted to link back.
  const pullIntoPurchaseCreate = () => {
    if (!data) return;
    const payload = {
      pendingRequest: {
        id: data.id,
        request_number: data.request_number,
        supplier_id: data.supplier_id,
        supplier_name: data.supplier_name,
        note: data.note ? `${data.note} · ${data.request_number}` : `ດຶງຈາກໃບສະເໜີຊື້: ${data.request_number}`,
        items: data.items.map(it => ({
          product_id: it.product_id,
          quantity: Number(it.quantity) || 0,
          cost_price: Number(it.cost_price) || 0,
        })),
      },
    };
    try { sessionStorage.setItem('navState', JSON.stringify(payload)); } catch {}
    router.push('/admin/purchases/create');
  };

  const remove = async () => {
    if (!window.confirm('ລົບໃບສະເໜີນີ້?')) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/admin/purchase-requests/${id}`, { method: 'DELETE' });
      if (res.ok) { showToast('ລົບສຳເລັດ'); router.push('/admin/purchase-requests'); }
      else { const j = await res.json(); showToast(j.error || 'ລົບບໍ່ສຳເລັດ', 'error'); }
    } catch { showToast('ລົບບໍ່ສຳເລັດ', 'error'); }
    setBusy(false);
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 text-[13px] -m-3 sm:-m-4 md:-m-6 flex items-center justify-center">
        <div className="text-slate-400">ກຳລັງໂຫຼດ...</div>
      </div>
    );
  }

  const canApprove = ['draft', 'submitted'].includes(data.status);
  const canReject = ['draft', 'submitted', 'approved'].includes(data.status);
  const canConvert = data.status === 'approved';
  const canSubmit = data.status === 'draft';
  const canCancel = !['converted', 'cancelled'].includes(data.status);
  const canDelete = data.status !== 'converted';

  const card = "bg-white rounded-lg border border-slate-200";
  const totalQty = data.items.reduce((s, it) => s + Number(it.quantity || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 text-[13px] -m-3 sm:-m-4 md:-m-6">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="w-full px-4 py-2.5 flex items-center gap-3">
          <Link href="/admin/purchase-requests"
            className="text-slate-500 hover:text-slate-800 transition flex items-center gap-1 text-[12px]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            ກັບຄືນ
          </Link>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
            <h1 className="font-semibold text-slate-800">ໃບສະເໜີຊື້</h1>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{data.request_number}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS[data.status]?.color}`}>
              {STATUS[data.status]?.label || data.status}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {canSubmit && <button disabled={busy} onClick={() => act('submit')}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md text-[12px] font-semibold disabled:opacity-50">➤ ສົ່ງຂໍ</button>}
            {canApprove && <button disabled={busy} onClick={() => act('approve')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[12px] font-semibold disabled:opacity-50">✓ ອະນຸມັດ</button>}
            {canReject && <button disabled={busy} onClick={() => act('reject')}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[12px] font-semibold">✕ ປະຕິເສດ</button>}
            {canConvert && <button disabled={busy} onClick={pullIntoPurchaseCreate}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-[12px] font-extrabold disabled:opacity-50 flex items-center gap-1.5">
              🛒 ດຶງເຂົ້າສ້າງໃບສັ່ງຊື້
            </button>}
            {canCancel && <button disabled={busy} onClick={() => act('cancel')}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-md text-[12px]">ຍົກເລີກ</button>}
            {canDelete && <button disabled={busy} onClick={remove}
              className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 rounded-md text-[12px]">🗑</button>}
          </div>
        </div>
      </div>

      <div className="w-full px-4 py-4 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-4">

        {/* Left column */}
        <div className="space-y-3 min-w-0">
          {/* Meta */}
          <div className={`${card} p-3`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-[12px]">
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase">ຜູ້ສະໜອງ</div>
                <div className="font-semibold mt-0.5">{data.supplier_name || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase">ຕ້ອງການວັນທີ</div>
                <div className="mt-0.5">{fmtDate(data.needed_by)}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase">ສ້າງເມື່ອ</div>
                <div className="mt-0.5">{fmtDateTime(data.created_at)}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase">ຜູ້ຂໍ</div>
                <div className="mt-0.5">{data.requested_by || '—'}</div>
              </div>
              {data.reason && (
                <div className="col-span-full">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">ເຫດຜົນ</div>
                  <div className="mt-0.5">{data.reason}</div>
                </div>
              )}
              {data.note && (
                <div className="col-span-full">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">ໝາຍເຫດ</div>
                  <div className="mt-0.5 text-slate-600">{data.note}</div>
                </div>
              )}
            </div>

            {(data.approved_at || data.rejected_at || data.converted_at) && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-3 text-[11px]">
                {data.approved_at && <span className="text-emerald-700">✓ ອະນຸມັດ {fmtDateTime(data.approved_at)} ໂດຍ <b>{data.approved_by || '—'}</b></span>}
                {data.rejected_at && <span className="text-rose-700">✕ ປະຕິເສດ {fmtDateTime(data.rejected_at)} ໂດຍ <b>{data.approved_by || '—'}</b></span>}
                {data.converted_at && data.converted_purchase_id && (
                  <span className="text-violet-700">🛒 ປ່ຽນເປັນບີນຊື້ <Link href={`/admin/purchases`} className="font-bold underline">#{data.converted_purchase_id}</Link> {fmtDateTime(data.converted_at)}</span>
                )}
              </div>
            )}
          </div>

          {/* Items */}
          <div className={`${card}`}>
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50/50 font-semibold text-slate-700">
              ສິນຄ້າ ({data.items.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/30 text-slate-600">
                    <th className="px-3 py-2 text-left font-semibold w-8">#</th>
                    <th className="px-3 py-2 text-left font-semibold">ສິນຄ້າ</th>
                    <th className="px-3 py-2 text-right font-semibold">ຈຳນວນ</th>
                    <th className="px-3 py-2 text-right font-semibold">ຕົ້ນທຶນ</th>
                    <th className="px-3 py-2 text-right font-semibold">ມູນຄ່າ</th>
                    <th className="px-3 py-2 text-left font-semibold">ໝາຍເຫດ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it, i) => (
                    <tr key={it.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="px-3 py-1.5 text-slate-400 font-mono">{i + 1}</td>
                      <td className="px-3 py-1.5">
                        <div className="font-semibold">{it.product_name || '—'}</div>
                        <div className="font-mono text-[10px] text-slate-500">{it.product_code}{it.unit ? ` · ${it.unit}` : ''}</div>
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtNum(it.quantity)}</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmtPrice(it.cost_price)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold">{fmtPrice(it.amount)}</td>
                      <td className="px-3 py-1.5 text-slate-600 text-[12px]">{it.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right summary */}
        <div className="space-y-3">
          <div className="rounded-lg overflow-hidden bg-white border border-slate-200 sticky top-16">
            <div className="bg-slate-800 text-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">ສະຫຼຸບ</div>
              <div className="text-[11px] text-slate-300">{data.request_number}</div>
            </div>
            <div className="p-3 space-y-2 text-[12px]">
              <div className="flex justify-between"><span className="text-slate-500">ລາຍການ</span><span className="font-mono">{data.items.length}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">ຈຳນວນຊິ້ນ</span><span className="font-mono">{fmtNum(totalQty)}</span></div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">ມູນຄ່າປະມານ</span>
                <span className="text-[15px] font-bold font-mono text-red-700">{fmtPrice(data.total)}</span>
              </div>

              {canConvert && (
                <button onClick={pullIntoPurchaseCreate}
                  className="w-full mt-3 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-md font-extrabold text-[12px]">
                  🛒 ດຶງເຂົ້າສ້າງໃບສັ່ງຊື້
                </button>
              )}
              {data.status === 'converted' && (
                <div className="mt-3 rounded-md bg-violet-50 border border-violet-200 px-2.5 py-2 text-[11px] text-violet-800">
                  ✓ ໃບສະເໜີນີ້ຖືກປ່ຽນເປັນບີນຊື້ແລ້ວ
                </div>
              )}
            </div>
          </div>
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
