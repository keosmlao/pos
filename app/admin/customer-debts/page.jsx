'use client';

import { useEffect, useMemo, useState } from 'react';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(n || 0);
const fmtPrice = n => new Intl.NumberFormat('lo-LA').format(Math.round(n || 0)) + ' ກີບ';

function fmtDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('lo-LA');
}

function statusOf(debt) {
  const remaining = Number(debt.remaining) || 0;
  if (remaining <= 0) return { key: 'paid', label: 'ຊຳລະແລ້ວ', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if ((Number(debt.paid) || 0) > 0) return { key: 'partial', label: 'ບາງສ່ວນ', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { key: 'outstanding', label: 'ຄ້າງຊຳລະ', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
}

export default function CustomerDebtsPage() {
  const [debts, setDebts] = useState([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('outstanding');
  const [showPay, setShowPay] = useState(null);
  const [payments, setPayments] = useState([]);
  const [payForm, setPayForm] = useState({ amount: '', payment_date: '', payment_method: 'cash', note: '' });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/customer-debts`);
      const data = await res.json();
      setDebts(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openPay = async (debt) => {
    setShowPay(debt);
    setPayForm({
      amount: String(Math.round(Number(debt.remaining) || 0)),
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: 'cash',
      note: '',
    });
    const res = await fetch(`${API}/admin/customer-debts/${debt.id}/payments`);
    setPayments(res.ok ? await res.json() : []);
  };

  const submitPay = async (e) => {
    e.preventDefault();
    if (!showPay) return;
    const res = await fetch(`${API}/admin/customer-debts/${showPay.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(payForm.amount),
        payment_date: payForm.payment_date,
        payment_method: payForm.payment_method,
        note: payForm.note,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'ບັນທຶກການຊຳລະບໍ່ສຳເລັດ');
      return;
    }
    setShowPay(null);
    await load();
  };

  const deletePayment = async (paymentId) => {
    if (!confirm('ລຶບລາຍການຊຳລະນີ້ບໍ?')) return;
    const res = await fetch(`${API}/admin/customer-debts/payments/${paymentId}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'ລຶບບໍ່ສຳເລັດ');
      return;
    }
    await openPay(showPay);
    await load();
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return debts.filter(d => {
      const st = statusOf(d).key;
      if (tab === 'outstanding' && st === 'paid') return false;
      if (tab === 'paid' && st !== 'paid') return false;
      if (!q) return true;
      const hay = `${d.id} ${d.customer_name || ''} ${d.customer_phone || ''} ${d.member_code || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [debts, search, tab]);

  const stats = useMemo(() => {
    const outstanding = debts.filter(d => statusOf(d).key !== 'paid');
    const paid = debts.filter(d => statusOf(d).key === 'paid');
    const overdue = outstanding.filter(d => d.credit_due_date && new Date(d.credit_due_date).getTime() + 86400000 < Date.now());
    return {
      outstandingCount: outstanding.length,
      outstandingAmount: outstanding.reduce((s, d) => s + (Number(d.remaining) || 0), 0),
      paidCount: paid.length,
      totalCredit: debts.reduce((s, d) => s + (Number(d.total) || 0), 0),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((s, d) => s + (Number(d.remaining) || 0), 0),
    };
  }, [debts]);

  return (
    <div className="text-[13px]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">ໜີ້ລູກຄ້າ</h2>
          <span className="text-xs text-slate-500">ຈາກບິນຂາຍເຊື່ອ</span>
          {loading && <span className="text-[11px] text-slate-400">ກຳລັງໂຫຼດ...</span>}
        </div>
        <button onClick={load} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold">
          ໂຫຼດໃໝ່
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <Kpi label="ຄ້າງຊຳລະ" value={fmtNum(stats.outstandingCount)} sub={fmtPrice(stats.outstandingAmount)} tone="rose" />
        <Kpi label="ເກີນກຳນົດ" value={fmtNum(stats.overdueCount)} sub={fmtPrice(stats.overdueAmount)} tone="amber" />
        <Kpi label="ຊຳລະແລ້ວ" value={fmtNum(stats.paidCount)} sub="ບິນ" tone="emerald" />
        <Kpi label="ຍອດເຊື່ອລວມ" value={fmtPrice(stats.totalCredit)} sub="ທຸກບິນ" tone="slate" />
        <Kpi label="ລາຍການ" value={fmtNum(debts.length)} sub="ບິນເຊື່ອ" tone="red" />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-2 mb-3 flex flex-wrap items-center gap-2">
        <div className="flex bg-slate-100 rounded-md p-0.5">
          <button onClick={() => setTab('outstanding')} className={`px-3 py-1.5 rounded text-[12px] font-bold ${tab === 'outstanding' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500'}`}>
            ຄ້າງຊຳລະ · {fmtNum(stats.outstandingCount)}
          </button>
          <button onClick={() => setTab('paid')} className={`px-3 py-1.5 rounded text-[12px] font-bold ${tab === 'paid' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>
            ຊຳລະແລ້ວ · {fmtNum(stats.paidCount)}
          </button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ຄົ້ນຫາ ເລກບິນ, ລູກຄ້າ, ເບີໂທ..."
          className="flex-1 min-w-[220px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500" />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2">ບິນ</th>
                <th className="text-left px-3 py-2">ລູກຄ້າ</th>
                <th className="text-center px-3 py-2">ວັນຂາຍ</th>
                <th className="text-center px-3 py-2">ຄົບກຳນົດ</th>
                <th className="text-right px-3 py-2">ຍອດລວມ</th>
                <th className="text-right px-3 py-2">ຊຳລະ</th>
                <th className="text-right px-3 py-2">ຄ້າງ</th>
                <th className="text-center px-3 py-2">ສະຖານະ</th>
                <th className="text-right px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(d => {
                const st = statusOf(d);
                const overdue = st.key !== 'paid' && d.credit_due_date && new Date(d.credit_due_date).getTime() + 86400000 < Date.now();
                return (
                  <tr key={d.id} className="hover:bg-red-50/20">
                    <td className="px-3 py-2">
                      <div className="font-mono font-extrabold text-red-700">{d.bill_number || `#${d.id}`}</div>
                      <div className="text-[10px] text-slate-400">{(d.items || []).length} ລາຍການ</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-extrabold text-slate-900">{d.customer_name || '—'}</div>
                      <div className="text-[10px] text-slate-400">{d.customer_phone || d.member_code || ''}</div>
                    </td>
                    <td className="px-3 py-2 text-center text-slate-500">{fmtDate(d.created_at)}</td>
                    <td className={`px-3 py-2 text-center ${overdue ? 'text-rose-700 font-bold' : 'text-slate-500'}`}>{fmtDate(d.credit_due_date)}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">{fmtPrice(d.total)}</td>
                    <td className="px-3 py-2 text-right font-mono text-emerald-700">{fmtPrice(d.paid)}</td>
                    <td className="px-3 py-2 text-right font-mono font-extrabold text-rose-700">{fmtPrice(d.remaining)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => openPay(d)} className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold">
                        ຊຳລະ
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-12 text-center text-slate-400">ບໍ່ມີຂໍ້ມູນ</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowPay(null)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"></div>
          <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold">ຊຳລະໜີ້ລູກຄ້າ</h3>
                <div className="text-[11px] text-slate-300">ບິນ {showPay.bill_number || `#${showPay.id}`} · {showPay.customer_name || '—'}</div>
              </div>
              <button onClick={() => setShowPay(null)} className="w-8 h-8 rounded hover:bg-white/10">✕</button>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <form onSubmit={submitPay} className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="text-[10px] text-slate-500 font-bold">ລວມ</div>
                    <div className="font-mono font-extrabold">{fmtPrice(showPay.total)}</div>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                    <div className="text-[10px] text-emerald-700 font-bold">ຊຳລະ</div>
                    <div className="font-mono font-extrabold text-emerald-700">{fmtPrice(showPay.paid)}</div>
                  </div>
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-2">
                    <div className="text-[10px] text-rose-700 font-bold">ຄ້າງ</div>
                    <div className="font-mono font-extrabold text-rose-700">{fmtPrice(showPay.remaining)}</div>
                  </div>
                </div>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500">ຈຳນວນຊຳລະ</span>
                  <input type="number" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-right text-lg font-mono font-bold outline-none focus:border-red-500" required />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[10px] font-bold text-slate-500">ວັນທີ</span>
                    <input type="date" value={payForm.payment_date} onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-red-500" />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-bold text-slate-500">ວິທີຊຳລະ</span>
                    <select value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-red-500">
                      <option value="cash">ເງິນສົດ</option>
                      <option value="transfer">ໂອນ</option>
                      <option value="qr">QR</option>
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500">ໝາຍເຫດ</span>
                  <input value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-red-500" />
                </label>
                <button className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-extrabold">
                  ບັນທຶກການຊຳລະ
                </button>
              </form>
              <div>
                <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-2">ປະຫວັດຊຳລະ</div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {payments.map(p => (
                    <div key={p.id} className="p-2 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono font-bold text-emerald-700">{fmtPrice(p.amount)}</div>
                        <div className="text-[10px] text-slate-400">{fmtDate(p.payment_date)} · {p.payment_method}</div>
                        {p.note && <div className="text-[10px] text-slate-500">{p.note}</div>}
                      </div>
                      <button onClick={() => deletePayment(p.id)} className="px-2 py-1 bg-rose-50 text-rose-700 rounded text-[10px] font-bold">ລຶບ</button>
                    </div>
                  ))}
                  {payments.length === 0 && <div className="p-6 text-center text-slate-400">ຍັງບໍ່ມີການຊຳລະ</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone }) {
  const cls = {
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    red: 'bg-red-50 text-red-700 border-red-100',
  }[tone] || 'bg-slate-50 text-slate-700 border-slate-200';
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-xl font-extrabold mt-1 leading-tight">{value}</div>
      <div className="text-[10px] opacity-70 mt-0.5 truncate">{sub}</div>
    </div>
  );
}
