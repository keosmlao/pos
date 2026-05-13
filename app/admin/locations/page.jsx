'use client';

import { useEffect, useMemo, useState } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';

const cloneLocations = (locations) => JSON.parse(JSON.stringify(locations || {}));
const firstKey = (obj) => Object.keys(obj || {})[0] || '';

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={`fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-lg ${
      toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
    }`}>
      {toast.msg}
    </div>
  );
}

export default function LocationsPage() {
  const [locations, setLocations] = useState({});
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [provinceName, setProvinceName] = useState('');
  const [districtName, setDistrictName] = useState('');
  const [villageName, setVillageName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const provinces = useMemo(() => Object.keys(locations), [locations]);
  const districts = useMemo(
    () => selectedProvince ? Object.keys(locations[selectedProvince] || {}) : [],
    [locations, selectedProvince]
  );
  const villages = useMemo(
    () => selectedProvince && selectedDistrict ? (locations[selectedProvince]?.[selectedDistrict] || []) : [],
    [locations, selectedProvince, selectedDistrict]
  );

  useEffect(() => {
    fetch(`${API}/admin/locations`)
      .then(r => r.json())
      .then(data => {
        const next = data.locations || {};
        const province = firstKey(next);
        const district = firstKey(next[province]);
        setLocations(next);
        setSelectedProvince(province);
        setSelectedDistrict(district);
      })
      .catch(() => showToast('ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const updateLocations = (next, nextProvince = selectedProvince, nextDistrict = selectedDistrict) => {
    setLocations(next);
    setSelectedProvince(nextProvince || firstKey(next));
    const province = nextProvince || firstKey(next);
    setSelectedDistrict(nextDistrict || firstKey(next[province]));
  };

  const addProvince = () => {
    const name = provinceName.trim();
    if (!name) return;
    if (locations[name]) return showToast('ແຂວງນີ້ມີແລ້ວ', 'error');
    const next = cloneLocations(locations);
    next[name] = {};
    updateLocations(next, name, '');
    setProvinceName('');
  };

  const renameProvince = () => {
    const name = provinceName.trim();
    if (!selectedProvince || !name) return;
    if (name !== selectedProvince && locations[name]) return showToast('ແຂວງນີ້ມີແລ້ວ', 'error');
    const next = cloneLocations(locations);
    next[name] = next[selectedProvince] || {};
    if (name !== selectedProvince) delete next[selectedProvince];
    updateLocations(next, name, selectedDistrict);
    setProvinceName('');
  };

  const deleteProvince = () => {
    if (!selectedProvince || !confirm(`ລຶບ ${selectedProvince}?`)) return;
    const next = cloneLocations(locations);
    delete next[selectedProvince];
    const province = firstKey(next);
    updateLocations(next, province, firstKey(next[province]));
  };

  const addDistrict = () => {
    const name = districtName.trim();
    if (!selectedProvince || !name) return;
    if (locations[selectedProvince]?.[name]) return showToast('ເມືອງນີ້ມີແລ້ວ', 'error');
    const next = cloneLocations(locations);
    next[selectedProvince] = next[selectedProvince] || {};
    next[selectedProvince][name] = [];
    updateLocations(next, selectedProvince, name);
    setDistrictName('');
  };

  const renameDistrict = () => {
    const name = districtName.trim();
    if (!selectedProvince || !selectedDistrict || !name) return;
    if (name !== selectedDistrict && locations[selectedProvince]?.[name]) return showToast('ເມືອງນີ້ມີແລ້ວ', 'error');
    const next = cloneLocations(locations);
    next[selectedProvince][name] = next[selectedProvince][selectedDistrict] || [];
    if (name !== selectedDistrict) delete next[selectedProvince][selectedDistrict];
    updateLocations(next, selectedProvince, name);
    setDistrictName('');
  };

  const deleteDistrict = () => {
    if (!selectedProvince || !selectedDistrict || !confirm(`ລຶບ ${selectedDistrict}?`)) return;
    const next = cloneLocations(locations);
    delete next[selectedProvince][selectedDistrict];
    updateLocations(next, selectedProvince, firstKey(next[selectedProvince]));
  };

  const addVillage = () => {
    const name = villageName.trim();
    if (!selectedProvince || !selectedDistrict || !name) return;
    if (villages.includes(name)) return showToast('ບ້ານນີ້ມີແລ້ວ', 'error');
    const next = cloneLocations(locations);
    next[selectedProvince][selectedDistrict] = [...(next[selectedProvince][selectedDistrict] || []), name];
    updateLocations(next, selectedProvince, selectedDistrict);
    setVillageName('');
  };

  const renameVillage = (oldName) => {
    const name = prompt('ຊື່ບ້ານໃໝ່', oldName)?.trim();
    if (!name || name === oldName) return;
    if (villages.includes(name)) return showToast('ບ້ານນີ້ມີແລ້ວ', 'error');
    const next = cloneLocations(locations);
    next[selectedProvince][selectedDistrict] = villages.map(v => v === oldName ? name : v);
    updateLocations(next, selectedProvince, selectedDistrict);
  };

  const deleteVillage = (name) => {
    if (!confirm(`ລຶບ ${name}?`)) return;
    const next = cloneLocations(locations);
    next[selectedProvince][selectedDistrict] = villages.filter(v => v !== name);
    updateLocations(next, selectedProvince, selectedDistrict);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/locations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return showToast(data.error || 'ບັນທຶກບໍ່ສຳເລັດ', 'error');
      setLocations(data.locations || locations);
      showToast('ບັນທຶກສຳເລັດ');
    } catch {
      showToast('ບັນທຶກບໍ່ສຳເລັດ', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-500">ກຳລັງໂຫຼດ...</div>;

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Lao addresses"
        title="📍 ກຳນົດ ແຂວງ / ເມືອງ / ບ້ານ"
        subtitle="ໃຊ້ກັບຟອມສະມາຊິກ, POS ແລະ ຜູ້ສະໜອງ"
        action={
          <button onClick={save} disabled={saving}
            className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-3 text-sm font-extrabold shadow-lg shadow-red-950/20 disabled:opacity-50">
            {saving ? 'ກຳລັງບັນທຶກ...' : '💾 ບັນທຶກ'}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-extrabold text-slate-900">ແຂວງ</h2>
            <span className="text-xs text-slate-400">{provinces.length}</span>
          </div>
          <div className="mb-3 flex gap-2">
            <input value={provinceName} onChange={e => setProvinceName(e.target.value)}
              placeholder="ຊື່ແຂວງ"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button onClick={addProvince} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">ເພີ່ມ</button>
          </div>
          <div className="mb-3 flex gap-2">
            <button onClick={renameProvince} disabled={!selectedProvince}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">ປ່ຽນຊື່</button>
            <button onClick={deleteProvince} disabled={!selectedProvince}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-40">ລຶບ</button>
          </div>
          <div className="max-h-[55vh] space-y-1 overflow-y-auto">
            {provinces.map(p => (
              <button key={p} onClick={() => { setSelectedProvince(p); setSelectedDistrict(firstKey(locations[p])); }}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm font-bold ${selectedProvince === p ? 'bg-red-50 text-red-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                {p}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-extrabold text-slate-900">ເມືອງ</h2>
            <span className="text-xs text-slate-400">{districts.length}</span>
          </div>
          <div className="mb-3 flex gap-2">
            <input value={districtName} onChange={e => setDistrictName(e.target.value)}
              placeholder="ຊື່ເມືອງ"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button onClick={addDistrict} disabled={!selectedProvince}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">ເພີ່ມ</button>
          </div>
          <div className="mb-3 flex gap-2">
            <button onClick={renameDistrict} disabled={!selectedDistrict}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">ປ່ຽນຊື່</button>
            <button onClick={deleteDistrict} disabled={!selectedDistrict}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-40">ລຶບ</button>
          </div>
          <div className="max-h-[55vh] space-y-1 overflow-y-auto">
            {districts.map(d => (
              <button key={d} onClick={() => setSelectedDistrict(d)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm font-bold ${selectedDistrict === d ? 'bg-red-50 text-red-700' : 'hover:bg-slate-50 text-slate-700'}`}>
                {d}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-extrabold text-slate-900">ບ້ານ</h2>
            <span className="text-xs text-slate-400">{villages.length}</span>
          </div>
          <div className="mb-3 flex gap-2">
            <input value={villageName} onChange={e => setVillageName(e.target.value)}
              placeholder="ຊື່ບ້ານ"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button onClick={addVillage} disabled={!selectedDistrict}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">ເພີ່ມ</button>
          </div>
          <div className="max-h-[62vh] space-y-1 overflow-y-auto">
            {villages.map(v => (
              <div key={v} className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-50">
                <button onClick={() => renameVillage(v)} className="min-w-0 flex-1 truncate text-left text-sm font-bold text-slate-700">{v}</button>
                <button onClick={() => deleteVillage(v)} className="rounded-md px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">ລຶບ</button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <Toast toast={toast} />
    </div>
  );
}

