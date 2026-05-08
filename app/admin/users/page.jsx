'use client';

import { useEffect, useMemo, useState } from 'react';

const API = '/api';
const emptyForm = { username: '', display_name: '', password: '', role: 'cashier' };

const roleMeta = {
  admin: { label: 'Admin', desc: 'ເຂົ້າຫຼັງບ້ານ ແລະ POS', cls: 'bg-red-50 text-red-700 border-red-100' },
  cashier: { label: 'ພະນັກງານຂາຍ', desc: 'ໃຊ້ງານ POS', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/users`);
      setUsers(await res.json());
    } catch (e) {
      alert(e.message || 'ໂຫຼດຂໍ້ມູນບໍ່ໄດ້');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
      `${u.username || ''} ${u.display_name || ''} ${u.role || ''}`.toLowerCase().includes(q)
    );
  }, [users, search]);

  const stats = useMemo(() => ({
    total: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    cashier: users.filter(u => u.role === 'cashier').length,
  }), [users]);

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setForm({ username: u.username, display_name: u.display_name, password: '', role: u.role || 'cashier' });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (editingId && !payload.password) delete payload.password;
      const res = await fetch(editingId ? `${API}/admin/users/${editingId}` : `${API}/admin/users`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'ບັນທຶກບໍ່ສຳເລັດ');
        return;
      }
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u) => {
    if (!confirm(`ລົບ user "${u.username}"?`)) return;
    const res = await fetch(`${API}/admin/users/${u.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'ລົບບໍ່ສຳເລັດ');
      return;
    }
    await load();
  };

  return (
    <div className="text-[13px]">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">ກຳນົດ User ແລະ ສິດໃຊ້ງານ</h2>
          <span className="text-xs text-slate-500">{stats.total} users</span>
          <span className="text-[11px] font-bold px-2 py-0.5 bg-red-50 text-red-600 rounded">Admin {stats.admin}</span>
          <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded">Cashier {stats.cashier}</span>
        </div>
        <button onClick={load} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold">
          ໂຫຼດໃໝ່
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-4">
        <form onSubmit={save} className="bg-white border border-slate-200 rounded-lg p-4 h-fit">
          <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-3">
            {editingId ? 'ແກ້ໄຂ User' : 'ເພີ່ມ User'}
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Username</label>
              <input value={form.username} onChange={e => updateForm('username', e.target.value)} required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">ຊື່ສະແດງ</label>
              <input value={form.display_name} onChange={e => updateForm('display_name', e.target.value)} required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                ລະຫັດຜ່ານ {editingId && <span className="font-normal text-slate-400">(ວ່າງໄວ້ຖ້າບໍ່ປ່ຽນ)</span>}
              </label>
              <input type="password" value={form.password} onChange={e => updateForm('password', e.target.value)} required={!editingId}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">ສິດໃຊ້ງານ</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(roleMeta).map(([key, meta]) => (
                  <button type="button" key={key} onClick={() => updateForm('role', key)}
                    className={`text-left rounded-lg border p-3 transition ${form.role === key ? meta.cls : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                    <div className="font-extrabold">{meta.label}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{meta.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving}
              className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-xs font-extrabold">
              {saving ? 'ກຳລັງບັນທຶກ...' : editingId ? 'ບັນທຶກການແກ້ໄຂ' : 'ເພີ່ມ User'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold">
                ຍົກເລີກ
              </button>
            )}
          </div>
        </form>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-3 border-b border-slate-200 flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ຄົ້ນຫາ username, ຊື່, ສິດ..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs outline-none focus:border-red-500" />
            </div>
            <span className="text-[11px] text-slate-400 font-mono">{filtered.length}/{users.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50">
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  <th className="text-left py-2 px-3 w-16">ID</th>
                  <th className="text-left py-2 px-3">Username</th>
                  <th className="text-left py-2 px-3">ຊື່ສະແດງ</th>
                  <th className="text-left py-2 px-3 w-36">ສິດ</th>
                  <th className="text-left py-2 px-3 w-32">ສ້າງເມື່ອ</th>
                  <th className="text-right py-2 px-3 w-28"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="6" className="text-center text-slate-400 py-12">ກຳລັງໂຫຼດ...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="6" className="text-center text-slate-300 py-12">ບໍ່ມີ user</td></tr>
                ) : filtered.map(u => {
                  const meta = roleMeta[u.role] || roleMeta.cashier;
                  return (
                    <tr key={u.id} className="hover:bg-red-50/20">
                      <td className="py-2 px-3 font-mono text-slate-400">#{u.id}</td>
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">{u.username}</td>
                      <td className="py-2 px-3 font-semibold text-slate-700">{u.display_name}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${meta.cls}`}>{meta.label}</span>
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('lo-LA') : '-'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button onClick={() => startEdit(u)} className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[11px] font-bold mr-1">
                          ແກ້ໄຂ
                        </button>
                        <button onClick={() => remove(u)} className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[11px] font-bold">
                          ລົບ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
