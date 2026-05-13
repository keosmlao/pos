'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminMenuSections, createFullPermissions, normalizePermissions } from '@/utils/adminPermissions';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';

const ROLE_META = {
  admin: {
    label: 'Admin',
    desc: 'ເຂົ້າເຖິງທຸກເມນູ + POS',
    icon: '👑',
    badge: 'bg-red-50 text-red-700 border-red-200',
    bg: 'bg-gradient-to-br from-red-500 to-red-700',
  },
  cashier: {
    label: 'ພະນັກງານຂາຍ',
    desc: 'ໃຊ້ງານ POS ແລະ ເມນູທີ່ໄດ້ຮັບສິດ',
    icon: '🧑‍💼',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700',
  },
};

const PERM_KEYS = [
  { key: 'access', label: 'ເຂົ້າ', icon: '👁' },
  { key: 'edit', label: 'ແກ້', icon: '✏️' },
  { key: 'delete', label: 'ລົບ', icon: '🗑' },
];

const emptyForm = {
  username: '',
  display_name: '',
  password: '',
  role: 'cashier',
  permissions: normalizePermissions({}),
};

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function permissionStats(permissions) {
  const perms = normalizePermissions(permissions);
  let access = 0, edit = 0, del = 0;
  for (const p of Object.values(perms)) {
    if (p.access) access += 1;
    if (p.edit) edit += 1;
    if (p.delete) del += 1;
  }
  return { access, edit, delete: del, total: Object.keys(perms).length };
}

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/users`);
      setUsers(await res.json());
    } catch (e) {
      showToast(e.message || 'ໂຫຼດຂໍ້ມູນບໍ່ໄດ້', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return `${u.username || ''} ${u.display_name || ''} ${u.role || ''}`.toLowerCase().includes(q);
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    cashier: users.filter(u => u.role === 'cashier').length,
  }), [users]);

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const updateRole = (role) => setForm(prev => ({
    ...prev,
    role,
    permissions: role === 'admin' ? createFullPermissions() : normalizePermissions(prev.permissions),
  }));

  const togglePermission = (path, key) => setForm(prev => {
    if (prev.role === 'admin') return prev;
    const current = normalizePermissions(prev.permissions);
    const nextValue = !current[path]?.[key];
    const next = {
      ...current,
      [path]: { ...current[path], [key]: nextValue },
    };
    if (key === 'access' && !nextValue) next[path] = { access: false, edit: false, delete: false };
    if ((key === 'edit' || key === 'delete') && nextValue) next[path].access = true;
    return { ...prev, permissions: next };
  });

  const setSectionPermission = (section, enabled) => setForm(prev => {
    if (prev.role === 'admin') return prev;
    const current = normalizePermissions(prev.permissions);
    for (const item of section.items) {
      current[item.path] = enabled
        ? { access: true, edit: true, delete: true }
        : { access: false, edit: false, delete: false };
    }
    return { ...prev, permissions: current };
  });

  const setAllPermissions = (enabled) => setForm(prev => {
    if (prev.role === 'admin') return prev;
    return { ...prev, permissions: enabled ? createFullPermissions() : normalizePermissions({}) };
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (u) => {
    setEditingId(u.id);
    setForm({
      username: u.username,
      display_name: u.display_name,
      password: '',
      role: u.role || 'cashier',
      permissions: u.role === 'admin' ? createFullPermissions() : normalizePermissions(u.permissions),
    });
    setShowForm(true);
  };

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        permissions: form.role === 'admin' ? createFullPermissions() : normalizePermissions(form.permissions),
      };
      if (editingId && !payload.password) delete payload.password;
      const res = await fetch(editingId ? `${API}/admin/users/${editingId}` : `${API}/admin/users`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'ບັນທຶກບໍ່ສຳເລັດ', 'error');
        return;
      }
      showToast(editingId ? 'ບັນທຶກສຳເລັດ' : 'ສ້າງ user ສຳເລັດ');
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u) => {
    if (!confirm(`ລົບ user "${u.username}"?\nການກະທຳນີ້ບໍ່ສາມາດກັບຄືນໄດ້`)) return;
    const res = await fetch(`${API}/admin/users/${u.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'ລົບບໍ່ສຳເລັດ', 'error');
      return;
    }
    showToast('ລົບ user ສຳເລັດ');
    await load();
  };

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Users & permissions"
        title="👤 User ແລະ ສິດໃຊ້ງານ"
        subtitle="ຈັດການ user, role ແລະ ສິດເຂົ້າເຖິງເມນູຫຼັງບ້ານ"
        action={
          <div className="flex gap-2">
            <button onClick={load}
              className="rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 px-4 py-3 text-sm font-extrabold text-white">
              ໂຫຼດໃໝ່
            </button>
            <button onClick={openCreate}
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/20">
              + User ໃໝ່
            </button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">👥 ທັງໝົດ</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">User ໃນລະບົບ</div>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50/50 p-3">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-red-700">👑 Admin</div>
          <div className="mt-1 text-2xl font-extrabold text-red-800">{stats.admin}</div>
          <div className="text-[11px] text-red-600 mt-0.5">ເຂົ້າເຖິງທຸກເມນູ</div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
          <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700">🧑‍💼 ພະນັກງານຂາຍ</div>
          <div className="mt-1 text-2xl font-extrabold text-emerald-800">{stats.cashier}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">POS + ສິດເສລີມ</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="ຄົ້ນຫາ username, ຊື່ສະແດງ..."
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-red-400" />
        </div>
        <div className="flex bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
          {[
            { key: 'all', label: 'ທັງໝົດ' },
            { key: 'admin', label: '👑 Admin' },
            { key: 'cashier', label: '🧑‍💼 ພະນັກງານຂາຍ' },
          ].map(r => (
            <button key={r.key} onClick={() => setRoleFilter(r.key)}
              className={`px-3 py-2 text-xs font-bold transition ${roleFilter === r.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-400 font-mono">{filtered.length}/{users.length}</span>
      </div>

      {/* User cards grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">ກຳລັງໂຫຼດ...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          {users.length === 0 ? 'ຍັງບໍ່ມີ user — ກົດ "+ User ໃໝ່" ເພື່ອເລີ່ມຕົ້ນ' : 'ບໍ່ພົບ user ທີ່ກົງກັບການຄົ້ນຫາ'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map(u => {
            const meta = ROLE_META[u.role] || ROLE_META.cashier;
            const perms = permissionStats(u.permissions);
            const isAdmin = u.role === 'admin';
            return (
              <div key={u.id} className="rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300 hover:shadow-sm transition">
                <div className="flex items-start gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white text-base font-black shadow ${meta.bg}`}>
                    {initialsOf(u.display_name || u.username)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-slate-900 truncate">{u.display_name || u.username}</div>
                    <div className="text-[11px] font-mono text-slate-500 truncate">@{u.username}</div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${meta.badge}`}>
                        <span>{meta.icon}</span>{meta.label}
                      </span>
                      {isAdmin ? (
                        <span className="rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-700">
                          Full access
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {perms.access}/{perms.total} ເມນູ
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!isAdmin && (
                  <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-[10px]">
                    <div className="rounded bg-blue-50 border border-blue-100 px-2 py-1 text-center">
                      <div className="font-extrabold text-red-700">{perms.access}</div>
                      <div className="text-red-600">👁 ເຂົ້າ</div>
                    </div>
                    <div className="rounded bg-amber-50 border border-amber-100 px-2 py-1 text-center">
                      <div className="font-extrabold text-amber-700">{perms.edit}</div>
                      <div className="text-amber-600">✏️ ແກ້</div>
                    </div>
                    <div className="rounded bg-rose-50 border border-rose-100 px-2 py-1 text-center">
                      <div className="font-extrabold text-rose-700">{perms.delete}</div>
                      <div className="text-rose-600">🗑 ລົບ</div>
                    </div>
                  </div>
                )}

                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('lo-LA') : ''}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(u)}
                      className="rounded-md px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100">
                      ✏️ ແກ້ໄຂ
                    </button>
                    <button onClick={() => remove(u)}
                      className="rounded-md px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50">
                      🗑 ລົບ
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => !saving && setShowForm(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingId ? '✏️ ແກ້ໄຂ User' : '➕ ສ້າງ User ໃໝ່'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {editingId ? `ກຳລັງແກ້ໄຂ user #${editingId}` : 'ໃສ່ຂໍ້ມູນເພື່ອສ້າງ user ໃໝ່'}
                </p>
              </div>
              <button onClick={() => !saving && setShowForm(false)}
                className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-500">✕</button>
            </div>

            <form onSubmit={save} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Basic info */}
              <section className="space-y-3">
                <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">ຂໍ້ມູນພື້ນຖານ</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Username *</label>
                    <input value={form.username} onChange={e => updateForm('username', e.target.value)} required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">ຊື່ສະແດງ *</label>
                    <input value={form.display_name} onChange={e => updateForm('display_name', e.target.value)} required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    ລະຫັດຜ່ານ {editingId && <span className="font-normal text-slate-400">(ວ່າງໄວ້ຖ້າບໍ່ປ່ຽນ)</span>}
                  </label>
                  <input type="password" value={form.password} onChange={e => updateForm('password', e.target.value)} required={!editingId}
                    placeholder={editingId ? '••••••••' : 'ຢ່າງໜ້ອຍ 4 ຕົວອັກສອນ'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10" />
                </div>
              </section>

              {/* Role */}
              <section className="space-y-2">
                <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">ບົດບາດ (Role)</div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ROLE_META).map(([key, meta]) => {
                    const active = form.role === key;
                    return (
                      <button type="button" key={key} onClick={() => updateRole(key)}
                        className={`text-left rounded-xl border-2 p-3 transition ${
                          active
                            ? `${meta.badge} shadow-inner`
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl leading-none">{meta.icon}</span>
                          <div className="min-w-0">
                            <div className="font-extrabold">{meta.label}</div>
                            <div className="text-[10px] opacity-70 mt-0.5 leading-tight">{meta.desc}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Permissions */}
              <section className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">ສິດເຂົ້າເຖິງເມນູ</div>
                    <p className="text-[10px] text-slate-400 mt-0.5">ເຂົ້າ / ແກ້ / ລົບ ແຍກຕາມເມນູ</p>
                  </div>
                  {form.role === 'admin' ? (
                    <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-extrabold text-red-700">👑 Full access ອັດຕະໂນມັດ</span>
                  ) : (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setAllPermissions(true)}
                        className="rounded-md bg-emerald-50 hover:bg-emerald-100 px-2 py-1 text-[10px] font-extrabold text-emerald-700">
                        ✓ ທັງໝົດ
                      </button>
                      <button type="button" onClick={() => setAllPermissions(false)}
                        className="rounded-md bg-slate-100 hover:bg-slate-200 px-2 py-1 text-[10px] font-extrabold text-slate-600">
                        ✕ ປິດທັງໝົດ
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {adminMenuSections.map(section => {
                    const perms = form.role === 'admin' ? createFullPermissions() : normalizePermissions(form.permissions);
                    const sectionAccess = section.items.filter(it => perms[it.path]?.access).length;
                    const total = section.items.length;
                    const fullyOn = sectionAccess === total;
                    return (
                      <div key={section.title} className="rounded-lg border border-slate-200 bg-white">
                        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base">{section.icon}</span>
                            <div className="min-w-0">
                              <div className="text-[12px] font-extrabold text-slate-800 truncate">{section.title}</div>
                              <div className="text-[10px] text-slate-500">{sectionAccess}/{total} ເມນູ</div>
                            </div>
                          </div>
                          <button type="button" disabled={form.role === 'admin'} onClick={() => setSectionPermission(section, !fullyOn)}
                            className={`rounded px-2 py-1 text-[10px] font-bold disabled:opacity-40 ${
                              fullyOn
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}>
                            {fullyOn ? 'ປິດທັງໝົດ' : 'ເປີດທັງໝົດ'}
                          </button>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {section.items.map(item => {
                            const p = perms[item.path];
                            return (
                              <div key={item.path} className="px-3 py-2 flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="text-[12px] font-bold text-slate-700 truncate">
                                    <span className="mr-1.5">{item.icon}</span>{item.label}
                                  </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  {PERM_KEYS.map(({ key, label, icon }) => {
                                    const checked = !!p?.[key];
                                    const colors = {
                                      access: checked ? 'bg-blue-100 text-red-700 border-red-300' : 'bg-slate-50 text-slate-400 border-slate-200',
                                      edit: checked ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-slate-50 text-slate-400 border-slate-200',
                                      delete: checked ? 'bg-rose-100 text-rose-700 border-rose-300' : 'bg-slate-50 text-slate-400 border-slate-200',
                                    };
                                    return (
                                      <button key={key} type="button"
                                        disabled={form.role === 'admin'}
                                        onClick={() => togglePermission(item.path, key)}
                                        title={label}
                                        className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-extrabold transition ${colors[key]} disabled:opacity-50`}>
                                        <span>{icon}</span>
                                        <span className="hidden sm:inline">{label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </form>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button onClick={() => !saving && setShowForm(false)} disabled={saving}
                className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-100">
                ຍົກເລີກ
              </button>
              <button onClick={save} disabled={saving}
                className="flex-[2] py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-extrabold">
                {saving ? 'ກຳລັງບັນທຶກ...' : editingId ? '💾 ບັນທຶກການແກ້ໄຂ' : '➕ ສ້າງ User'}
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
