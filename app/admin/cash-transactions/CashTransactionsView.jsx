'use client';

import { useState, useEffect, useMemo } from 'react';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = (n, c = 'LAK') => c === 'LAK' ? `${fmtNum(n)} ₭` : `${fmtNum(n)} ${c}`;
const fmtDate = s => s ? new Date(s).toLocaleDateString('lo-LA') : '—';

const INCOME_CATEGORIES = [
  { value: 'capital', label: '💰 ທຶນເພີ່ມ' },
  { value: 'rental_income', label: '🏠 ຄ່າເຊົ່າ' },
  { value: 'interest', label: '🏦 ດອກເບ້ຍ' },
  { value: 'refund_in', label: '↩ ຄືນເງິນຈາກຜູ້ສະໜອງ' },
  { value: 'other_income', label: '✨ ລາຍຮັບອື່ນໆ' },
];
const EXPENSE_CATEGORIES = [
  { value: 'rent', label: '🏠 ຄ່າເຊົ່າ' },
  { value: 'utility', label: '💡 ນ້ຳ/ໄຟ/ອິນເຕີເນັດ' },
  { value: 'salary', label: '👤 ເງິນເດືອນ' },
  { value: 'transport', label: '🚚 ຂົນສົ່ງ' },
  { value: 'supplies', label: '📦 ວັດສະດຸ' },
  { value: 'marketing', label: '📣 ການຕະຫຼາດ' },
  { value: 'maintenance', label: '🔧 ບຳລຸງຮັກສາ' },
  { value: 'tax', label: '📋 ພາສີ' },
  { value: 'other_expense', label: '✨ ລາຍຈ່າຍອື່ນໆ' },
];
const METHODS = [
  { value: 'cash', label: 'ເງິນສົດ' },
  { value: 'transfer', label: 'ໂອນ' },
  { value: 'qr', label: 'QR' },
  { value: 'cheque', label: 'ເຊັກ' },
];

const TONES = {
  emerald: {
    primary: 'bg-emerald-600 hover:bg-emerald-700',
    soft: 'border-emerald-100 bg-emerald-50',
    text: 'text-emerald-800',
    label: 'text-emerald-700',
    accent: 'text-emerald-700',
    activeBtn: 'border-emerald-500 bg-emerald-50 text-emerald-800',
  },
  rose: {
    primary: 'bg-rose-600 hover:bg-rose-700',
    soft: 'border-rose-100 bg-rose-50',
    text: 'text-rose-800',
    label: 'text-rose-700',
    accent: 'text-rose-700',
    activeBtn: 'border-rose-500 bg-rose-50 text-rose-800',
  },
};

