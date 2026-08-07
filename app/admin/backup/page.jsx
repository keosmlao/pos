'use client';

import { useState, useEffect } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';
import { formatDateTime } from '@/utils/formatDate';

const TABLES = [
  { key: 'products', label: 'ສິນຄ້າ', icon: '📦' },
  { key: 'categories', label: 'ໝວດໝູ່', icon: '🏷' },
  { key: 'brands', label: 'ຍີ່ຫໍ້', icon: '🏢' },
  { key: 'units', label: 'ຫົວໜ່ວຍ', icon: '📏' },
  { key: 'suppliers', label: 'ຜູ້ສະໜອງ', icon: '🚚' },
  { key: 'members', label: 'ສະມາຊິກ', icon: '⭐' },
  { key: 'orders', label: 'ບີນຂາຍ', icon: '🧾' },
  { key: 'order_items', label: 'ລາຍການຂາຍ', icon: '📋' },
  { key: 'returns', label: 'ການຮັບຄືນ', icon: '↩' },
  { key: 'return_items', label: 'ລາຍການຮັບຄືນ', icon: '↩' },
  { key: 'purchases', label: 'ການຊື້', icon: '🛒' },
  { key: 'purchase_items', label: 'ລາຍການຊື້', icon: '📋' },
  { key: 'customer_debt_payments', label: 'ການຊຳລະໜີ້ລູກຄ້າ', icon: '💵' },
  { key: 'quotations', label: 'ໃບສະເໜີລາຄາ', icon: '📜' },
  { key: 'quotation_items', label: 'ລາຍການເສນີລາຄາ', icon: '📋' },
  { key: 'cash_transactions', label: 'ການເຄື່ອນຍ້າຍເງິນສົດ', icon: '💰' },
  { key: 'cash_handovers', label: 'ການມອບເງິນ', icon: '🤝' },
  { key: 'promotions', label: 'ໂປຣໂມຊັນ', icon: '🎁' },
  { key: 'currencies', label: 'ສະກຸນເງິນ', icon: '💱' },
  { key: 'company_profile', label: 'ຂໍ້ມູນບໍລິສັດ', icon: '🏢' },
];

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function AutoBackupSection() {
  const [settings, setSettings] = useState(null);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState('');

  const load = (data) => {
    setSettings(data.settings);
    setFiles(data.files || []);
  };

  useEffect(() => {
    fetch('/api/admin/backup/schedule').then(r => r.json()).then(load).catch(() => {});
  }, []);

  const save = async (patch) => {
    setSaving(true);
    setMsg('');
    const next = { ...settings, ...patch };
    const res = await fetch('/api/admin/backup/schedule', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    if (res.ok) { load(await res.json()); setMsg('ບັນທຶກແລ້ວ ✓'); }
    setSaving(false);
  };

  const runNow = async () => {
    setRunning(true);
    setMsg('');
    const res = await fetch('/api/admin/backup/schedule', { method: 'POST' });
    const data = await res.json();
    if (res.ok) { load(data); setMsg(data.ok ? `ສຳຮອງແລ້ວ: ${data.file}` : `ຜິດພາດ: ${data.error}`); }
    setRunning(false);
  };

  if (!settings) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900 flex items-center justify-between flex-wrap gap-2">
        <span>⏰ ສຳຮອງອັດຕະໂນມັດ (ຕັ້ງເວລາໃນລະບົບ)</span>
        <button onClick={runNow} disabled={running}
          className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-700 rounded-lg text-xs font-bold disabled:opacity-50">
          {running ? 'ກຳລັງສຳຮອງ...' : '▶ ສຳຮອງດຽວນີ້'}
        </button>
      </div>
      <div className="px-4 py-3 flex items-center gap-4 flex-wrap text-sm">
        <label className="flex items-center gap-2 font-bold">
          <input type="checkbox" checked={!!settings.enabled}
            onChange={e => save({ enabled: e.target.checked })} disabled={saving} />
          ເປີດໃຊ້
        </label>
        <label className="flex items-center gap-2">
          ເວລາ
          <input type="time" value={settings.backup_time} disabled={saving}
            onChange={e => save({ backup_time: e.target.value })}
            className="border border-slate-300 rounded-lg px-2 py-1" />
          ທຸກມື້
        </label>
        <label className="flex items-center gap-2">
          ເກັບໄວ້
          <input type="number" min="3" max="365" value={settings.keep_count} disabled={saving}
            onChange={e => save({ keep_count: e.target.value })}
            className="border border-slate-300 rounded-lg px-2 py-1 w-20" />
          ຊຸດຫຼ້າສຸດ
        </label>
        {msg && <span className="text-xs text-emerald-600 font-bold">{msg}</span>}
      </div>
      {settings.last_status && (
        <div className="px-4 pb-2 text-xs text-slate-500">
          ຄັ້ງຫຼ້າສຸດ: {settings.last_run_at ? formatDateTime(settings.last_run_at) : '-'} — {settings.last_status}
        </div>
      )}
      {files.length > 0 && (
        <div className="divide-y divide-slate-100 border-t border-slate-100 max-h-56 overflow-y-auto">
          {files.map(f => (
            <div key={f.name} className="px-4 py-2 flex items-center gap-3 text-sm hover:bg-slate-50">
              <span className="flex-1 font-mono text-xs text-slate-700 truncate">{f.name}</span>
              <span className="text-[11px] text-slate-400">{fmtSize(f.size)}</span>
              <a href={`/api/admin/backup/schedule/download?file=${encodeURIComponent(f.name)}`}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold">⬇</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BackupPage() {
  const downloadFull = () => {
    window.location.href = '/api/admin/backup';
  };

  const downloadTable = (table) => {
    window.location.href = `/api/admin/backup?table=${encodeURIComponent(table)}`;
  };

  return (
    <div className="space-y-4 pb-6 max-w-5xl">
      <AdminHero
        tag="Backup / export"
        title="💾 ສຳຮອງ / ສົ່ງອອກຂໍ້ມູນ"
        subtitle="ດາວໂຫຼດຂໍ້ມູນລະບົບເພື່ອເກັບຮັກສາ ຫຼື ນຳໄປວິເຄາະຕໍ່"
      />

      {/* Full backup */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-xl p-6 shadow-lg">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="text-4xl">💾</div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-extrabold">ສຳຮອງທັງໝົດ (JSON)</div>
            <div className="text-sm text-slate-300 mt-1">
              ດາວໂຫຼດທຸກຕາຕະລາງເປັນໄຟລ໌ JSON ດຽວ ສຳລັບການສຳຮອງຄົບຖ້ວນ.
              ໝາຍເຫດ: ໄຟລ໌ນີ້ບໍ່ມີ password ຂອງຜູ້ໃຊ້.
            </div>
          </div>
          <button
            onClick={downloadFull}
            className="px-5 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg font-extrabold text-sm shadow"
          >
            ⬇ ດາວໂຫຼດ JSON
          </button>
        </div>
      </div>

      {/* Auto backup schedule */}
      <AutoBackupSection />

      {/* Per-table export */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">
          ສົ່ງອອກລາຍຕາຕະລາງ (CSV)
        </div>
        <div className="divide-y divide-slate-100">
          {TABLES.map(t => (
            <div key={t.key} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50">
              <span className="text-lg">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-slate-900">{t.label}</div>
                <div className="text-[10px] font-mono text-slate-400">{t.key}</div>
              </div>
              <button
                onClick={() => downloadTable(t.key)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition"
              >
                CSV
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <b>⚠ ຄຳແນະນຳ:</b> ສຳຮອງຂໍ້ມູນຢ່າງໜ້ອຍ 1 ຄັ້ງຕໍ່ອາທິດ ແລະ ເກັບໄວ້ໃນບ່ອນປອດໄພ (ເຊັ່ນ Google Drive). ບໍ່ມີ password ໃນໄຟລ໌ສຳຮອງ.
      </div>
    </div>
  );
}
