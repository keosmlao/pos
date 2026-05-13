'use client';

import { useState, useEffect, useMemo } from 'react';
import { AdminHero } from '@/components/admin/ui/AdminHero';

const API = '/api';
const fmtDateTime = s => s ? new Date(s).toLocaleString('lo-LA') : '—';

const ENTITY_LABEL = {
  http: { icon: '🌐', label: 'HTTP' },
  order: { icon: '🧾', label: 'ບີນຂາຍ' },
  quotation: { icon: '📜', label: 'ໃບສະເໜີລາຄາ' },
  product: { icon: '📦', label: 'ສິນຄ້າ' },
  user: { icon: '👤', label: 'ຜູ້ໃຊ້' },
  member: { icon: '⭐', label: 'ສະມາຊິກ' },
  supplier: { icon: '🚚', label: 'ຜູ້ສະໜອງ' },
  purchase: { icon: '🛒', label: 'ການຊື້' },
  return: { icon: '↩', label: 'ຮັບຄືນ' },
  cash_transaction: { icon: '💰', label: 'ການເຄື່ອນຍ້າຍເງິນ' },
  debt_payment: { icon: '💳', label: 'ການຊຳລະໜີ້' },
  company_profile: { icon: '🏢', label: 'ບໍລິສັດ' },
};

const QUICK_RANGES = [
  { key: 'today', label: 'ມື້ນີ້' },
  { key: '7d', label: '7 ວັນ' },
  { key: 'month', label: 'ເດືອນນີ້' },
];

function getRange(key) {
  const today = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  if (key === 'today') return { from: iso(today), to: iso(today) };
  if (key === '7d') { const from = new Date(today); from.setDate(today.getDate() - 6); return { from: iso(from), to: iso(today) }; }
  if (key === 'month') { const from = new Date(today.getFullYear(), today.getMonth(), 1); return { from: iso(from), to: iso(today) }; }
  return { from: iso(today), to: iso(today) };
}

export default function AuditLogPage() {
  const initial = getRange('7d');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState('');
  const [data, setData] = useState({ logs: [], facets: { entity_types: [] } });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (search) params.set('action', search);
      if (entityType) params.set('entity_type', entityType);
      const res = await fetch(`${API}/admin/audit-log?${params}`);
      const json = await res.json();
      setData(json && Array.isArray(json.logs) ? json : { logs: [], facets: { entity_types: [] } });
    } catch {
      setData({ logs: [], facets: { entity_types: [] } });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [from, to, entityType]);

  const userCounts = useMemo(() => {
    const counts = {};
    for (const l of data.logs) {
      const k = l.username || '(anonymous)';
      counts[k] = (counts[k] || 0) + 1;
    }
    return counts;
  }, [data.logs]);

  return (
    <div className="space-y-4 pb-6">
      <AdminHero
        tag="Audit log"
        title="📋 ປະຫວັດການເຮັດວຽກ"
        subtitle="ບັນທຶກທຸກການກະທຳ ສຳລັບການກວດສອບ"
      />

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">ຈາກວັນທີ</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">ຫາວັນທີ</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_RANGES.map(r => (
            <button key={r.key} onClick={() => { const { from: f, to: t } = getRange(r.key); setFrom(f); setTo(t); }}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition">{r.label}</button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-slate-600 mb-1">ຄົ້ນຫາ action</label>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="order.create, POST /api/..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
        <button onClick={load} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-bold">ຄົ້ນຫາ</button>
      </div>

      {/* Entity filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setEntityType('')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
            entityType === '' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
          }`}
        >ທັງໝົດ · {data.logs.length}</button>
        {(data.facets?.entity_types || []).map(f => {
          const meta = ENTITY_LABEL[f.entity_type] || { icon: '·', label: f.entity_type || 'unknown' };
          return (
            <button
              key={f.entity_type || 'null'}
              onClick={() => setEntityType(f.entity_type)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                entityType === f.entity_type ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-500'
              }`}
            >{meta.icon} {meta.label} · {f.n}</button>
          );
        })}
      </div>

      {/* User summary */}
      {Object.keys(userCounts).length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">ຜູ້ໃຊ້ທີ່ມີການກະທຳ</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(userCounts).sort(([, a], [, b]) => b - a).map(([username, count]) => (
              <span key={username} className="px-3 py-1.5 bg-slate-100 rounded-full text-xs font-bold text-slate-700">
                {username} · <span className="text-slate-500">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">
          {loading ? 'ກຳລັງໂຫຼດ...' : `ບັນທຶກ ${data.logs.length} ລາຍການ`}
        </div>
        <div className="divide-y divide-slate-100">
          {data.logs.length === 0 ? (
            <div className="px-4 py-12 text-center text-slate-400">ບໍ່ມີຂໍ້ມູນ</div>
          ) : data.logs.map(log => {
            const meta = ENTITY_LABEL[log.entity_type] || { icon: '·', label: log.entity_type || 'unknown' };
            const isExpanded = expanded[log.id];
            return (
              <div key={log.id} className="px-4 py-2.5 hover:bg-slate-50">
                <div className="flex items-start gap-3">
                  <div className="text-lg leading-none mt-0.5 shrink-0">{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900">{log.action}</span>
                      {log.entity_id && (
                        <span className="font-mono text-[11px] text-slate-500">#{log.entity_id}</span>
                      )}
                      <span className="text-[11px] text-slate-400">·</span>
                      <span className="text-[11px] font-bold text-slate-700">{log.username || '(anonymous)'}</span>
                      {log.role && <span className="text-[10px] text-slate-500 uppercase">{log.role}</span>}
                    </div>
                    {log.summary && (
                      <div className="text-xs text-slate-600 mt-0.5">{log.summary}</div>
                    )}
                    {isExpanded && log.payload && (
                      <pre className="mt-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-[10px] font-mono text-slate-700 overflow-x-auto">
{typeof log.payload === 'object' ? JSON.stringify(log.payload, null, 2) : log.payload}
                      </pre>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-mono text-slate-500">{fmtDateTime(log.created_at)}</div>
                    {log.payload && (
                      <button
                        onClick={() => setExpanded(prev => ({ ...prev, [log.id]: !prev[log.id] }))}
                        className="text-[10px] text-slate-400 hover:text-slate-700"
                      >{isExpanded ? 'ປິດ' : 'ລາຍລະອຽດ'}</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