export default function CashTransactionsView({ txnType, title, subtitle, icon, color = 'emerald' }) {
  const isIncome = txnType === 'income';
  const tone = TONES[color];
  const categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const blankForm = {
    txn_type: txnType,
    category: '',
    description: '',
    amount: '',
    currency: 'LAK',
    exchange_rate: 1,
    account: 'CASH',
    payment_method: 'cash',
    note: '',
    txn_date: new Date().toISOString().slice(0, 10),
  };

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterCurrency, setFilterCurrency] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('type', txnType);
      if (filterCurrency) params.set('currency', filterCurrency);
      if (filterAccount) params.set('account', filterAccount);
      if (search.trim()) params.set('q', search.trim());
      const res = await fetch(`${API}/admin/cash-transactions?${params}`);
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setRows(filterCategory ? list.filter(r => r.category === filterCategory) : list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch(`${API}/currencies`).then(r => r.json()).then(list => setCurrencies(Array.isArray(list) ? list : []));
    fetch(`${API}/admin/company`).then(r => r.json()).then(c => {
      const banks = Array.isArray(c?.bank_accounts) ? c.bank_accounts : [];
      const list = banks.map(b => ({
        value: `${b.bank_name || 'BANK'}-${b.account_number || b.account_name || ''}`.trim(),
        label: `🏦 ${b.bank_name || 'Bank'} · ${b.account_name || ''}${b.account_number ? ` (${b.account_number})` : ''}`,
      }));
      setAccounts(list);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCurrency, filterAccount, filterCategory, search, txnType]);

  const openCreate = () => {
    setEditing(null);
    setForm(blankForm);
    setShowForm(true);
  };

  const openEdit = (r) => {
    setEditing(r.id);
    setForm({
      txn_type: r.txn_type,
      category: r.category || '',
      description: r.description || '',
      amount: String(r.amount || ''),
      currency: r.currency || 'LAK',
      exchange_rate: Number(r.exchange_rate) || 1,
      account: r.account || 'CASH',
      payment_method: r.payment_method || 'cash',
      note: r.note || '',
      txn_date: r.txn_date ? String(r.txn_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setShowForm(true);
  };

  const save = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { showToast('ກະລຸນາປ້ອນຈຳນວນ', 'error'); return; }
    setSaving(true);
    try {
      const url = editing ? `${API}/admin/cash-transactions/${editing}` : `${API}/admin/cash-transactions`;
      const method = editing ? 'PUT' : 'POST';
      const body = {
        ...form,
        amount,
        exchange_rate: Number(form.exchange_rate) || 1,
        amount_lak: amount * (Number(form.exchange_rate) || 1),
      };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'ບັນທຶກບໍ່ສຳເລັດ', 'error'); return; }
      showToast(editing ? 'ແກ້ໄຂສຳເລັດ' : 'ບັນທຶກສຳເລັດ');
      setShowForm(false);
      load();
    } catch {
      showToast('ບັນທຶກບໍ່ສຳເລັດ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r) => {
    if (!confirm(`ລົບລາຍການ "${r.description || r.category || '#' + r.id}"?`)) return;
    const res = await fetch(`${API}/admin/cash-transactions/${r.id}`, { method: 'DELETE' });
    if (!res.ok) { showToast('ລົບບໍ່ສຳເລັດ', 'error'); return; }
    showToast('ລົບສຳເລັດ');
    load();
  };

  const stats = useMemo(() => {
    const sum = arr => arr.reduce((s, r) => s + (Number(r.amount_lak) || 0), 0);
    const total = sum(rows);
    const today = new Date();
    const isSameDay = (d) => {
      if (!d) return false;
      const dt = new Date(d);
      return dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth() && dt.getDate() === today.getDate();
    };
    const todayRows = rows.filter(r => isSameDay(r.txn_date || r.created_at));
    const isSameMonth = (d) => {
      if (!d) return false;
      const dt = new Date(d);
      return dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth();
    };
    const monthRows = rows.filter(r => isSameMonth(r.txn_date || r.created_at));
    return {
      count: rows.length,
      total,
      todayCount: todayRows.length,
      todayTotal: sum(todayRows),
      monthCount: monthRows.length,
      monthTotal: sum(monthRows),
    };
  }, [rows]);

  const allCurrencies = currencies.length > 0 ? currencies : [{ code: 'LAK', symbol: '₭', rate: 1 }];

  return (
    <div className="space-y-4 text-[13px]">
      <div className={`overflow-hidden rounded-2xl border shadow-sm ${tone.soft}`}>
        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">{icon}</span>
            <div className="min-w-0">
              <div className={`text-[10px] font-extrabold uppercase tracking-widest ${tone.label}`}>Cash transactions</div>
              <h1 className="truncate text-2xl font-extrabold text-slate-950">{title}</h1>
              <p className="mt-0.5 text-xs font-semibold text-slate-600">{subtitle}</p>
            </div>
          </div>
          <button onClick={openCreate}
            className={`${tone.primary} rounded-xl px-4 py-3 text-sm font-extrabold text-white shadow-sm`}>
            + {isIncome ? 'ບັນທຶກລາຍຮັບ' : 'ບັນທຶກລາຍຈ່າຍ'}
          </button>
        </div>
        <div className="grid grid-cols-1 border-t border-white/60 bg-white/65 md:grid-cols-3">
          <Metric label="ມື້ນີ້" count={stats.todayCount} amount={stats.todayTotal} tone={tone} />
          <Metric label="ເດືອນນີ້" count={stats.monthCount} amount={stats.monthTotal} tone={tone} />
          <Metric label="ກຳລັງສະແດງ" count={stats.count} amount={stats.total} tone={tone} muted />
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-3">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[180px_160px_220px_1fr]">
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-red-400">
              <option value="">ທຸກໝວດ</option>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-red-400">
              <option value="">ທຸກສະກຸນ</option>
              {allCurrencies.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
            </select>
            <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-red-400">
              <option value="">ທຸກບັນຊີ</option>
              <option value="CASH">💵 ເງິນສົດ</option>
              {accounts.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="ຄົ້ນຫາລາຍລະອຽດ, ບັນຊີ..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-red-400 focus:bg-white" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">ລາຍການ</th>
                <th className="px-3 py-3">ໝວດ</th>
                <th className="px-3 py-3">ບັນຊີ</th>
                <th className="px-3 py-3">ວິທີ</th>
                <th className="px-3 py-3 text-right">ຈຳນວນ</th>
                <th className="px-3 py-3 text-right">≈ LAK</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="7" className="px-3 py-14 text-center text-slate-400">ກຳລັງໂຫຼດ...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="7" className="px-3 py-14 text-center text-slate-400">ບໍ່ມີລາຍການ</td></tr>
              ) : rows.map(r => {
                const cat = categories.find(c => c.value === r.category);
                return (
                  <tr key={r.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="font-extrabold text-slate-900 max-w-[300px] truncate">{r.description || '—'}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] font-bold text-slate-400">
                        <span>{fmtDate(r.txn_date || r.created_at)}</span>
                        {r.note && <span className="truncate">· {r.note}</span>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs font-bold text-slate-700">{cat?.label || r.category || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{r.account || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs font-bold text-slate-600">{METHODS.find(m => m.value === r.payment_method)?.label || r.payment_method}</td>
                    <td className={`whitespace-nowrap px-3 py-3 text-right font-mono font-extrabold ${tone.accent}`}>
                      {isIncome ? '+' : '-'}{fmtPrice(r.amount, r.currency)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-xs font-bold text-slate-600">{fmtPrice(r.amount_lak)}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(r)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-blue-50 hover:text-red-700" title="ແກ້ໄຂ">✏️</button>
                      <button onClick={() => remove(r)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-rose-50 hover:text-rose-700" title="ລົບ">🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !saving && setShowForm(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">
                {editing ? 'ແກ້ໄຂ' : 'ບັນທຶກ'} {icon} {title}
              </h3>
              <button onClick={() => !saving && setShowForm(false)}
                className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded flex items-center justify-center text-slate-500">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1">ໝວດໝູ່</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                    <option value="">-- ເລືອກໝວດ --</option>
                    {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1">ວັນທີ</label>
                  <input type="date" value={form.txn_date} onChange={e => setForm({ ...form, txn_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1">ລາຍລະອຽດ</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder={isIncome ? 'ເຊັ່ນ: ໄດ້ຮັບເງິນທຶນຈາກຜູ້ຖືຫຸ້ນ' : 'ເຊັ່ນ: ຈ່າຍຄ່າເຊົ່າຮ້ານເດືອນ 05'}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1">ຈຳນວນ</label>
                  <input type="number" min="0" step="any" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-right text-lg font-extrabold font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1">ສະກຸນ</label>
                  <select value={form.currency} onChange={e => {
                    const cur = allCurrencies.find(c => c.code === e.target.value);
                    setForm({ ...form, currency: e.target.value, exchange_rate: Number(cur?.rate) || 1 });
                  }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                    {allCurrencies.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>)}
                  </select>
                </div>
              </div>

              {form.currency !== 'LAK' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1">ອັດຕາແລກປ່ຽນ (→ LAK)</label>
                    <input type="number" min="0" step="any" value={form.exchange_rate}
                      onChange={e => setForm({ ...form, exchange_rate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-right font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1">≈ LAK</label>
                    <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono font-extrabold text-slate-700">
                      {fmtPrice((Number(form.amount) || 0) * (Number(form.exchange_rate) || 1))}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1">ວິທີຊຳລະ</label>
                  <div className="grid grid-cols-4 gap-1">
                    {METHODS.map(m => (
                      <button key={m.value} type="button"
                        onClick={() => setForm({ ...form, payment_method: m.value, account: m.value === 'cash' ? 'CASH' : form.account })}
                        className={`py-2 rounded-md text-xs font-bold border ${form.payment_method === m.value ? 'border-red-500 bg-blue-50 text-red-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1">ບັນຊີ / ບ່ອນເກັບ</label>
                  <select value={form.account} onChange={e => setForm({ ...form, account: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                    <option value="CASH">💵 ເງິນສົດ (CASH)</option>
                    {accounts.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-1">ໝາຍເຫດ</label>
                <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                  rows={2}
                  placeholder="ຂໍ້ມູນເພີ່ມເຕີມ..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button onClick={() => !saving && setShowForm(false)} disabled={saving}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-100">
                ຍົກເລີກ
              </button>
              <button onClick={save} disabled={saving}
                className={`flex-[2] py-2.5 rounded-lg text-sm font-extrabold text-white transition ${saving ? 'bg-slate-300' : tone.primary}`}>
                {saving ? 'ກຳລັງບັນທຶກ...' : editing ? 'ບັນທຶກການແກ້ໄຂ' : 'ບັນທຶກ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-lg ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function Metric({ label, count, amount, tone, muted = false }) {
  return (
    <div className={`p-4 md:border-l md:border-white/60 ${muted ? 'bg-white/55' : ''}`}>
      <div className={`text-[10px] font-extrabold uppercase tracking-widest ${muted ? 'text-slate-500' : tone.label}`}>
        {label}
      </div>
      <div className={`mt-1 text-2xl font-extrabold ${muted ? 'text-slate-900' : tone.text}`}>
        {fmtNum(count)}
      </div>
      <div className={`mt-0.5 text-xs font-extrabold ${muted ? 'text-slate-600' : tone.accent}`}>
        {fmtPrice(amount)}
      </div>
    </div>
  );
}
