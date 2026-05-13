'use client';

import { useEffect, useMemo, useState } from 'react';
import SearchSelect from '@/components/SearchSelect';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { useLocations } from '@/utils/useLocations';

const API = '/api';
const fmtNum = n => new Intl.NumberFormat('lo-LA').format(n || 0);
const fmtPrice = n => new Intl.NumberFormat('lo-LA').format(Math.round(n || 0)) + ' ກີບ';

const emptyForm = {
  member_code: '',
  name: '',
  phone: '',
  email: '',
  province: '',
  district: '',
  village: '',
  address: '',
  tier: 'standard',
  points: 0,
  total_spent: 0,
  active: true,
  note: '',
};

const tierLabel = {
  standard: 'Standard',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

export default function MembersPage() {
  const laoLocations = useLocations();
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`${API}/admin/members?${params}`);
      setMembers(await res.json());
      setPage(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const active = members.filter(m => m.active !== false);
    return {
      count: active.length,
      points: active.reduce((s, m) => s + (Number(m.points) || 0), 0),
      spent: active.reduce((s, m) => s + (Number(m.total_spent) || 0), 0),
      vip: active.filter(m => ['gold', 'platinum'].includes(m.tier)).length,
    };
  }, [members]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({
      member_code: m.member_code || '',
      name: m.name || '',
      phone: m.phone || '',
      email: m.email || '',
      province: m.province || '',
      district: m.district || '',
      village: m.village || '',
      address: m.address || '',
      tier: m.tier || 'standard',
      points: Number(m.points) || 0,
      total_spent: Number(m.total_spent) || 0,
      active: m.active !== false,
      note: m.note || '',
    });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.province || !form.district || !form.village) {
      alert('ກະລຸນາເລືອກແຂວງ/ເມືອງ/ບ້ານ');
      return;
    }
    const url = editing ? `${API}/admin/members/${editing.id}` : `${API}/admin/members`;
    const method = editing ? 'PATCH' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'ບັນທຶກບໍ່ສຳເລັດ');
      return;
    }
    setEditing(null);
    setForm(emptyForm);
    setShowForm(false);
    await load();
  };

  const provinces = Object.keys(laoLocations);
  const districts = form.province ? Object.keys(laoLocations[form.province] || {}) : [];
  const villages = form.province && form.district ? (laoLocations[form.province]?.[form.district] || []) : [];
  const setProvince = (province) => setForm({ ...form, province, district: '', village: '' });
  const setDistrict = (district) => setForm({ ...form, district, village: '' });
  const totalPages = Math.max(1, Math.ceil(members.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedMembers = members.slice((safePage - 1) * perPage, safePage * perPage);
  const startNo = members.length ? (safePage - 1) * perPage + 1 : 0;
  const endNo = Math.min(safePage * perPage, members.length);

  useEffect(() => {
    setPage(p => Math.min(p, Math.max(1, Math.ceil(members.length / perPage))));
  }, [members.length, perPage]);

  const remove = async (m) => {
    if (!confirm(`ປິດໃຊ້ງານສະມາຊິກ ${m.name}?`)) return;
    const res = await fetch(`${API}/admin/members/${m.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'ປິດໃຊ້ງານບໍ່ສຳເລັດ');
      return;
    }
    await load();
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Members"
        title="⭐ ສະມາຊິກ"
        subtitle={`${fmtNum(stats.count)} ຄົນ`}
        action={
          <button onClick={openCreate}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/20">
            + ເພີ່ມສະມາຊິກ
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-red-700">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">ສະມາຊິກ</div>
          <div className="text-xl font-extrabold">{fmtNum(stats.count)}</div>
        </div>
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-emerald-700">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">ຄະແນນລວມ</div>
          <div className="text-xl font-extrabold">{fmtNum(stats.points)}</div>
        </div>
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-amber-700">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">VIP</div>
          <div className="text-xl font-extrabold">{fmtNum(stats.vip)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-700">
          <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">ຍອດຊື້ລວມ</div>
          <div className="text-xl font-extrabold">{fmtPrice(stats.spent)}</div>
        </div>
      </div>

      <div>
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-slate-200 flex flex-wrap gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load(); }}
              placeholder="ຄົ້ນຫາ ລະຫັດ, ຊື່, ເບີໂທ..."
              className="min-w-[220px] flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-500" />
            <button onClick={load}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold">
              {loading ? '...' : 'ຄົ້ນຫາ'}
            </button>
            <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
              className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 outline-none">
              <option value={10}>10 / ໜ້າ</option>
              <option value={20}>20 / ໜ້າ</option>
              <option value={50}>50 / ໜ້າ</option>
              <option value={100}>100 / ໜ້າ</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2">ສະມາຊິກ</th>
                  <th className="text-left px-3 py-2">ຕິດຕໍ່</th>
                  <th className="text-right px-3 py-2">ຄະແນນ</th>
                  <th className="text-right px-3 py-2">ຍອດຊື້</th>
                  <th className="text-center px-3 py-2">Tier</th>
                  <th className="text-right px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedMembers.map(m => (
                  <tr key={m.id} className={`${m.active === false ? 'opacity-50' : ''} hover:bg-red-50/20`}>
                    <td className="px-3 py-2">
                      <div className="font-extrabold text-slate-900">{m.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{m.member_code}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      <div>{m.phone || '—'}</div>
                      <div className="text-[10px] text-slate-400">{[m.village, m.district, m.province].filter(Boolean).join(', ') || m.email || ''}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-extrabold text-emerald-700 font-mono-t">{fmtNum(m.points)}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-700 font-mono-t">{fmtPrice(m.total_spent)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">{tierLabel[m.tier] || m.tier}</span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => openEdit(m)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-[11px] font-bold text-slate-700 mr-1">
                        ແກ້ໄຂ
                      </button>
                      <button onClick={() => remove(m)}
                        className="px-2 py-1 bg-rose-50 hover:bg-rose-100 rounded text-[11px] font-bold text-rose-700">
                        ປິດ
                      </button>
                    </td>
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">ຍັງບໍ່ມີສະມາຊິກ</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2">
            <div className="text-[11px] font-medium text-slate-500">
              ສະແດງ {fmtNum(startNo)}-{fmtNum(endNo)} ຈາກ {fmtNum(members.length)} ລາຍການ
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage(1)} disabled={safePage <= 1}
                className="px-2 py-1 rounded border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50">
                ທຳອິດ
              </button>
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage <= 1}
                className="px-2 py-1 rounded border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50">
                ກ່ອນ
              </button>
              <span className="px-2 py-1 text-xs font-extrabold text-slate-700">
                {fmtNum(safePage)} / {fmtNum(totalPages)}
              </span>
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage >= totalPages}
                className="px-2 py-1 rounded border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50">
                ຖັດໄປ
              </button>
              <button type="button" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}
                className="px-2 py-1 rounded border border-slate-200 text-xs font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50">
                ສຸດທ້າຍ
              </button>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"></div>
          <div className="relative w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">{editing ? 'ແກ້ໄຂສະມາຊິກ' : 'ສ້າງສະມາຊິກ'}</h3>
                <p className="text-[11px] text-slate-400">{editing ? editing.member_code || `#${editing.id}` : 'ປ້ອນຂໍ້ມູນສະມາຊິກໃໝ່'}</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-500">✕</button>
            </div>

            <form onSubmit={save} className="max-h-[calc(92vh-62px)] overflow-y-auto p-5 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500">ລະຫັດ</span>
                  <input value={form.member_code} onChange={e => setForm({ ...form, member_code: e.target.value })}
                    placeholder="Auto"
                    className="mt-1 w-full px-2 py-2 border border-slate-200 rounded text-sm outline-none focus:border-red-500" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500">Tier</span>
                  <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })}
                    className="mt-1 w-full px-2 py-2 border border-slate-200 rounded text-sm outline-none focus:border-red-500">
                    {Object.keys(tierLabel).map(t => <option key={t} value={t}>{tierLabel[t]}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500">ຊື່ *</span>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full px-2 py-2 border border-slate-200 rounded text-sm outline-none focus:border-red-500" required autoFocus />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500">ເບີໂທ</span>
                  <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 w-full px-2 py-2 border border-slate-200 rounded text-sm outline-none focus:border-red-500" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500">Email</span>
                  <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    className="mt-1 w-full px-2 py-2 border border-slate-200 rounded text-sm outline-none focus:border-red-500" />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-500">ແຂວງ *</span>
                  <div className="mt-1">
                    <SearchSelect value={form.province} onChange={setProvince}
                      options={provinces.map(p => ({ value: p, label: p }))}
                      placeholder="-- ເລືອກແຂວງ --" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500">ເມືອງ *</span>
                    <div className="mt-1">
                      <SearchSelect value={form.district} onChange={setDistrict}
                        options={districts.map(d => ({ value: d, label: d }))}
                        placeholder={form.province ? '-- ເລືອກເມືອງ --' : 'ເລືອກແຂວງກ່ອນ'} />
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500">ບ້ານ *</span>
                    <div className="mt-1">
                      <SearchSelect value={form.village} onChange={village => setForm({ ...form, village })}
                        options={villages.map(v => ({ value: v, label: v }))}
                        placeholder={form.district ? '-- ເລືອກບ້ານ --' : 'ເລືອກເມືອງກ່ອນ'} />
                    </div>
                  </div>
                </div>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500">ທີ່ຢູ່ເພີ່ມເຕີມ</span>
                  <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                    className="mt-1 w-full px-2 py-2 border border-slate-200 rounded text-sm outline-none focus:border-red-500" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500">ຄະແນນ</span>
                  <input type="number" value={form.points} onChange={e => setForm({ ...form, points: e.target.value })}
                    className="mt-1 w-full px-2 py-2 border border-slate-200 rounded text-sm outline-none focus:border-red-500" />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500">ຍອດຊື້</span>
                  <input type="number" value={form.total_spent} onChange={e => setForm({ ...form, total_spent: e.target.value })}
                    className="mt-1 w-full px-2 py-2 border border-slate-200 rounded text-sm outline-none focus:border-red-500" />
                </label>
              </div>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500">ໝາຍເຫດ</span>
                <textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}
                  className="mt-1 w-full px-2 py-2 border border-slate-200 rounded text-sm outline-none focus:border-red-500" rows={2} />
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
                ເປີດໃຊ້ງານ
              </label>
              <div className="sticky bottom-0 -mx-5 -mb-5 flex gap-2 border-t border-slate-200 bg-white px-5 py-3">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold">
                  ຍົກເລີກ
                </button>
                <button className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold">
                  ບັນທຶກ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
