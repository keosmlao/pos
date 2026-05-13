'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(Math.round(Number(n) || 0));
const fmtPrice = n => `${fmtNum(n)} ₭`;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const dateAfterDays = (dateText, days) => {
  const date = dateText ? new Date(dateText) : new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const STATUSES = [
  { key: 'draft', label: '📝 ສະບັບຮ່າງ' },
  { key: 'sent', label: '📤 ສົ່ງແລ້ວ' },
  { key: 'accepted', label: '✓ ຍອມຮັບ' },
  { key: 'rejected', label: '✕ ປະຕິເສດ' },
  { key: 'expired', label: '⏱ ໝົດອາຍຸ' },
];

const blankForm = {
  customer_name: '',
  customer_phone: '',
  customer_address: '',
  member_id: null,
  quote_date: new Date().toISOString().slice(0, 10),
  valid_until: dateAfterDays(null, 7),
  status: 'draft',
  discount: 0,
  note: '',
  items: [],
};

export default function QuotationBuilder({ quotationId }) {
  const router = useRouter();
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(!!quotationId);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const [company, setCompany] = useState(null);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [members, setMembers] = useState([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertDueDate, setConvertDueDate] = useState('');
  const [toast, setToast] = useState(null);
  const [data, setData] = useState(null); // raw loaded quotation (for converted_order_id etc.)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    fetch(`${API}/admin/products`).then(r => r.json()).then(p => setProducts(Array.isArray(p) ? p : []));
    fetch(`${API}/admin/company`).then(r => r.json()).then(setCompany);
    fetch(`${API}/members`).then(r => r.json()).then(m => setMembers(Array.isArray(m) ? m : []));
  }, []);

  useEffect(() => {
    if (!quotationId) return;
    fetch(`${API}/admin/quotations/${quotationId}`)
      .then(r => r.json())
      .then(d => {
        if (d?.id) {
          setData(d);
          setForm({
            customer_name: d.customer_name || '',
            customer_phone: d.customer_phone || '',
            customer_address: d.customer_address || '',
            member_id: d.member_id || null,
            quote_date: d.quote_date ? d.quote_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
            valid_until: d.valid_until ? d.valid_until.slice(0, 10) : '',
            status: d.status || 'draft',
            discount: Number(d.discount) || 0,
            note: d.note || '',
            items: (d.items || []).map(it => ({
              product_id: it.product_id,
              product_name: it.product_name || products.find(p => p.id === it.product_id)?.product_name || '',
              quantity: Number(it.quantity) || 0,
              price: Number(it.price) || 0,
            })),
          });
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId]);

  const subtotal = useMemo(() => form.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.price) || 0), 0), [form.items]);
  const total = Math.max(0, subtotal - (Number(form.discount) || 0));
  const isConverted = data?.status === 'converted';
  const canEdit = !isConverted;

  const addItem = (product) => {
    setForm(f => {
      const exist = f.items.find(it => it.product_id === product.id);
      if (exist) {
        return { ...f, items: f.items.map(it => it.product_id === product.id ? { ...it, quantity: (Number(it.quantity) || 0) + 1 } : it) };
      }
      return {
        ...f,
        items: [...f.items, {
          product_id: product.id,
          product_name: product.product_name,
          quantity: 1,
          price: Number(product.selling_price) || 0,
        }],
      };
    });
    setShowProductPicker(false);
    setProductSearch('');
  };

  const addManualLine = () => {
    setForm(f => ({
      ...f,
      items: [...f.items, { product_id: null, product_name: '', quantity: 1, price: 0 }],
    }));
  };

  const updateItem = (idx, patch) => setForm(f => ({
    ...f,
    items: f.items.map((it, i) => i === idx ? { ...it, ...patch } : it),
  }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim();
    return products.filter(p => {
      if (!q) return true;
      return [p.product_name, p.product_code, p.barcode].some(v => String(v || '').toLowerCase().includes(q));
    }).slice(0, 60);
  }, [products, productSearch]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.toLowerCase().trim();
    return members.filter(m => {
      if (!q) return true;
      return [m.name, m.phone, m.member_code].some(v => String(v || '').toLowerCase().includes(q));
    }).slice(0, 60);
  }, [members, memberSearch]);

  const selectMember = (m) => {
    setForm(f => ({
      ...f,
      member_id: m.id,
      customer_name: m.name || '',
      customer_phone: m.phone || '',
      customer_address: m.address || f.customer_address,
    }));
    setShowMemberPicker(false);
    setMemberSearch('');
  };

  const save = async (newStatus) => {
    if (form.items.length === 0) { showToast('ກະລຸນາເພີ່ມລາຍການ', 'error'); return; }
    if (form.items.some(it => !it.product_id && !String(it.product_name || '').trim())) { showToast('ກະລຸນາປ້ອນຊື່ສິນຄ້າ', 'error'); return; }
    setSaving(true);
    try {
      const body = {
        ...form,
        status: newStatus || form.status,
        items: form.items.map(it => ({
          product_id: it.product_id || null,
          product_name: it.product_name || '',
          quantity: Number(it.quantity) || 0,
          price: Number(it.price) || 0,
        })),
      };
      const url = quotationId ? `${API}/admin/quotations/${quotationId}` : `${API}/admin/quotations`;
      const method = quotationId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || 'ບັນທຶກບໍ່ສຳເລັດ', 'error'); return; }
      showToast(quotationId ? 'ບັນທຶກສຳເລັດ' : 'ສ້າງສຳເລັດ');
      if (!quotationId) router.push(`/admin/quotations/${d.id}`);
      else {
        setData(d);
        if (newStatus) setForm(f => ({ ...f, status: newStatus }));
      }
    } catch {
      showToast('ບັນທຶກບໍ່ສຳເລັດ', 'error');
    } finally { setSaving(false); }
  };

  // Quick status update — saves only the status (preserves items)
  const updateStatus = async (newStatus) => {
    if (!quotationId) { setForm(f => ({ ...f, status: newStatus })); return; }
    await save(newStatus);
  };

  const remove = async () => {
    if (!quotationId) return;
    if (!confirm('ລົບໃບສະເໜີລາຄານີ້?')) return;
    const res = await fetch(`${API}/admin/quotations/${quotationId}`, { method: 'DELETE' });
    if (!res.ok) { showToast('ລົບບໍ່ສຳເລັດ', 'error'); return; }
    router.push('/admin/quotations');
  };

  const convert = async () => {
    if (!convertDueDate) { showToast('ກະລຸນາກຳນົດວັນຄົບກຳນົດຊຳລະ', 'error'); return; }
    const missing = form.items.some(it => !it.product_id);
    if (missing) { showToast('ລາຍການທີ່ບໍ່ໄດ້ຜູກກັບສິນຄ້າ ບໍ່ສາມາດອອກບິນໄດ້', 'error'); return; }
    setConverting(true);
    try {
      const res = await fetch(`${API}/admin/quotations/${quotationId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credit_due_date: convertDueDate, note: form.note }),
      });
      const d = await res.json();
      if (!res.ok) { showToast(d.error || 'ປ່ຽນບໍ່ສຳເລັດ', 'error'); return; }
      showToast(`ອອກບິນຕິດໜີ້ສຳເລັດ: ${d.order?.bill_number || '#' + d.order?.id}`);
      setShowConvertModal(false);
      // reload
      const r = await fetch(`${API}/admin/quotations/${quotationId}`);
      setData(await r.json());
    } catch {
      showToast('ປ່ຽນບໍ່ສຳເລັດ', 'error');
    } finally { setConverting(false); }
  };

  const printQuote = () => {
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) { showToast('ບໍ່ສາມາດເປີດປ່ອງພິມໄດ້', 'error'); return; }
    const itemRows = form.items.map((it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><b>${esc(it.product_name || '—')}</b></td>
        <td class="right">${fmtNum(it.quantity)}</td>
        <td class="right">${fmtPrice(it.price)}</td>
        <td class="right money">${fmtPrice((Number(it.quantity) || 0) * (Number(it.price) || 0))}</td>
      </tr>
    `).join('');
    const c = company || {};
    win.document.open();
    win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>ໃບສະເໜີລາຄາ</title>
<style>
  @page { size: A4 portrait; margin: 12mm }
  * { box-sizing: border-box; font-family: 'Noto Sans Lao','Phetsarath OT',system-ui,sans-serif; }
  body { margin: 0; color: #111827; font-size: 12px; line-height: 1.45; }
  .top { display: flex; justify-content: space-between; gap: 20px; border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 14px; }
  .brand img { max-height: 64px; max-width: 120px; object-fit: contain; }
  .brand .name { font-size: 20px; font-weight: 900; }
  .info { font-size: 11px; color: #475569; line-height: 1.4; margin-top: 2px; }
  .doc h1 { margin: 0; font-size: 22px; color: #b91c1c; font-weight: 900; }
  .doc .meta { font-size: 11px; color: #475569; margin-top: 3px; }
  .doc .meta b { color: #111827; }
  .box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px dashed #e5e7eb; }
  .row:last-child { border-bottom: 0; }
  .label { color: #64748b; font-weight: 700; }
  .value { font-weight: 800; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #111827; color: white; padding: 7px 8px; text-align: left; font-size: 11px; font-weight: 800; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  th.right, td.right { text-align: right; }
  .money { font-family: ui-monospace,SFMono-Regular,Menlo,monospace; font-variant-numeric: tabular-nums; }
  .totals { margin-left: auto; width: 280px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-top: 14px; }
  .totals .row { padding: 8px 10px; border-bottom: 1px dashed #e2e8f0; }
  .totals .grand { background: #fef2f2; color: #991b1b; font-size: 15px; font-weight: 900; }
  .note { margin-top: 14px; padding: 9px 11px; border: 1px dashed #94a3b8; border-radius: 8px; color: #334155; font-size: 11px; }
  .sign { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 38px; text-align: center; color: #475569; }
  .line { height: 32px; border-bottom: 1px solid #94a3b8; margin-bottom: 6px; }
</style></head><body>
  <div class="top">
    <div class="brand">
      ${c.logo_url ? `<img src="${location.origin}${esc(c.logo_url)}" />` : ''}
      <div class="name">${esc(c.name || 'POS')}</div>
      ${c.address ? `<div class="info">${esc(c.address)}</div>` : ''}
      <div class="info">${[c.phone, c.email].filter(Boolean).map(esc).join(' · ')}</div>
      ${(c.tax_id || c.business_reg_no) ? `<div class="info">${[c.tax_id && `TAX: ${esc(c.tax_id)}`, c.business_reg_no && `REG: ${esc(c.business_reg_no)}`].filter(Boolean).join(' · ')}</div>` : ''}
    </div>
    <div class="doc">
      <h1>ໃບສະເໜີລາຄາ</h1>
      <div class="meta"><b>ເລກ:</b> ${esc(data?.quotation_number || '—')}</div>
      <div class="meta"><b>ວັນທີ:</b> ${esc(new Date(form.quote_date).toLocaleDateString('lo-LA'))}</div>
      ${form.valid_until ? `<div class="meta"><b>ໝົດອາຍຸ:</b> ${esc(new Date(form.valid_until).toLocaleDateString('lo-LA'))}</div>` : ''}
    </div>
  </div>
  <div class="box grid">
    <div class="row"><span class="label">ລູກຄ້າ</span><span class="value">${esc(form.customer_name || '—')}</span></div>
    <div class="row"><span class="label">ເບີໂທ</span><span class="value">${esc(form.customer_phone || '—')}</span></div>
    ${form.customer_address ? `<div class="row" style="grid-column: span 2"><span class="label">ທີ່ຢູ່</span><span class="value">${esc(form.customer_address)}</span></div>` : ''}
  </div>
  <table>
    <thead><tr><th>#</th><th>ສິນຄ້າ / ບໍລິການ</th><th class="right">ຈຳນວນ</th><th class="right">ລາຄາ</th><th class="right">ລວມ</th></tr></thead>
    <tbody>${itemRows || '<tr><td colspan="5">ບໍ່ມີລາຍການ</td></tr>'}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span class="label">ລວມຍ່ອຍ</span><span class="value money">${fmtPrice(subtotal)}</span></div>
    ${Number(form.discount) > 0 ? `<div class="row"><span class="label">ສ່ວນຫຼຸດ</span><span class="value money">−${fmtPrice(form.discount)}</span></div>` : ''}
    <div class="row grand"><span>ລວມທັງໝົດ</span><span class="value money">${fmtPrice(total)}</span></div>
  </div>
  ${form.note ? `<div class="note"><b>ໝາຍເຫດ:</b> ${esc(form.note)}</div>` : ''}
  <div class="sign"><div><div class="line"></div>ຜູ້ສະເໜີລາຄາ</div><div><div class="line"></div>ຜູ້ຮັບລາຍການ</div></div>
  <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 400); }</script>
</body></html>`);
    win.document.close();
  };

  if (loading) return <div className="py-10 text-center text-slate-500">ກຳລັງໂຫຼດ...</div>;

  return (
    <div className="space-y-4 text-[13px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Link href="/admin/quotations" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-white">{'<'} ກັບ</Link>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Quotation builder</div>
              <h1 className="mt-0.5 truncate text-2xl font-extrabold text-slate-950">
                {quotationId ? (data?.quotation_number || `#${quotationId}`) : 'ສ້າງໃບສະເໜີລາຄາໃໝ່'}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-extrabold text-slate-600">
                  {STATUSES.find(s => s.key === form.status)?.label || form.status}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500">
                  {fmtNum(form.items.length)} ລາຍການ
                </span>
                {isConverted && <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-extrabold text-violet-700">ອອກບິນແລ້ວ</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
          {quotationId && (
            <button onClick={printQuote}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50">🖨 ພິມ</button>
          )}
          {quotationId && !isConverted && form.status === 'accepted' && (
            <button onClick={() => { setConvertDueDate(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)); setShowConvertModal(true); }}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 text-xs font-extrabold">
              🧾 ອອກບິນຂາຍຕິດໜີ້
            </button>
          )}
          {canEdit && (
            <button onClick={() => save()} disabled={saving}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-extrabold disabled:opacity-50">
              {saving ? 'ກຳລັງບັນທຶກ...' : '💾 ບັນທຶກ'}
            </button>
          )}
          {quotationId && !isConverted && (
            <button onClick={remove}
              className="rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-2 text-xs font-extrabold">🗑 ລົບ</button>
          )}
          </div>
        </div>
      </div>

      {isConverted && data?.converted_order_id && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm">
          <span className="font-extrabold text-violet-700">🧾 ໄດ້ປ່ຽນເປັນບິນຂາຍຕິດໜີ້ແລ້ວ:</span>
          <Link href={`/admin/sales`} className="ml-2 font-bold text-violet-800 underline">ເບິ່ງໃນປະຫວັດການຂາຍ</Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Customer</div>
                <h2 className="text-base font-extrabold text-slate-900">ຂໍ້ມູນລູກຄ້າ</h2>
              </div>
              {canEdit && (
                <button onClick={() => setShowMemberPicker(true)} type="button"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-700 hover:bg-emerald-100">
                  {form.member_id ? '🧑 ປ່ຽນສະມາຊິກ' : '🧑 ເລືອກສະມາຊິກ'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="xl:col-span-1">
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">ຊື່ລູກຄ້າ *</label>
                <input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} disabled={!canEdit}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-red-400 focus:bg-white disabled:text-slate-500" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">ເບີໂທ</label>
                <input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} disabled={!canEdit}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-red-400 focus:bg-white disabled:text-slate-500" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">ທີ່ຢູ່</label>
                <input value={form.customer_address} onChange={e => setForm({ ...form, customer_address: e.target.value })} disabled={!canEdit}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-red-400 focus:bg-white disabled:text-slate-500" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">ວັນທີ</label>
                <input type="date" value={form.quote_date} onChange={e => setForm({ ...form, quote_date: e.target.value, valid_until: dateAfterDays(e.target.value, 7) })} disabled={!canEdit}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-red-400 disabled:text-slate-500" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">ໝົດອາຍຸ</label>
                <input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} disabled={!canEdit}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-red-400 disabled:text-slate-500" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">ສະຖານະ</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} disabled={!canEdit}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-red-400 disabled:text-slate-500">
                  {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </section>

          {quotationId && !isConverted && (
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-500">ປ່ຽນສະຖານະ</span>
                {STATUSES.map(s => {
                  const isCurrent = form.status === s.key;
                  const tone = {
                    draft: isCurrent ? 'border-slate-400 bg-slate-100 text-slate-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    sent: isCurrent ? 'border-red-300 bg-blue-50 text-red-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50',
                    accepted: isCurrent ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-emerald-50',
                    rejected: isCurrent ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-rose-50',
                    expired: isCurrent ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-amber-50',
                  };
                  return (
                    <button key={s.key} type="button" onClick={() => updateStatus(s.key)} disabled={saving || isCurrent}
                      className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition disabled:opacity-100 ${tone[s.key]}`}>
                      {s.label} {isCurrent && '✓'}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Line items</div>
                <h2 className="text-base font-extrabold text-slate-900">ລາຍການສິນຄ້າ / ບໍລິການ</h2>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button onClick={() => setShowProductPicker(true)} type="button"
                    className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-extrabold text-white hover:bg-slate-800">+ ສິນຄ້າ</button>
                  <button onClick={addManualLine} type="button"
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50">+ ບໍລິການ</button>
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="w-10 px-4 py-3">#</th>
                    <th className="px-3 py-3">ລາຍການ</th>
                    <th className="w-28 px-3 py-3 text-right">ຈຳນວນ</th>
                    <th className="w-36 px-3 py-3 text-right">ລາຄາ</th>
                    <th className="w-36 px-3 py-3 text-right">ລວມ</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {form.items.map((it, i) => {
                    const amount = (Number(it.quantity) || 0) * (Number(it.price) || 0);
                    return (
                      <tr key={i} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-mono text-xs text-slate-400">{i + 1}</td>
                        <td className="px-3 py-3">
                          <input value={it.product_name || ''} onChange={e => updateItem(i, { product_name: e.target.value })} disabled={!canEdit || !!it.product_id}
                            placeholder={it.product_id ? '' : 'ປ້ອນຊື່ບໍລິການ...'}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-red-400 disabled:bg-slate-50 disabled:text-slate-700" />
                          {it.product_id && <div className="mt-1 font-mono text-[10px] text-slate-400">ສິນຄ້າ #{it.product_id}</div>}
                        </td>
                        <td className="px-3 py-3">
                          <input type="number" min="0" step="any" value={it.quantity} onChange={e => updateItem(i, { quantity: e.target.value })} disabled={!canEdit}
                            className="w-full rounded-xl border border-slate-200 px-2 py-2 text-right font-mono text-sm font-bold outline-none focus:border-red-400" />
                        </td>
                        <td className="px-3 py-3">
                          <input type="number" min="0" step="any" value={it.price} onChange={e => updateItem(i, { price: e.target.value })} disabled={!canEdit}
                            className="w-full rounded-xl border border-slate-200 px-2 py-2 text-right font-mono text-sm font-bold outline-none focus:border-red-400" />
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-extrabold text-slate-900">{fmtPrice(amount)}</td>
                        <td className="px-2 py-3 text-center">
                          {canEdit && <button onClick={() => removeItem(i)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600">x</button>}
                        </td>
                      </tr>
                    );
                  })}
                  {form.items.length === 0 && (
                    <tr><td colSpan="6" className="py-14 text-center text-slate-400">ຍັງບໍ່ມີລາຍການ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Summary</div>
            <div className="mt-2 rounded-2xl bg-slate-950 p-4 text-white">
              <div className="text-[11px] font-bold text-slate-400">ລວມທັງໝົດ</div>
              <div className="mt-1 font-mono text-3xl font-extrabold">{fmtPrice(total)}</div>
              <div className="mt-3 h-1 rounded-full bg-red-500" />
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-xs font-bold text-slate-500">ລວມຍ່ອຍ</span>
                <span className="font-mono font-extrabold text-slate-900">{fmtPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-xs font-bold text-slate-500">ສ່ວນຫຼຸດ</span>
                <input type="number" min="0" value={form.discount} onChange={e => setForm({ ...form, discount: e.target.value })} disabled={!canEdit}
                  className="w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-mono text-sm font-bold text-amber-700 outline-none focus:border-red-400" />
              </div>
            </div>
            {canEdit && (
              <button onClick={() => save()} disabled={saving}
                className="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກໃບສະເໜີ'}
              </button>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">ໝາຍເຫດ</label>
            <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} disabled={!canEdit}
              rows={6}
              placeholder="ເງື່ອນໄຂ, ກຳນົດສົ່ງ, ການຮັບປະກັນ..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-red-400 focus:bg-white disabled:text-slate-500" />
          </section>
        </aside>
      </div>

      {/* Product picker modal */}
      {showProductPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowProductPicker(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">ເລືອກສິນຄ້າ</h3>
              <button onClick={() => setShowProductPicker(false)} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded">✕</button>
            </div>
            <div className="p-3 border-b border-slate-100">
              <input value={productSearch} onChange={e => setProductSearch(e.target.value)} autoFocus
                placeholder="ຄົ້ນຫາ ຊື່, ລະຫັດ, barcode..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredProducts.map(p => (
                <button key={p.id} onClick={() => addItem(p)}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-800 truncate">{p.product_name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{p.product_code || '—'} · ສະຕ໊ອກ {fmtNum(p.qty_on_hand)}</div>
                  </div>
                  <div className="font-mono font-extrabold text-slate-800">{fmtPrice(p.selling_price)}</div>
                </button>
              ))}
              {filteredProducts.length === 0 && <div className="py-10 text-center text-slate-400">ບໍ່ພົບສິນຄ້າ</div>}
            </div>
          </div>
        </div>
      )}

      {/* Member picker modal */}
      {showMemberPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowMemberPicker(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">ເລືອກສະມາຊິກ</h3>
              <button onClick={() => setShowMemberPicker(false)} className="w-7 h-7 bg-slate-100 hover:bg-slate-200 rounded">✕</button>
            </div>
            <div className="p-3 border-b border-slate-100">
              <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} autoFocus
                placeholder="ຄົ້ນຫາ ຊື່, ເບີໂທ, ລະຫັດ..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {filteredMembers.map(m => (
                <button key={m.id} onClick={() => selectMember(m)}
                  className="w-full px-4 py-2.5 text-left hover:bg-slate-50">
                  <div className="font-bold text-slate-800">{m.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{m.member_code} · {m.phone || '—'}</div>
                </button>
              ))}
              {filteredMembers.length === 0 && <div className="py-10 text-center text-slate-400">ບໍ່ພົບສະມາຊິກ</div>}
            </div>
          </div>
        </div>
      )}

      {/* Convert modal */}
      {showConvertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !converting && setShowConvertModal(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200">
              <h3 className="text-base font-extrabold text-slate-900">🧾 ປ່ຽນເປັນບິນຂາຍຕິດໜີ້</h3>
            </div>
            <div className="max-h-[72vh] overflow-y-auto p-5 space-y-4">
              <p className="text-xs text-slate-600">
                ການປ່ຽນຈະສ້າງບິນຂາຍຕິດໜີ້ໃໝ່ + ຫັກສະຕ໊ອກສິນຄ້າ. ການກະທຳນີ້ບໍ່ສາມາດກັບຄືນໄດ້.
              </p>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <InfoBox label="ເລກໃບສະເໜີ" value={data?.quotation_number || `#${quotationId}`} />
                <InfoBox label="ສະຖານະ" value={STATUSES.find(s => s.key === form.status)?.label || form.status} />
                <InfoBox label="ລູກຄ້າ" value={form.customer_name || '—'} />
                <InfoBox label="ເບີໂທ" value={form.customer_phone || '—'} />
                <InfoBox label="ວັນທີໃບສະເໜີ" value={form.quote_date ? new Date(form.quote_date).toLocaleDateString('lo-LA') : '—'} />
                <InfoBox label="ໝົດອາຍຸໃບສະເໜີ" value={form.valid_until ? new Date(form.valid_until).toLocaleDateString('lo-LA') : '—'} />
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500">ລາຍການທີ່ຈະອອກບິນ</div>
                  <div className="text-[11px] font-bold text-slate-400">{fmtNum(form.items.length)} ລາຍການ</div>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {form.items.map((it, i) => {
                    const amount = (Number(it.quantity) || 0) * (Number(it.price) || 0);
                    return (
                      <div key={i} className="grid grid-cols-[32px_1fr_auto] gap-2 px-3 py-2.5 text-xs">
                        <div className="font-mono text-slate-400">{i + 1}</div>
                        <div className="min-w-0">
                          <div className="truncate font-extrabold text-slate-800">{it.product_name || '—'}</div>
                          <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                            {fmtNum(it.quantity)} x {fmtPrice(it.price)}
                            {!it.product_id && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700">ບໍລິການ/ບໍ່ຜູກສິນຄ້າ</span>}
                          </div>
                        </div>
                        <div className="font-mono font-extrabold text-slate-900">{fmtPrice(amount)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_260px]">
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">ວັນຄົບກຳນົດຊຳລະ *</label>
                  <input type="date" value={convertDueDate} onChange={e => setConvertDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold" />
                  {form.note && (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
                      <b>ໝາຍເຫດ:</b> {form.note}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                  <div className="flex justify-between px-3 py-2 text-xs">
                    <span className="font-bold text-amber-800">ລວມຍ່ອຍ</span>
                    <span className="font-mono font-extrabold text-amber-900">{fmtPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between border-t border-amber-200 px-3 py-2 text-xs">
                    <span className="font-bold text-amber-800">ສ່ວນຫຼຸດ</span>
                    <span className="font-mono font-extrabold text-amber-900">{fmtPrice(form.discount)}</span>
                  </div>
                  <div className="flex justify-between border-t-2 border-amber-300 bg-amber-100 px-3 py-3">
                    <span className="font-extrabold text-amber-900">ຍອດຕິດໜີ້</span>
                    <span className="font-mono text-lg font-extrabold text-amber-950">{fmtPrice(total)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button onClick={() => setShowConvertModal(false)} disabled={converting}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold">ຍົກເລີກ</button>
              <button onClick={convert} disabled={converting}
                className="flex-[2] py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-extrabold">
                {converting ? 'ກຳລັງປ່ຽນ...' : '✓ ຢືນຢັນອອກບິນ'}
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

function InfoBox({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-sm font-extrabold text-slate-900">{value}</div>
    </div>
  );
}
