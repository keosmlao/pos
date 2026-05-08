'use client';

import { useState, useEffect, useRef } from 'react';
import { clearCompanyProfileCache } from '@/utils/useCompanyProfile';

const API = '/api';

const blank = {
  name: '', slogan: '', tax_id: '', business_reg_no: '',
  address: '', phone: '', email: '', logo_url: '',
  bank_accounts: [],
};

export default function CompanyProfilePage() {
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    fetch(`${API}/admin/company`).then(r => r.json()).then(data => {
      if (data && typeof data === 'object') {
        setForm({
          ...blank,
          ...data,
          bank_accounts: Array.isArray(data.bank_accounts) ? data.bank_accounts : [],
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const updBank = (i, k, v) => setForm(f => ({
    ...f,
    bank_accounts: f.bank_accounts.map((a, idx) => idx === i ? { ...a, [k]: v } : a),
  }));

  const addBank = () => setForm(f => ({
    ...f,
    bank_accounts: [...f.bank_accounts, { bank_name: '', account_name: '', account_number: '' }],
  }));

  const removeBank = (i) => setForm(f => ({
    ...f,
    bank_accounts: f.bank_accounts.filter((_, idx) => idx !== i),
  }));

  const onLogoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`${API}/admin/uploads/logo`, { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        upd('logo_url', data.path);
        showToast('ອັບໂຫຼດ logo ສຳເລັດ');
      } else {
        showToast(data.error || 'ອັບໂຫຼດບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ອັບໂຫຼດບໍ່ສຳເລັດ', 'error');
    }
    e.target.value = '';
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/company`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        clearCompanyProfileCache();
        showToast('ບັນທຶກສຳເລັດ');
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'ບັນທຶກບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ບັນທຶກບໍ່ສຳເລັດ', 'error');
    }
    setSaving(false);
  };

  if (loading) return <div className="text-slate-400">ກຳລັງໂຫຼດ...</div>;

  const fieldCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition";

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">🏢 ຂໍ້ມູນບໍລິສັດ / ຮ້ານ</h1>
        <p className="text-sm text-slate-500 mt-1">ຂໍ້ມູນເຫຼົ່ານີ້ຈະປະກົດໃນໃບບິນ, ໜ້າ login, ແລະ ເອກະສານອື່ນໆ</p>
      </div>

      {/* Logo */}
      <div className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-slate-200">
        <h2 className="font-bold text-slate-900 mb-3">Logo</h2>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
            {form.logo_url
              ? <img src={form.logo_url} alt="logo" className="w-full h-full object-contain" />
              : <span className="text-3xl text-slate-300">🖼️</span>}
          </div>
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={onLogoSelect} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold transition">
              {form.logo_url ? 'ປ່ຽນ Logo' : 'ອັບໂຫຼດ Logo'}
            </button>
            {form.logo_url && (
              <button onClick={() => upd('logo_url', '')} className="px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-semibold transition">
                ລຶບ Logo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Basic info */}
      <div className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-slate-200">
        <h2 className="font-bold text-slate-900 mb-3">ຂໍ້ມູນພື້ນຖານ</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">ຊື່ຮ້ານ / ບໍລິສັດ *</label>
            <input value={form.name || ''} onChange={e => upd('name', e.target.value)} className={fieldCls} required />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">Slogan / ຄຳຂວັນ</label>
            <input value={form.slogan || ''} onChange={e => upd('slogan', e.target.value)} className={fieldCls} placeholder="ເຊັ່ນ: ລະບົບຈັດການຂາຍໜ້າຮ້ານ" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">ເລກພາສີ (Tax ID)</label>
            <input value={form.tax_id || ''} onChange={e => upd('tax_id', e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">ເລກທະບຽນທຸລະກິດ</label>
            <input value={form.business_reg_no || ''} onChange={e => upd('business_reg_no', e.target.value)} className={fieldCls} />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-slate-200">
        <h2 className="font-bold text-slate-900 mb-3">ຂໍ້ມູນຕິດຕໍ່</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1">ທີ່ຢູ່</label>
            <textarea value={form.address || ''} onChange={e => upd('address', e.target.value)} rows={2} className={fieldCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">ເບີໂທ</label>
            <input value={form.phone || ''} onChange={e => upd('phone', e.target.value)} className={fieldCls} />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
            <input type="email" value={form.email || ''} onChange={e => upd('email', e.target.value)} className={fieldCls} />
          </div>
        </div>
      </div>

      {/* Banks */}
      <div className="bg-white rounded-xl p-5 mb-4 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900">ບັນຊີທະນາຄານ</h2>
          <button onClick={addBank} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition">+ ເພີ່ມບັນຊີ</button>
        </div>
        {form.bank_accounts.length === 0 ? (
          <div className="text-sm text-slate-400 text-center py-6">ຍັງບໍ່ມີບັນຊີທະນາຄານ</div>
        ) : (
          <div className="space-y-3">
            {form.bank_accounts.map((a, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ທະນາຄານ</label>
                  <input value={a.bank_name || ''} onChange={e => updBank(i, 'bank_name', e.target.value)} className={fieldCls} placeholder="BCEL" />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ຊື່ບັນຊີ</label>
                  <input value={a.account_name || ''} onChange={e => updBank(i, 'account_name', e.target.value)} className={fieldCls} />
                </div>
                <div className="md:col-span-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">ເລກບັນຊີ</label>
                  <input value={a.account_number || ''} onChange={e => updBank(i, 'account_number', e.target.value)} className={fieldCls} />
                </div>
                <div className="md:col-span-1">
                  <button onClick={() => removeBank(i)} className="w-full px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-sm font-bold transition">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="sticky bottom-0 bg-slate-100/80 backdrop-blur py-3 -mx-6 px-6 border-t border-slate-200 flex justify-end gap-3">
        <button
          onClick={save}
          disabled={saving || !form.name?.trim()}
          className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition"
        >
          {saving ? 'ກຳລັງບັນທຶກ...' : '💾 ບັນທຶກ'}
        </button>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 ${toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'} text-white px-5 py-2.5 rounded-full shadow-2xl z-50 text-sm font-semibold`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
