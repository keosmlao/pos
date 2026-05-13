'use client';

import { useState, useEffect, useRef } from 'react';
import { clearCompanyProfileCache } from '@/utils/useCompanyProfile';
import { COSTING_METHODS, DEFAULT_COSTING_METHOD } from '@/lib/costingMethods';

const API = '/api';

const blank = {
  name: '', slogan: '', tax_id: '', business_reg_no: '',
  address: '', phone: '', email: '', logo_url: '',
  bank_accounts: [],
  default_costing_method: DEFAULT_COSTING_METHOD,
  vat_enabled: false,
  vat_rate: 10,
  vat_mode: 'exclusive',
  vat_label: 'VAT',
  rounding_mode: 'none',
  rounding_step: 0,
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
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        clearCompanyProfileCache();
        setForm(f => ({ ...f, ...data, bank_accounts: Array.isArray(data.bank_accounts) ? data.bank_accounts : f.bank_accounts }));
        showToast('ບັນທຶກສຳເລັດ');
      } else {
        showToast(data.error || 'ບັນທຶກບໍ່ສຳເລັດ', 'error');
      }
    } catch {
      showToast('ບັນທຶກບໍ່ສຳເລັດ', 'error');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-400 shadow-sm">
        ກຳລັງໂຫຼດ...
      </div>
    );
  }

  const fieldCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-500/10";
  const filledItems = [
    form.name?.trim(),
    form.phone?.trim(),
    form.address?.trim(),
    form.logo_url?.trim(),
    form.tax_id?.trim() || form.business_reg_no?.trim(),
  ].filter(Boolean).length;

  return (
    <div className="space-y-5 pb-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-950 px-5 py-5 text-white">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-red-300">Company settings</div>
            <h1 className="mt-1 text-2xl font-extrabold">ຂໍ້ມູນບໍລິສັດ / ຮ້ານ</h1>
            <p className="mt-1 text-sm font-semibold text-slate-300">ຂໍ້ມູນສຳລັບໃບບິນ, login, ໃບສະເໜີລາຄາ ແລະ ເອກະສານອື່ນໆ</p>
          </div>
          <button
            onClick={save}
            disabled={saving || !form.name?.trim()}
            className="rounded-xl bg-red-600 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-red-950/20 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກການຕັ້ງຄ່າ'}
          </button>
        </div>
        <div className="grid grid-cols-1 divide-y divide-slate-100 bg-slate-50/70 md:grid-cols-3 md:divide-x md:divide-y-0">
          <StatusItem label="ຂໍ້ມູນຫຼັກ" value={`${filledItems}/5`} />
          <StatusItem label="ບັນຊີທະນາຄານ" value={form.bank_accounts.length} />
          <StatusItem label="VAT" value={form.vat_enabled ? `${form.vat_rate || 0}%` : 'ປິດ'} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-slate-950 p-5 text-white">
              <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white shadow-lg">
                {form.logo_url
                  ? <img src={form.logo_url} alt="logo" className="h-full w-full object-contain" />
                  : <span className="text-5xl font-black text-slate-300">{(form.name || 'P').charAt(0).toUpperCase()}</span>}
              </div>
              <div className="mt-4 text-center">
                <div className="truncate text-xl font-extrabold">{form.name || 'ຊື່ຮ້ານ'}</div>
                <div className="mt-1 truncate text-xs font-semibold text-slate-400">{form.slogan || 'Slogan / ຄຳຂວັນ'}</div>
              </div>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <PreviewLine label="ເບີໂທ" value={form.phone} />
              <PreviewLine label="Email" value={form.email} />
              <PreviewLine label="Tax ID" value={form.tax_id} />
              <PreviewLine label="ທະບຽນ" value={form.business_reg_no} />
              <PreviewLine label="ທີ່ຢູ່" value={form.address} multiline />
              <div className="pt-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={onLogoSelect} className="hidden" />
                <button onClick={() => fileRef.current?.click()} className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-extrabold text-slate-800 transition hover:bg-slate-200">
                  {form.logo_url ? 'ປ່ຽນ Logo' : 'ອັບໂຫຼດ Logo'}
                </button>
                {form.logo_url && (
                  <button onClick={() => upd('logo_url', '')} className="mt-2 w-full rounded-xl px-4 py-2 text-sm font-bold text-rose-600 transition hover:bg-rose-50">
                    ລຶບ Logo
                  </button>
                )}
              </div>
            </div>
          </section>
        </aside>

        <main className="space-y-4">
          <Panel title="ຂໍ້ມູນພື້ນຖານ" subtitle="ຈະນຳໄປສະແດງໃນໃບບິນ ແລະ ເອກະສານທຸລະກິດ">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="ຊື່ຮ້ານ / ບໍລິສັດ *" className="md:col-span-2">
                <input value={form.name || ''} onChange={e => upd('name', e.target.value)} className={fieldCls} required />
              </Field>
              <Field label="Slogan / ຄຳຂວັນ" className="md:col-span-2">
                <input value={form.slogan || ''} onChange={e => upd('slogan', e.target.value)} className={fieldCls} placeholder="ເຊັ່ນ: ລະບົບຈັດການຂາຍໜ້າຮ້ານ" />
              </Field>
              <Field label="ເລກພາສີ (Tax ID)">
                <input value={form.tax_id || ''} onChange={e => upd('tax_id', e.target.value)} className={fieldCls} />
              </Field>
              <Field label="ເລກທະບຽນທຸລະກິດ">
                <input value={form.business_reg_no || ''} onChange={e => upd('business_reg_no', e.target.value)} className={fieldCls} />
              </Field>
            </div>
          </Panel>

          <Panel title="ຂໍ້ມູນຕິດຕໍ່" subtitle="ໃຊ້ສຳລັບສ່ວນຫົວເອກະສານ ແລະ ການຕິດຕໍ່ລູກຄ້າ">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="ທີ່ຢູ່" className="md:col-span-2">
                <textarea value={form.address || ''} onChange={e => upd('address', e.target.value)} rows={3} className={fieldCls} />
              </Field>
              <Field label="ເບີໂທ">
                <input value={form.phone || ''} onChange={e => upd('phone', e.target.value)} className={fieldCls} />
              </Field>
              <Field label="Email">
                <input type="email" value={form.email || ''} onChange={e => upd('email', e.target.value)} className={fieldCls} />
              </Field>
            </div>
          </Panel>

          <Panel
            title="ບັນຊີທະນາຄານ"
            subtitle="ບັນຊີຈະສະແດງໃນໃບບິນ ແລະ ຕົວເລືອກຮັບເງິນ"
            action={<button onClick={addBank} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-emerald-700">+ ເພີ່ມບັນຊີ</button>}
          >
            {form.bank_accounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
                ຍັງບໍ່ມີບັນຊີທະນາຄານ
              </div>
            ) : (
              <div className="space-y-3">
                {form.bank_accounts.map((a, i) => (
                  <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Bank account {i + 1}</div>
                      <button onClick={() => removeBank(i)} className="rounded-lg px-2 py-1 text-sm font-bold text-rose-600 transition hover:bg-rose-50">ລຶບ</button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Field label="ທະນາຄານ">
                        <input value={a.bank_name || ''} onChange={e => updBank(i, 'bank_name', e.target.value)} className={fieldCls} placeholder="BCEL" />
                      </Field>
                      <Field label="ຊື່ບັນຊີ">
                        <input value={a.account_name || ''} onChange={e => updBank(i, 'account_name', e.target.value)} className={fieldCls} />
                      </Field>
                      <Field label="ເລກບັນຊີ">
                        <input value={a.account_number || ''} onChange={e => updBank(i, 'account_number', e.target.value)} className={fieldCls} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="ວິທີຄຳນວນຕົ້ນທຶນສິນຄ້າ" subtitle="ຄ່າມາດຕະຖານສຳລັບສິນຄ້າທີ່ບໍ່ໄດ້ກຳນົດສະເພາະ">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {COSTING_METHODS.map(m => {
            const active = (form.default_costing_method || DEFAULT_COSTING_METHOD) === m.value
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => upd('default_costing_method', m.value)}
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  active ? 'border-red-500 bg-red-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className={`text-sm font-extrabold ${active ? 'text-red-700' : 'text-slate-800'}`}>{m.label}</span>
                  <span className="text-[10px] font-bold text-slate-500">{m.sub}</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500 leading-snug">{m.desc}</div>
              </button>
            )
          })}
            </div>
          </Panel>

          <Panel
            title="ການຄິດ VAT / ພາສີ"
            subtitle="ໃຊ້ໃນບິນຂາຍ, ໃບສະເໜີລາຄາ ແລະ ລາຍງານພາສີ"
            action={
              <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-xs font-extrabold ${form.vat_enabled ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                <input
                  type="checkbox"
                  checked={!!form.vat_enabled}
                  onChange={(e) => upd('vat_enabled', e.target.checked)}
                  className="h-4 w-4 accent-red-600"
                />
                {form.vat_enabled ? 'ເປີດໃຊ້' : 'ປິດ'}
              </label>
            }
          >
            {form.vat_enabled ? (
              <>
                <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="ອັດຕາ (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={form.vat_rate ?? 0}
                  onChange={(e) => upd('vat_rate', e.target.value === '' ? '' : Number(e.target.value))}
                  className={fieldCls}
                />
                  </Field>
                  <Field label="ປ້າຍກຳກັບ">
                <input
                  value={form.vat_label || ''}
                  onChange={(e) => upd('vat_label', e.target.value)}
                  placeholder="VAT / ພາສີມູນຄ່າເພີ່ມ"
                  className={fieldCls}
                />
                  </Field>
                  <Field label="ໂໝດ">
                <select
                  value={form.vat_mode || 'exclusive'}
                  onChange={(e) => upd('vat_mode', e.target.value)}
                  className={fieldCls}
                >
                  <option value="exclusive">ແຍກນອກ (ບວກເພີ່ມ)</option>
                  <option value="inclusive">ລວມໃນ (ລາຄາລວມ VAT ແລ້ວ)</option>
                </select>
                  </Field>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] leading-relaxed text-slate-600">
              {form.vat_mode === 'inclusive'
                ? <><b>ລວມໃນ:</b> ລາຄາສິນຄ້າທີ່ສະແດງ = ມີ VAT ແລ້ວ. ບີນຈະແສດງສ່ວນ VAT ທີ່ລວມຢູ່ພາຍໃນ.</>
                : <><b>ແຍກນອກ:</b> ບີນຈະຄິດ VAT ເພີ່ມຈາກລາຄາສິນຄ້າ. ລາຄາລວມ = subtotal + VAT.</>}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
                VAT ຖືກປິດຢູ່
              </div>
            )}
          </Panel>

          <Panel
            title="ປັດເສດສະຕັງ (Bill rounding)"
            subtitle="ປັດຍອດທ້າຍບີນເພື່ອຫຼີກລ້ຽງເສດເງິນທີ່ສຸດ"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="ໂໝດ">
                <select
                  value={form.rounding_mode || 'none'}
                  onChange={(e) => upd('rounding_mode', e.target.value)}
                  className={fieldCls}
                >
                  <option value="none">ບໍ່ປັດ</option>
                  <option value="nearest">ປັດໃກ້ສຸດ (ຂຶ້ນ/ລົງ)</option>
                  <option value="up">ປັດຂຶ້ນສະເໝີ</option>
                  <option value="down">ປັດລົງສະເໝີ</option>
                </select>
              </Field>
              <Field label="ຂັ້ນຕ່ຳ (₭)">
                <select
                  value={form.rounding_step || 0}
                  onChange={(e) => upd('rounding_step', Number(e.target.value))}
                  disabled={!form.rounding_mode || form.rounding_mode === 'none'}
                  className={fieldCls}
                >
                  <option value={0}>—</option>
                  <option value={100}>100 ₭</option>
                  <option value={500}>500 ₭</option>
                  <option value={1000}>1,000 ₭</option>
                  <option value={5000}>5,000 ₭</option>
                </select>
              </Field>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12px] leading-relaxed text-slate-600">
              ຕົວຢ່າງ: ຍອດ 12,345 ₭ → ປັດໃກ້ສຸດ 1,000 = <b>12,000 ₭</b>; ປັດຂຶ້ນ 500 = <b>12,500 ₭</b>
            </div>
          </Panel>
        </main>
      </div>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t border-slate-200 bg-slate-100/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <button
          onClick={save}
          disabled={saving || !form.name?.trim()}
          className="rounded-xl bg-red-600 px-6 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ'}
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

function Panel({ title, subtitle, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-950">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs font-semibold text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({ label, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function StatusItem({ label, value }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-extrabold text-slate-950">{value}</div>
    </div>
  );
}

function PreviewLine({ label, value, multiline = false }) {
  return (
    <div className={multiline ? '' : 'flex items-center justify-between gap-3'}>
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`${multiline ? 'mt-1 leading-relaxed' : 'truncate text-right'} text-sm font-bold text-slate-700`}>
        {value || '—'}
      </div>
    </div>
  );
}
